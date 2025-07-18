# CrewAI Team - Agents and Tools Documentation

## Overview

The CrewAI Team system uses a multi-agent architecture where specialized AI agents collaborate to solve complex tasks. Each agent has specific capabilities and access to various tools that enable them to perform their specialized functions.

## Model Selection Strategy

Based on comprehensive testing, the system uses:
- **Main Model**: `granite3.3:2b` - Best overall performance for complex tasks
- **Simple Model**: `qwen3:0.6b` - Fast model for tool selection and simple tasks
- **Balanced Model**: `qwen3:1.7b` - Medium complexity tasks
- **High Quality Model**: `granite3.3:8b` - Critical analysis requiring high accuracy

## Available Agents

### 1. ResearchAgent
**Purpose**: Specializes in web research, information gathering, and fact-checking

**Model Configuration**:
- General tasks: `granite3.3:2b` (complex research)
- Tool selection: `qwen3:0.6b` (fast tool picking)

**Capabilities**:
- Web search and information retrieval
- Information synthesis from multiple sources
- Fact-checking and verification
- Content summarization
- Source credibility assessment

**Available Tools**:
- **WebSearchTool**: Performs web searches using various search engines
  - Parameters: `query` (string), `maxResults` (number), `searchEngine` (string)
  - Example: Search for "latest AI developments 2025"
  
- **WebScraperTool**: Extracts content from web pages
  - Parameters: `url` (string), `selector` (string optional), `format` (string)
  - Example: Scrape article content from news websites

### 2. CodeAgent
**Purpose**: Handles code generation, analysis, debugging, and refactoring

**Model Configuration**:
- General tasks: `granite3.3:2b` (complex code analysis)
- Tool selection: `qwen3:0.6b` (quick tool decisions)

**Capabilities**:
- Code generation in multiple languages
- Debugging and error analysis
- Code refactoring and optimization
- Code review and best practices
- Test generation
- Documentation generation

**Available Tools**:
- **CodeExecutorTool**: Executes code in a sandboxed environment
  - Parameters: `code` (string), `language` (string), `timeout` (number)
  - Example: Execute Python scripts, run tests
  
- **FileSystemTool**: Manages file operations
  - Parameters: `operation` (string), `path` (string), `content` (string optional)
  - Operations: read, write, create, delete, list
  - Example: Read project files, save generated code

### 3. DataAnalysisAgent
**Purpose**: Performs data analysis, visualization, and statistical processing

**Model Configuration**:
- General tasks: `granite3.3:2b` (complex analysis)
- Tool selection: `qwen3:0.6b` (tool parameter extraction)

**Capabilities**:
- Data processing and cleaning
- Statistical analysis
- Pattern recognition
- Data visualization
- Predictive modeling
- Report generation

**Available Tools**:
- **DataProcessingTool**: Processes and transforms data
  - Parameters: `data` (object/array), `operations` (array), `format` (string)
  - Operations: filter, aggregate, transform, join
  
- **VisualizationTool**: Creates charts and visualizations
  - Parameters: `data` (object/array), `chartType` (string), `options` (object)
  - Chart types: line, bar, scatter, pie, heatmap

### 4. WriterAgent
**Purpose**: Creates various types of written content with style adaptation

**Model Configuration**:
- General tasks: `granite3.3:2b` (high-quality writing)
- Tool selection: `qwen3:0.6b` (format decisions)

**Capabilities**:
- Content creation (articles, blogs, documentation)
- Writing style adaptation
- Grammar and style checking
- Content editing and proofreading
- Format conversion
- SEO optimization

**Available Tools**:
- **MarkdownFormatterTool**: Formats content in Markdown
  - Parameters: `content` (string), `style` (object), `features` (array)
  - Features: TOC generation, syntax highlighting, link validation
  
- **GrammarCheckTool**: Checks grammar and style
  - Parameters: `text` (string), `style` (string), `suggestions` (boolean)
  - Styles: formal, casual, technical, creative

### 5. ToolExecutorAgent
**Purpose**: Orchestrates and coordinates multiple tools for complex workflows

**Model Configuration**:
- General tasks: `granite3.3:2b` (workflow planning)
- Tool selection: `qwen3:0.6b` (rapid tool chaining)

**Capabilities**:
- Tool orchestration and chaining
- Workflow automation
- Integration management
- Error handling and recovery
- Performance optimization
- Resource management

