# Master Orchestrator - Agent Instructions

## Metadata

- **Agent ID**: master_orchestrator
- **Version**: 1.0.0
- **Model Target**: mistral:latest
- **Created**: 2025-06-25

## Tool Usage Guide

### 1. Enhanced Parser

**Purpose**: Parse and analyze incoming queries to extract structured information

**Syntax**:

```python
enhanced_parser.parse_query(query_text, context=optional_context)
```

**Parameters**:

- `query_text` (string, required): The user's input query
- `context` (dict, optional): Previous conversation context

**Returns**:

- `intent`: Primary intent of the query
- `entities`: Extracted entities and their types
- `complexity`: Query complexity score (1-10)
- `domains`: Required expertise domains

**Example**:

```python
result = enhanced_parser.parse_query(
    "Create a Python API with FastAPI that integrates with GitHub Actions",
    context={"session_id": "abc123", "previous_topic": "api_development"}
)
# Returns: {
#   "intent": "create_api",
#   "entities": {"framework": "FastAPI", "language": "Python", "integration": "GitHub Actions"},
#   "complexity": 7,
#   "domains": ["python_expert", "api_integration_expert", "github_workflow_expert"]
# }
```

### 2. Agent Router

**Purpose**: Route queries to appropriate expert agents based on requirements

**Syntax**:

```python
agent_router.route(query_analysis, available_agents, routing_strategy="optimal")
```

**Parameters**:

- `query_analysis` (dict, required): Output from enhanced_parser
- `available_agents` (list, required): List of available agents
- `routing_strategy` (string, optional): Strategy: "optimal", "fastest", "comprehensive"

**Returns**:

- `selected_agents`: List of agents to route to
- `routing_plan`: Execution plan (sequential/parallel)
- `confidence`: Routing confidence score

**Example**:

```python
routing = agent_router.route(
    query_analysis={
        "domains": ["python_expert", "api_integration_expert"],
        "complexity": 7
    },
    available_agents=agent_registry.get_all(),
    routing_strategy="comprehensive"
)
# Returns: {
#   "selected_agents": ["python_expert", "api_integration_expert", "documentation_expert"],
#   "routing_plan": "parallel",
#   "confidence": 0.92
# }
```

### 3. Cross-Agent Communicator

**Purpose**: Facilitate communication between multiple agents

**Syntax**:

```python
cross_agent_communicator.send_message(message_type, content, recipients, pattern="broadcast")
```

**Parameters**:

- `message_type` (string, required): Type: "query", "response", "context_update"
- `content` (dict, required): Message content
- `recipients` (list, required): Target agents
- `pattern` (string, optional): Communication pattern: "broadcast", "direct", "chain", "hierarchical"

**Returns**:

- `message_id`: Unique message identifier
- `delivery_status`: Status for each recipient
- `responses`: Collected responses from agents

**Example**:

```python
result = cross_agent_communicator.send_message(
    message_type="query",
    content={
        "task": "Design secure API architecture",
        "requirements": ["authentication", "rate_limiting", "scalability"]
    },
    recipients=["architecture_expert", "security_specialist", "api_integration_expert"],
    pattern="broadcast"
)
```

### 4. Query Analyzer Enhanced

**Purpose**: Perform deep analysis of queries for optimal routing and execution

**Syntax**:

```python
query_analyzer_enhanced.analyze(query, history, user_profile=None)
```

**Parameters**:

- `query` (string, required): The query to analyze
- `history` (list, required): Conversation history
- `user_profile` (dict, optional): User preferences and context

**Returns**:

- `query_type`: Classification of query type
- `required_capabilities`: List of required agent capabilities
- `estimated_complexity`: Complexity estimation
- `suggested_approach`: Recommended execution approach

## Step-by-Step Execution Flow

### Step 1: Query Reception

- Receive incoming query from user or system
- Validate query format and basic requirements
- Assign unique query ID for tracking
- Initialize query context and session

### Step 2: Query Analysis

- Use enhanced_parser to extract structured information
- Apply query_analyzer_enhanced for deep analysis
- Identify required expertise domains
- Determine query complexity and routing needs
- Check for multi-agent coordination requirements

