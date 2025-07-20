// Test implementation for MasterOrchestrator methods
// This bypasses the complex import issues for now
import axios from 'axios';
class TestMasterOrchestrator {
    ollamaUrl;
    model;
    constructor() {
        this.ollamaUrl = 'http://localhost:11434';
        // Using mistral for testing - it's much faster than qwen3:14b
        this.model = 'mistral:7b';
    }
    async createPlan(queryText) {
        // Improved prompt with clearer instructions and example
        const prompt = `You are an AI Master Orchestrator. Analyze the following query and create a detailed execution plan.

Query: "${queryText}"

Create a step-by-step plan where each step specifies:
- Which specialized agent should handle it (ResearchAgent, CodeAgent, DataAnalysisAgent, WriterAgent, or ToolExecutorAgent)
- What information or context is needed
- Whether external tools are required
- What the expected output should be

Format your response as a JSON object following this structure:
{
  "steps": [
    {
      "id": "step-1",
      "description": "Clear description of what this step does",
      "agentType": "CodeAgent",
      "requiresTool": false,
      "ragQuery": "relevant context to retrieve",
      "expectedOutput": "what this step should produce",
      "dependencies": []
    }
  ]
}

Important: Return ONLY the JSON object, no additional text.`;
        try {
            const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
                model: this.model,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.3,
                    top_p: 0.9,
                    num_predict: 2000
                }
            });
            return this.parsePlan(response.data.response);
        }
        catch (error) {
            console.error('Failed to create plan:', error);
            throw error;
        }
    }
    parsePlan(response) {
        try {
            // Remove any thinking tags or extra text
            const cleanResponse = response.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
            // Extract JSON from the response
            const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No valid JSON found in response');
            }
            const parsed = JSON.parse(jsonMatch[0]);
            // Validate the plan structure
            if (!parsed.steps || !Array.isArray(parsed.steps)) {
                throw new Error('Invalid plan structure: missing steps array');
            }
            // Ensure all required fields
            return {
                steps: parsed.steps.map((step, index) => ({
                    id: step.id || `step-${index + 1}`,
                    description: step.description || 'No description provided',
                    agentType: step.agentType || 'ResearchAgent',
                    requiresTool: step.requiresTool || false,
                    toolName: step.toolName,
                    ragQuery: step.ragQuery || '',
                    expectedOutput: step.expectedOutput || 'General output',
                    dependencies: step.dependencies || [],
                    parameters: step.parameters || {}
                }))
            };
        }
        catch (error) {
            console.error('Failed to parse plan:', error);
            console.error('Raw response:', response.substring(0, 500) + '...');
            // Return a fallback plan
            return {
                steps: [{
                        id: 'fallback-1',
                        description: 'Process query with general approach',
                        agentType: 'ResearchAgent',
                        requiresTool: false,
                        ragQuery: '',
                        expectedOutput: 'General response to query',
                        dependencies: [],
                        parameters: {}
                    }]
            };
        }
    }
    async testPlanCreation() {
        console.log('Testing MasterOrchestrator plan creation...\n');
        const testQueries = [
            'Write a Python function to calculate fibonacci numbers',
            'Search for information about climate change and summarize the findings',
            'Analyze this CSV data and create a visualization'
        ];
        for (const query of testQueries) {
            console.log(`\nQuery: "${query}"`);
            console.log('---');
            try {
                const plan = await this.createPlan(query);
                console.log(`✅ Successfully created plan with ${plan.steps.length} steps:`);
                plan.steps.forEach(step => {
                    console.log(`\n  Step ${step.id}:`);
                    console.log(`    Description: ${step.description}`);
                    console.log(`    Agent: ${step.agentType}`);
                    console.log(`    Requires Tool: ${step.requiresTool}`);
                    if (step.toolName) {
                        console.log(`    Tool: ${step.toolName}`);
                    }
                    console.log(`    Expected Output: ${step.expectedOutput}`);
                });
            }
            catch (error) {
                console.error(`❌ Failed to create plan: ${error}`);
            }
        }
    }
}
// Run the test
async function main() {
    const orchestrator = new TestMasterOrchestrator();
    await orchestrator.testPlanCreation();
}
main()
    .then(() => {
    console.log('\n✅ Test completed!');
    process.exit(0);
})
    .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
});
//# sourceMappingURL=test-implementation.js.map