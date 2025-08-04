import {
  Email,
  EmailAnalysis,
  ModelConfig,
  OptimizationResult,
} from "../../types.js";
import { analyzeWithModel } from "../analysis/ModelAnalyzer.js";
import { scoreAnalysis } from "../scoring/AnalysisScorer.js";
import { logger } from "../../utils/logger.js";

interface PromptVariation {
  id: string;
  prompt: string;
  modifications: string[];
  score?: number;
  results?: EmailAnalysis[];
}

interface OptimizationStrategy {
  name: string;
  description: string;
  apply: (basePrompt: string) => string;
}

export class PromptOptimizer {
  private strategies: OptimizationStrategy[] = [
    {
      name: "add_step_by_step",
      description: "Add step-by-step reasoning",
      apply: (prompt) => prompt.replace("Analyze", "Analyze step by step"),
    },
    {
      name: "add_json_structure",
      description: "Add explicit JSON output structure",
      apply: (prompt) =>
        `${prompt}\n\nOutput as JSON with these exact fields:\n${this.getJsonSchema()}`,
    },
    {
      name: "add_examples",
      description: "Add few-shot examples",
      apply: (prompt) => `${prompt}\n\nExample:\n${this.getExampleAnalysis()}`,
    },
    {
      name: "simplify_instructions",
      description: "Simplify complex instructions",
      apply: (prompt) => this.simplifyLanguage(prompt),
    },
    {
      name: "add_role_context",
      description: "Add role-based context",
      apply: (prompt) =>
        `You are an expert email analyst for TD SYNNEX with 10 years of experience.\n\n${prompt}`,
    },
    {
      name: "optimize_for_model",
      description: "Add model-specific optimizations",
      apply: (prompt) => this.addModelSpecificOptimizations(prompt),
    },
  ];

  constructor(
    private testEmails: Email[],
    private baselineResults: EmailAnalysis[],
    private targetModel: string,
  ) {}

  async optimizePrompt(
    initialPrompt: string,
    targetScore: number = 7.5,
    maxIterations: number = 50,
  ): Promise<OptimizationResult> {
    logger.info(`Starting prompt optimization for ${this.targetModel}`);
    logger.info(`Target score: ${targetScore}/10`);

    const variations: PromptVariation[] = [];
    let bestPrompt = initialPrompt;
    let bestScore = 0;
    let iteration = 0;

    // Test initial prompt
    const initialScore = await this.testPrompt(initialPrompt);
    logger.info(`Initial prompt score: ${initialScore}/10`);

    if (initialScore >= targetScore) {
      return {
        prompt: initialPrompt,
        score: initialScore,
        iterations: 0,
        improvements: [],
      };
    }

    // Generate and test variations
    while (bestScore < targetScore && iteration < maxIterations) {
      iteration++;
      logger.info(`\nIteration ${iteration}/${maxIterations}`);

      // Generate variations
      const newVariations = this.generateVariations(bestPrompt, variations);

      // Test variations in parallel (batch of 5)
      const batchSize = 5;
      for (let i = 0; i < newVariations.length; i += batchSize) {
        const batch = newVariations.slice(i, i + batchSize);
        const scores = await Promise.all(
          batch.map((variation) => this.testVariation(variation)),
        );

        // Update scores and find best
        batch.forEach((variation, index) => {
          variation.score = scores[index];
          variations.push(variation);

          if (variation.score! > bestScore) {
            bestScore = variation.score!;
            bestPrompt = variation.prompt;
            logger.info(
              `New best score: ${bestScore}/10 (${variation.modifications.join(", ")})`,
            );
          }
        });

        // Early exit if target reached
        if (bestScore >= targetScore) break;
      }
    }

    // Analyze improvements
    const improvements = this.analyzeImprovements(variations);

    return {
      prompt: bestPrompt,
      score: bestScore,
      iterations: iteration,
      improvements,
      variations: variations.sort((a, b) => (b.score || 0) - (a.score || 0)),
    };
  }

