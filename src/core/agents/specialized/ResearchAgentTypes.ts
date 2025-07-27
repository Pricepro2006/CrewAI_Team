import type { AgentResult } from "../base/AgentTypes";

// Research-specific result interfaces
export interface ResearchAgentResult extends AgentResult {
  // Core properties from base AgentResult are inherited
  // Additional properties for backward compatibility
  summary?: string;
  sources?: Source[];
  keyFindings?: string[];
  factCheck?: FactCheckResult;
  analysis?: string;
  keyPoints?: string[];
  comparison?: string;
  structuredData?: any[];
  citations?: Citation[];
  fallbackSummary?: string;
  fallbackAnalysis?: string;
}

export interface Source {
  url: string;
  title: string;
  type: string;
  accessedAt: string;
}

export interface FactCheckResult {
  isValid: boolean;
  confidence: number;
  evidence: string[];
}

export interface Citation {
  source: string;
  relevance: number;
  content?: string;
}

export interface ResearchPlan {
  queries: string[];
  sourceTypes: string[];
  extractionFocus: string[];
  tools: string[];
}

export interface ResearchResult {
  source: string;
  title: string;
  content: string;
  type: "search_result" | "scraped_content";
  relevance: number;
}

// Helper function to transform internal data structure to test-expected format
export function transformToResearchAgentResult(
  result: AgentResult,
): ResearchAgentResult {
  const researchResult = result as ResearchAgentResult;

  // If data contains the structured response, map it to expected properties
  if (result.data) {
    researchResult.summary = result.data.synthesis || result.output;
    researchResult.sources = result.data.sources || [];
    researchResult.keyFindings =
      result.data.keyFindings || extractKeyFindings(result.data.synthesis);
    researchResult.analysis = result.data.analysis || result.data.synthesis;
    researchResult.keyPoints = result.data.keyPoints || [];
    researchResult.structuredData = result.data.structuredData || [];
    researchResult.citations = result.data.citations || [];
    researchResult.comparison = result.data.comparison;
    researchResult.factCheck = result.data.factCheck;
  }

  // Ensure fallback properties
  researchResult.fallbackSummary =
    researchResult.summary || "No summary available";
  researchResult.fallbackAnalysis =
    researchResult.analysis || "No analysis available";

  return researchResult;
}

function extractKeyFindings(synthesis?: string): string[] {
  if (!synthesis) return [];

  // Simple extraction of key findings from synthesis
  const lines = synthesis.split("\n").filter((line) => line.trim());
  const findings: string[] = [];

  // Look for bullet points or numbered items
  lines.forEach((line) => {
    if (line.match(/^[\d\-*•]\s*.+/) && line.length > 20) {
      findings.push(line.replace(/^[\d\-*•]\s*/, "").trim());
    }
  });

  // If no bullet points found, extract first few sentences
  if (findings.length === 0 && lines.length > 0) {
    const sentences = synthesis.match(/[^.!?]+[.!?]+/g) || [];
    findings.push(...sentences.slice(0, 3).map((s) => s.trim()));
  }

  return findings;
}