**Available Tools**:
- Access to all tools from other agents:
  - WebSearchTool
  - WebScraperTool
  - FileSystemTool
  - CodeExecutorTool
  - Additional specialized tools as needed

## Tool Usage Patterns

### Simple Tool Selection (qwen3:0.6b)
```typescript
// Fast model for parameter extraction and tool selection
const toolDecision = await agentLLM.generate({
  prompt: "Extract search parameters from: Find recent AI papers",
  model: "qwen3:0.6b",
  temperature: 0.3,
  maxTokens: 512
});
```

### Complex Task Execution (granite3.3:2b)
```typescript
// Main model for complex reasoning and analysis
const analysis = await agentLLM.generate({
  prompt: "Analyze this code for security vulnerabilities",
  model: "granite3.3:2b",
  temperature: 0.7,
  maxTokens: 2048
});
```

## Best Practices

### 1. Agent Selection
- Match agent expertise to task requirements
- Consider using multiple agents for complex tasks
- Leverage ToolExecutorAgent for multi-step workflows

### 2. Tool Usage
- Always validate tool parameters before execution
- Handle tool errors gracefully
- Chain tools for complex operations
- Monitor tool execution time and resource usage

### 3. Model Optimization
- Use `qwen3:0.6b` for:
  - Tool parameter extraction
  - Simple decision making
  - Quick responses
  
- Use `granite3.3:2b` for:
  - Complex analysis
  - Multi-step reasoning
  - High-quality content generation

### 4. Performance Considerations
- Tool selection with fast model: ~10 seconds
- Complex analysis with main model: ~26 seconds
- Balance speed vs quality based on use case
- Monitor system load and switch models dynamically

## Integration Examples

### Example 1: Research Task
```typescript
// Use ResearchAgent to find and summarize information
const researchResult = await agentRegistry.execute({
  agentType: 'ResearchAgent',
  task: 'Find recent developments in quantum computing',
  tools: ['WebSearchTool', 'WebScraperTool']
});
```

### Example 2: Code Analysis
```typescript
// Use CodeAgent to analyze and improve code
const codeResult = await agentRegistry.execute({
  agentType: 'CodeAgent',
  task: 'Review this function for performance issues',
  context: { code: functionCode },
  tools: ['CodeExecutorTool', 'FileSystemTool']
});
```

### Example 3: Data Processing Pipeline
```typescript
// Use DataAnalysisAgent for data pipeline
const dataResult = await agentRegistry.execute({
  agentType: 'DataAnalysisAgent',
  task: 'Analyze sales trends and create visualizations',
  context: { data: salesData },
  tools: ['DataProcessingTool', 'VisualizationTool']
});
```

## Advanced Features

### 1. Confidence-Scored Responses
All agents use the 4-step confidence-scored RAG methodology:
1. Query analysis and understanding
2. Response generation with confidence tracking
3. Multi-modal evaluation
4. Adaptive delivery based on confidence

### 2. Dynamic Model Switching
Models automatically switch based on:
- Query complexity
- System load (CPU/memory)
- Urgency requirements
- Accuracy needs

### 3. Tool Chaining
Agents can chain multiple tools:
```typescript
WebSearchTool → WebScraperTool → DataProcessingTool → VisualizationTool
```

### 4. Parallel Execution
Multiple agents can work in parallel:
```typescript
const results = await Promise.all([
  researchAgent.execute(task1),
  codeAgent.execute(task2),
  dataAgent.execute(task3)
]);
```

## Error Handling

### Common Issues and Solutions

1. **Tool Timeout**
   - Default timeout: 30 seconds
   - Increase for complex operations
   - Use progress callbacks for long tasks

2. **Model Unavailable**
   - Automatic fallback to simpler models
   - Queue requests during high load
   - Graceful degradation

3. **Tool Failure**
   - Retry with exponential backoff
   - Alternative tool selection
   - Error context preservation

## Future Enhancements

1. **New Agents**
   - SecurityAgent: Security analysis and testing
   - DevOpsAgent: Infrastructure and deployment
   - DesignAgent: UI/UX design assistance

2. **New Tools**
   - DatabaseTool: Database operations
   - APITool: API testing and integration
   - MonitoringTool: System monitoring

3. **Capabilities**
   - Multi-modal input (images, audio)
   - Real-time collaboration
   - Advanced caching strategies

## Conclusion

The CrewAI Team's agent and tool ecosystem provides a flexible, powerful framework for solving complex tasks through AI collaboration. The combination of specialized agents, diverse tools, and intelligent model selection ensures optimal performance for various use cases.