  private async testPrompt(prompt: string): Promise<number> {
    const results: EmailAnalysis[] = [];

    for (const email of this.testEmails) {
      try {
        const analysis = await analyzeWithModel(
          this.targetModel,
          prompt,
          email,
        );
        results.push(analysis);
      } catch (error) {
        logger.error(`Failed to analyze email ${email.id}: ${error}`);
      }
    }

    // Score against baseline
    const scores = results.map((result, index) =>
      scoreAnalysis(result, this.baselineResults[index]),
    );

    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  private async testVariation(variation: PromptVariation): Promise<number> {
    logger.info(`Testing variation: ${variation.modifications.join(", ")}`);
    const score = await this.testPrompt(variation.prompt);
    logger.info(`Variation score: ${score}/10`);
    return score;
  }

  private generateVariations(
    basePrompt: string,
    existingVariations: PromptVariation[],
  ): PromptVariation[] {
    const newVariations: PromptVariation[] = [];

    // Single strategy variations
    for (const strategy of this.strategies) {
      if (!this.hasVariation(existingVariations, [strategy.name])) {
        newVariations.push({
          id: `var_${Date.now()}_${strategy.name}`,
          prompt: strategy.apply(basePrompt),
          modifications: [strategy.name],
        });
      }
    }

    // Combine successful strategies
    const successfulStrategies = existingVariations
      .filter((v) => v.score && v.score > 6)
      .flatMap((v) => v.modifications);

    const uniqueStrategies = [...new Set(successfulStrategies)];

    // Try combining pairs of successful strategies
    for (let i = 0; i < uniqueStrategies.length; i++) {
      for (let j = i + 1; j < uniqueStrategies.length; j++) {
        const combo = [uniqueStrategies[i], uniqueStrategies[j]];
        if (!this.hasVariation(existingVariations, combo)) {
          let prompt = basePrompt;
          for (const strategyName of combo) {
            const strategy = this.strategies.find(
              (s) => s.name === strategyName,
            );
            if (strategy) {
              prompt = strategy.apply(prompt);
            }
          }

          newVariations.push({
            id: `var_${Date.now()}_combo_${i}_${j}`,
            prompt,
            modifications: combo,
          });
        }
      }
    }

    return newVariations;
  }

  private hasVariation(
    variations: PromptVariation[],
    modifications: string[],
  ): boolean {
    return variations.some(
      (v) =>
        v.modifications.length === modifications.length &&
        v.modifications.every((m) => modifications.includes(m)),
    );
  }

  private analyzeImprovements(variations: PromptVariation[]): string[] {
    const improvements: string[] = [];

    // Find most effective strategies
    const strategyScores = new Map<string, number[]>();

    for (const variation of variations) {
      if (variation.score) {
        for (const mod of variation.modifications) {
          if (!strategyScores.has(mod)) {
            strategyScores.set(mod, []);
          }
          strategyScores.get(mod)!.push(variation.score);
        }
      }
    }

    // Calculate average scores for each strategy
    const avgScores = Array.from(strategyScores.entries())
      .map(([strategy, scores]) => ({
        strategy,
        avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
        count: scores.length,
      }))
      .sort((a, b) => b.avgScore - a.avgScore);

    for (const { strategy, avgScore, count } of avgScores) {
      if (avgScore > 6 && count >= 2) {
        improvements.push(
          `${strategy}: +${(avgScore - 5).toFixed(1)} points (tested ${count} times)`,
        );
      }
    }

    return improvements;
  }

  private getJsonSchema(): string {
    return JSON.stringify(
      {
        workflow_state: "START_POINT|IN_PROGRESS|WAITING|COMPLETION",
        entities: {
          po_numbers: ["string"],
          quote_numbers: ["string"],
          case_numbers: ["string"],
          part_numbers: ["string"],
          companies: ["string"],
          contacts: ["string"],
        },
        priority: "CRITICAL|HIGH|MEDIUM|LOW",
        action_items: [
          {
            task: "string",
            owner: "string",
            deadline: "string",
          },
        ],
        suggested_response: "string",
        confidence: 0.0,
      },
      null,
      2,
    );
  }

  private getExampleAnalysis(): string {
    return `Input: "Urgent: PO 70882659 needs shipping update for customer ABC Corp"
Output: {
  "workflow_state": "IN_PROGRESS",
  "entities": {
    "po_numbers": ["70882659"],
    "companies": ["ABC Corp"]
  },
  "priority": "HIGH",
  "action_items": [{
    "task": "Provide shipping update for PO 70882659",
    "owner": "Logistics Team",
    "deadline": "Same day"
  }],
  "suggested_response": "I'll check the shipping status for PO 70882659 and update you within the hour.",
  "confidence": 0.9
}`;
  }

  private simplifyLanguage(prompt: string): string {
    // Simplify complex sentences
    return prompt
      .replace(/analyze comprehensively/gi, "analyze")
      .replace(/provide detailed insights/gi, "give insights")
      .replace(/extract and identify/gi, "find")
      .replace(/determine the appropriate/gi, "choose the")
      .replace(/based on the following criteria/gi, "using these rules");
  }

  private addModelSpecificOptimizations(prompt: string): string {
    switch (this.targetModel) {
      case "llama3.2:3b":
        return `${prompt}\n\nIMPORTANT: Be concise and focus on the most relevant information.`;

      case "doomgrave/phi-4:14b-tools-Q3_K_S":
        return `<|system|>\n${prompt}\n<|user|>\n[EMAIL_CONTENT]\n<|assistant|>`;

      default:
        return prompt;
    }
  }
}

// Export helper function for easy use
export async function optimizePromptForModel(
  model: string,
  testEmails: Email[],
  baselineResults: EmailAnalysis[],
  initialPrompt: string,
  targetScore: number = 7.5,
): Promise<OptimizationResult> {
  const optimizer = new PromptOptimizer(testEmails, baselineResults, model);
  return optimizer.optimizePrompt(initialPrompt, targetScore);
}
