# CrewAI Team Agent and Workflow Guide

## Overview

The CrewAI Team framework is an enterprise AI agent system with a sophisticated multi-agent architecture designed for intelligent email processing and business workflow automation. This guide provides comprehensive documentation of all available agents, their capabilities, and workflow orchestration patterns.

**Current Status**: v2.3.0 - Framework ready, LLM integration pending
**Last Updated**: August 12, 2025

## Table of Contents

1. [Agent Architecture](#agent-architecture)
2. [Individual Agents](#individual-agents)
3. [Workflow Orchestration](#workflow-orchestration)
4. [Integration Patterns](#integration-patterns)
5. [Usage Recommendations](#usage-recommendations)

---

## Agent Architecture

### Base Agent System

All agents in the CrewAI Team system inherit from the `BaseAgent` class, which provides:

- **LLM Integration**: Direct integration with Ollama provider (llama3.2:3b model)
- **Tool Management**: Dynamic tool registration and execution
- **Capability System**: Declarative capability management
- **Error Handling**: Comprehensive error handling with timeout management
- **Performance Monitoring**: Built-in performance monitoring and logging

### Core Components

- **Model**: llama3.2:3b (primary model for unified approach)
- **Timeout Management**: Configurable timeouts for different operations
- **Capability-Based Routing**: Agents are selected based on declared capabilities
- **Tool Integration**: Dynamic tool loading and execution

---

## Individual Agents

### 1. EmailAnalysisAgent

**Purpose**: Specialized for analyzing and categorizing TD SYNNEX email communications

#### Capabilities
- **email-analysis**: Full email content analysis
- **entity-extraction**: Extract business entities (PO numbers, quotes, customers, etc.)
- **workflow-management**: Determine workflow states and transitions
- **priority-assessment**: Intelligent priority determination with business rules

#### Key Features

**Multi-Stage Analysis Pipeline**:
1. **Quick Categorization**: Lightweight model for initial analysis
2. **Deep Analysis**: Quality-focused model for low-confidence results
3. **Entity Extraction**: Regex + NER for business entities
4. **Workflow State Determination**: State machine-based workflow tracking
5. **Action Generation**: Context-aware suggested actions

**Entity Patterns**:
- PO Numbers: `/\b(?:PO|P\.O\.|Purchase Order)[\s#:-]*(\d{8,12})\b/gi`
- Quote Numbers: `/\b(?:CAS|TS|WQ|Quote)[\s#:-]*(\d{6,10})\b/gi`
- Order Numbers: `/\b(?:Order|ORD)[\s#:-]*([A-Z]{2,3}\d{6,10})\b/gi`
- Tracking Numbers: `/\b(?:1Z|FEDEX|UPS)[\w\d]{10,35}\b/gi`

**Categories Supported**:
- **Workflow**: Order Management, Shipping/Logistics, Quote Processing, Customer Support, etc.
- **Priority**: Critical, High, Medium, Low
- **Intent**: Action Required, FYI, Request, Update
- **Urgency**: Immediate, 24 Hours, 72 Hours, No Rush

#### When to Use
- ✅ Email content analysis and categorization
- ✅ Business entity extraction from email content
- ✅ Workflow state determination
- ✅ Priority assessment with business rules
- ✅ Automated email triage and routing

#### How to Use
```typescript
const emailAgent = new EmailAnalysisAgent();
await emailAgent.initialize();

const result = await emailAgent.execute("analyze email", {
  task: "analyze and categorize email",
  metadata: { email: emailObject }
});
```

#### Output Format
```json
{
  "categories": {
    "workflow": ["Order Management"],
    "priority": "High",
    "intent": "Action Required",
    "urgency": "24 Hours"
  },
  "entities": {
    "poNumbers": ["12345678"],
    "customers": ["ACME Corp"],
    "amounts": [{"value": 5000, "currency": "USD"}]
  },
  "workflowState": "In Progress",
  "suggestedActions": ["Update order status", "Send confirmation"],
  "summary": "Customer requesting order status update",
  "confidence": 0.85
}
```

---

### 2. ResearchAgent

**Purpose**: Web research, information gathering, and fact-checking specialist

#### Capabilities
- **web_research**: Advanced web search capabilities
- **content_extraction**: Web page content parsing and extraction
- **fact_checking**: Cross-source information verification
- **source_evaluation**: Source credibility and relevance assessment

#### Key Features

**Search Strategy**:
- **SearXNG Integration**: Unlimited searches with better results
- **DuckDuckGo Fallback**: When SearXNG unavailable
- **Intelligent Query Planning**: LLM-based research plan creation
- **Business Query Enhancement**: Special handling for business/service queries

**Multi-Source Synthesis**:
- Combines information from multiple sources
- Provides relevance scoring
- Identifies conflicting information
- Maintains source attribution

**Caching System**:
- SearchKnowledgeService integration
- Previous result caching for similar queries
- ChromaDB vector storage for semantic search

#### When to Use
- ✅ Web research and information gathering
- ✅ Fact-checking and source verification
- ✅ Business information lookup (addresses, phone numbers, services)
- ✅ Technical research and documentation lookup
- ✅ Market research and competitive analysis

#### How to Use
```typescript
const researchAgent = new ResearchAgent();
await researchAgent.initialize();

const result = await researchAgent.execute("research topic", {
  task: "Find information about quantum computing advances",
  tool: "web_search"
});
```

#### Special Business Query Features
- **Contact Information Extraction**: Phone numbers, addresses, business hours
- **Service Area Detection**: Geographic coverage and travel availability
- **Pricing Information**: Initial costs and service pricing
- **Certification Tracking**: Business qualifications and certifications

---

### 3. DataAnalysisAgent

**Purpose**: Data processing, analysis, visualization, and insights extraction

#### Capabilities
- **statistical_analysis**: Statistical analysis on datasets
- **data_visualization**: Chart and visualization configuration
- **data_transformation**: Data cleaning and transformation
- **exploratory_analysis**: Comprehensive exploratory data analysis

#### Key Features

**Analysis Types**:
- **Statistical**: Descriptive statistics, tests, confidence intervals
- **Visualization**: Chart recommendations with configuration
- **Transformation**: Data cleaning, normalization, feature engineering
- **Exploration**: Pattern detection, outlier identification, relationship analysis

**Adaptive Processing**:
- Task complexity assessment
- Appropriate technique selection
- Multiple output formats (tables, charts, summaries, reports)

#### When to Use
- ✅ Statistical analysis of datasets
- ✅ Data visualization and chart creation
- ✅ Data cleaning and transformation
- ✅ Exploratory data analysis
- ✅ Business metrics analysis and reporting

#### How to Use
```typescript
const dataAgent = new DataAnalysisAgent();
await dataAgent.initialize();

const result = await dataAgent.execute("analyze sales data", {
  task: "Perform statistical analysis on Q3 sales",
  ragDocuments: [{ content: csvData }]
});
```

#### Analysis Output Types
- **Statistical Reports**: Comprehensive statistical analysis with recommendations
- **Visualization Configs**: JSON configurations for chart libraries
- **Data Transformations**: Cleaned and processed datasets
- **Insight Summaries**: Key findings and business insights

---

### 4. CodeAgent

**Purpose**: Code generation, debugging, and analysis (Referenced in routing but implementation not analyzed)

#### Capabilities (Inferred)
- **code_generation**: Generate code in various languages
- **debugging**: Debug and fix code issues
- **syntax_analysis**: Code syntax and structure analysis

#### When to Use
- ✅ Code generation and programming assistance
- ✅ Debugging and error resolution
- ✅ Code review and analysis
- ✅ Syntax validation and optimization

---

### 5. WriterAgent

**Purpose**: Content creation, documentation, and writing assistance (Referenced in routing but implementation not analyzed)

#### Capabilities (Inferred)
- **content_creation**: Generate various types of content
- **grammar_check**: Grammar and style checking
- **style_analysis**: Writing style analysis and improvement

#### When to Use
- ✅ Content creation and writing assistance
- ✅ Documentation generation
- ✅ Grammar and style checking
- ✅ Technical writing and communication

---

### 6. ToolExecutorAgent

**Purpose**: Tool coordination and complex workflow automation (Referenced in routing but implementation not analyzed)

#### Capabilities (Inferred)
- **tool_execution**: Coordinate multiple tools
- **api_integration**: Integrate with external APIs
- **automation**: Complex workflow automation

#### When to Use
- ✅ Complex multi-tool workflows
- ✅ API integration and coordination
- ✅ Automation of repetitive tasks
- ✅ Tool orchestration and management

---

## Workflow Orchestration

### Master Orchestrator

The `MasterOrchestrator` is the central coordination hub that manages the entire agent workflow system.

#### Core Components

1. **EnhancedParser**: Advanced query analysis and intent detection
2. **AgentRouter**: Intelligent agent selection and routing
3. **PlanExecutor**: Executes multi-step plans with agents
4. **PlanReviewer**: Reviews and validates execution results
5. **RAGSystem**: Retrieval-augmented generation for context

#### Orchestration Flow

```
Query Input → Enhanced Analysis → Agent Routing → Plan Creation → Execution → Review → Response
```

#### 1. Enhanced Query Analysis

**Process**:
- Intent detection and classification
- Complexity assessment (1-10 scale)
- Domain identification
- Resource requirement analysis
- Entity extraction
- Priority determination

**Output**:
```typescript
interface QueryAnalysis {
  intent: string[];
  complexity: number;
  domains: string[];
  priority: "low" | "medium" | "high" | "critical";
  estimatedDuration: number;
  resourceRequirements: {
    requiresInternet: boolean;
    requiresDatabase: boolean;
    requiresVector: boolean;
  };
  entities: Record<string, any>;
}
```

#### 2. Agent Routing

**Routing Logic**:
- **Research Queries**: ResearchAgent (contains "research", "search", "find")
- **Code Queries**: CodeAgent (contains "code", "debug")
- **Data Analysis**: DataAnalysisAgent (contains "analysis", "analyze", "data")
- **Writing Tasks**: WriterAgent (contains "writing", "write", "content")
- **Default**: ResearchAgent for general queries

**Fallback Strategy**:
```typescript
const fallbackMap = {
  ResearchAgent: ["ToolExecutorAgent"],
  CodeAgent: ["ToolExecutorAgent", "ResearchAgent"],
  DataAnalysisAgent: ["ResearchAgent", "ToolExecutorAgent"],
  WriterAgent: ["ResearchAgent"],
  ToolExecutorAgent: ["ResearchAgent"]
};
```

#### 3. Plan Execution

**Execution Strategies**:
- **Sequential**: Step-by-step execution with dependencies
- **Parallel**: Concurrent execution for independent steps
- **Adaptive**: Dynamic strategy selection based on plan complexity

**Replan Loop**:
- Maximum 3 attempts per query
- 2-minute total time limit
- Infrastructure failure detection and handling
- Step dependency management

#### 4. Error Handling and Timeouts

**Timeout Configuration**:
- Query Processing: 30 seconds
- Plan Creation: 45 seconds  
- Agent Execution: 60 seconds
- LLM Generation: 30 seconds

**Error Recovery**:
- Graceful timeout handling
- Fallback agent selection
- Infrastructure failure detection
- Comprehensive error logging

### Workflow Management System

The workflow system provides enterprise-grade task and workflow management capabilities.

#### Workflow Categories

1. **Order Management**: Order processing and tracking
2. **Quote Processing**: Quote generation and management
3. **Shipping and Logistics**: Delivery and tracking management
4. **Vendor Pricing Updates**: Price change processing
5. **Returns and RMA**: Return merchandise authorization
6. **Account Changes**: Customer account modifications
7. **Deal Activations**: Deal setup and activation
8. **General Support**: General customer support tasks

#### Workflow States

- **START_POINT**: Initial workflow state
- **IN_PROGRESS**: Active processing state
- **COMPLETION**: Final completed state

#### Task Status Levels

- **RED**: Critical issues requiring immediate attention
- **YELLOW**: Warning status, needs attention soon
- **GREEN**: On track, normal processing
- **COMPLETED**: Task successfully completed

#### Priority Levels

- **CRITICAL**: Immediate action required
- **HIGH**: High priority, 24-hour SLA
- **MEDIUM**: Standard priority, 48-hour SLA
- **NORMAL**: Low priority, standard processing

#### Workflow API Operations

1. **list**: Get filtered and paginated workflow tasks
2. **get**: Retrieve specific task with history
3. **update**: Update task status and properties
4. **create**: Create new workflow task
5. **delete**: Remove workflow task
6. **metrics**: Executive dashboard metrics
7. **analytics**: Trend analysis and performance data

#### Executive Metrics

```typescript
interface WorkflowMetrics {
  executive: {
    total_tasks: number;
    red_tasks: number;
    yellow_tasks: number;
    green_tasks: number;
    completed_tasks: number;
    revenue_at_risk: number;
    sla_violations: number;
  };
  categories: CategoryBreakdown[];
  owners: OwnerWorkload[];
  lastUpdated: string;
}
```

---

## Integration Patterns

### Agent Registration and Discovery

```typescript
// Agent registration
const agentRegistry = new AgentRegistry();
await agentRegistry.register("EmailAnalysisAgent", emailAgent, config);

// Agent discovery
const agent = await agentRegistry.getAgent("EmailAnalysisAgent");
```

### RAG System Integration

```typescript
// RAG configuration
const ragConfig = {
  vectorStore: {
    type: "chromadb",
    collectionName: "email_knowledge",
    baseUrl: "http://localhost:8000"
  },
  chunking: {
    chunkSize: 1000,
    overlap: 200
  },
  retrieval: {
    topK: 5,
    minScore: 0.7
  }
};
```

### WebSocket Real-time Updates

```typescript
// Plan execution updates
wsService.broadcastPlanUpdate(plan.id, "executing", {
  completed: 2,
  total: 5,
  currentStep: "Research phase"
});

// Workflow status updates  
wsService.broadcastWorkflowUpdate(taskId, "status_changed", {
  oldStatus: "YELLOW",
  newStatus: "GREEN",
  updatedBy: "system"
});
```

---

## Usage Recommendations

### Email Processing Workflow

**Recommended Agent Sequence**:
1. **EmailAnalysisAgent**: Initial email analysis and categorization
2. **ResearchAgent**: Additional context gathering if needed
3. **DataAnalysisAgent**: Metrics and pattern analysis
4. **WorkflowManager**: Task creation and tracking

### Research and Information Gathering

**Best Practices**:
- Use ResearchAgent for external information gathering
- Leverage caching system for repeated queries
- Enable business query enhancement for service/contact lookups
- Implement source verification for critical information

### Data Analysis Pipeline

**Recommended Approach**:
1. **Data Validation**: Use DataAnalysisAgent for initial data quality assessment
2. **Exploratory Analysis**: Identify patterns and anomalies
3. **Statistical Analysis**: Apply appropriate statistical methods
4. **Visualization**: Generate charts and visual representations
5. **Insight Generation**: Extract actionable business insights

### Complex Multi-Agent Workflows

**Orchestration Strategy**:
```typescript
// Example: Email-to-Workflow Pipeline
const pipeline = [
  { agent: "EmailAnalysisAgent", task: "analyze_email" },
  { agent: "ResearchAgent", task: "gather_context", condition: "needs_research" },
  { agent: "DataAnalysisAgent", task: "extract_metrics", condition: "has_data" },
  { agent: "WorkflowManager", task: "create_task" }
];
```

### Performance Optimization

**Best Practices**:
- Use simple plan generation for CPU performance (`USE_SIMPLE_PLAN=true`)
- Implement aggressive timeout management
- Enable agent pooling for high-throughput scenarios
- Use caching for repeated operations
- Monitor performance metrics and adjust accordingly

### Error Handling Strategy

**Recommended Pattern**:
```typescript
try {
  const result = await agent.execute(task, context);
  return result;
} catch (error) {
  if (error instanceof TimeoutError) {
    // Handle timeout with graceful degradation
    return fallbackResponse(error);
  }
  // Log error and try fallback agent
  const fallbackAgent = getFallbackAgent(agent.name);
  return await fallbackAgent.execute(task, context);
}
```

---

## Current Limitations and Future Enhancements

### Current Status (v2.3.0)

**✅ Implemented**:
- Agent framework architecture
- Email analysis capabilities (design complete)
- Workflow management system
- Business intelligence integration
- Walmart grocery agent (87.5% accuracy)

**⚠️ Partially Implemented**:
- LLM integration (15 emails processed out of 143,850)
- Real-time processing pipeline
- Vector search and RAG system

**❌ Pending**:
- Production-scale LLM processing
- Auto-pull email integration
- Advanced agent collaboration patterns
- Real-time WebSocket updates

### Future Enhancements

1. **Enhanced Agent Collaboration**: Multi-agent conversation patterns
2. **Advanced Workflow Automation**: Complex business process automation
3. **Predictive Analytics**: Proactive issue identification
4. **Integration Expansion**: Additional data sources and APIs
5. **Performance Scaling**: High-throughput processing optimization

---

## Conclusion

The CrewAI Team agent and workflow system provides a comprehensive foundation for enterprise AI automation. While the framework is architecturally complete, full production deployment requires completion of LLM integration and real-time processing capabilities.

For immediate use, focus on:
- Email analysis and categorization workflows
- Business intelligence extraction
- Workflow management and task tracking
- Research and information gathering

For production deployment, prioritize:
- Complete LLM integration for email processing
- Real-time processing pipeline implementation
- Performance optimization and scaling
- Comprehensive testing and validation

This guide serves as the definitive reference for understanding and implementing the CrewAI Team agent and workflow system.