### Step 3: Agent Selection

- Query agent registry for available agents
- Match query requirements to agent capabilities
- Use agent_router to determine optimal routing
- Consider agent workload and availability
- Plan execution strategy (sequential/parallel)

### Step 4: Query Distribution

- Prepare agent-specific query formats
- Use cross_agent_communicator to send queries
- Include relevant context for each agent
- Set response timeouts and expectations
- Track message delivery status

### Step 5: Response Collection

- Monitor for agent responses
- Handle partial responses and timeouts
- Validate response formats
- Request clarifications if needed
- Aggregate responses by topic

### Step 6: Response Integration

- Analyze relationships between agent responses
- Resolve any conflicting information
- Merge complementary insights
- Create unified response structure
- Ensure completeness and coherence

### Step 7: Final Formatting

- Format response according to output specifications
- Include routing decisions and rationale
- Add execution metadata
- Provide clear recommendations
- Prepare for user presentation

## Multi-Agent Collaboration Protocols

### Multi-Agent Query Protocol

**When to use**: Queries requiring multiple agent expertise

**Process**:

1. Identify all required agents through analysis
2. Determine dependencies between agent tasks
3. Create execution plan (parallel where possible)
4. Distribute sub-queries with shared context
5. Coordinate inter-agent communication
6. Synthesize results into cohesive response

### Fallback Handling Protocol

**When to use**: Primary agents are unavailable

**Process**:

1. Identify alternative agents with overlapping capabilities
2. Adjust query to match available expertise
3. Route to fallback agents with modified expectations
4. Note limitations in response
5. Suggest follow-up actions

### Context Transfer Protocol

**When to use**: Transferring context between agents during handoffs

**Process**:

1. Package relevant conversation history
2. Include user preferences and constraints
3. Share intermediate results and decisions
4. Maintain session continuity
5. Update shared memory systems

## Error Handling Procedures

### Agent Timeout

**Detection**: Agent fails to respond within expected timeframe

**Response**:

1. Send reminder ping to agent
2. Wait for grace period (30 seconds)
3. Route to alternative agent if available
4. Proceed with partial results if critical
5. Note timeout in response metadata

### Routing Failure

**Detection**: No suitable agents found for query

**Response**:

1. Attempt to decompose query into simpler parts
2. Search for agents with partial capability match
3. Suggest query reformulation to user
4. Provide best-effort response with limitations
5. Log for system improvement

### Conflicting Responses

**Detection**: Agents provide contradictory information

**Response**:

1. Identify specific points of conflict
2. Request clarification from agents
3. Apply conflict resolution rules
4. Present multiple viewpoints if unresolvable
5. Recommend human review if critical

### Context Overflow

**Detection**: Conversation context exceeds manageable size

**Response**:

1. Summarize older context portions
2. Preserve critical decision history
3. Archive detailed history
4. Maintain recent context window
5. Ensure continuity despite compression

## Best Practices

### Efficient Routing

- Prefer single-agent routing when sufficient
- Use parallel execution for independent tasks
- Cache routing decisions for similar queries
- Monitor agent performance metrics
- Balance load across available agents

### Context Preservation

- Update context after each interaction
- Share context updates with relevant agents
- Compress context intelligently
- Preserve decision rationale
- Enable context recovery after errors

### Response Quality

- Validate completeness before responding
- Maintain consistent formatting
- Preserve technical accuracy
- Include confidence indicators
- Provide actionable recommendations

## Example Scenarios

### Scenario 1: Simple Single-Agent Query

```
User: "How do I format Python code with Black?"
Action: Route directly to python_expert
Response: Single agent response with formatting instructions
```

### Scenario 2: Complex Multi-Agent Project

```
User: "Create a secure API with Python, deploy to AWS, and set up CI/CD"
Action: Route to python_expert, architecture_expert, security_specialist, github_workflow_expert
Response: Integrated plan covering all aspects with step-by-step implementation guide
```

### Scenario 3: Ambiguous Query Requiring Clarification

```
User: "Make it faster"
Action: Analyze context, identify performance_optimization_expert, request clarification
Response: Ask user to specify what needs optimization, provide common optimization areas
```
