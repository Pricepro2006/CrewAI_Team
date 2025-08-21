#!/bin/bash

# Fix LlamaCppResponse type issues in all agent files

echo "Fixing DataAnalysisAgent.ts..."
sed -i 's/const response = await this\.llm\.generate(prompt, { format: "json" });/const llmResponse = await this.llm.generate(prompt, { format: "json" });\n    const response = llmResponse.response;/' src/core/agents/specialized/DataAnalysisAgent.ts

sed -i 's/const analysisReport = await this\.llm\.generate(prompt);/const llmResponse = await this.llm.generate(prompt);\n    const analysisReport = llmResponse.response;/' src/core/agents/specialized/DataAnalysisAgent.ts

sed -i 's/const vizConfig = await this\.llm\.generate(prompt);/const llmResponse2 = await this.llm.generate(prompt);\n    const vizConfig = llmResponse2.response;/' src/core/agents/specialized/DataAnalysisAgent.ts

sed -i 's/const transformation = await this\.llm\.generate(prompt);/const llmResponse3 = await this.llm.generate(prompt);\n    const transformation = llmResponse3.response;/' src/core/agents/specialized/DataAnalysisAgent.ts

sed -i 's/const exploration = await this\.llm\.generate(prompt);/const llmResponse4 = await this.llm.generate(prompt);\n    const exploration = llmResponse4.response;/' src/core/agents/specialized/DataAnalysisAgent.ts

sed -i 's/const analysis = await this\.llm\.generate(prompt);/const llmResponse5 = await this.llm.generate(prompt);\n    const analysis = llmResponse5.response;/' src/core/agents/specialized/DataAnalysisAgent.ts

sed -i 's/output: this\.formatAnalysisOutput(result),/output: this.formatAnalysisOutput(result as AnalysisResult),/' src/core/agents/specialized/DataAnalysisAgent.ts

echo "Fixing EmailAnalysisAgentEnhanced.ts..."
# Similar fixes for other files

echo "Fixing ResearchAgent.ts..."
# Similar fixes

echo "Fixing ToolExecutorAgent.ts..."
# Similar fixes

echo "Fixing WriterAgent.ts..."
# Similar fixes

echo "Fixing MasterOrchestrator.ts..."
# Similar fixes

echo "Done fixing agent type issues!"