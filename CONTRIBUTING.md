# Contributing to CrewAI Team

Thank you for your interest in contributing to the CrewAI Team project! This guide will help you get started with contributing code, particularly for tool and agent development.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Tool Development](#tool-development)
- [Agent Development](#agent-development)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Code Review Checklist](#code-review-checklist)

## Code of Conduct

We are committed to providing a welcoming and inspiring community for all. Please read and follow our code of conduct:

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Respect differing viewpoints and experiences

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/yourusername/CrewAI_Team.git
   cd CrewAI_Team
   ```
3. Add the upstream remote:
   ```bash
   git remote add upstream https://github.com/pricepro2006/CrewAI_Team.git
   ```
4. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Setup

1. Ensure you have Node.js 20.11+ installed
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```
4. Start local services:
   ```bash
   docker-compose up -d postgres redis
   npm run db:migrate
   ```
5. Start development server:
   ```bash
   npm run dev
   ```

## Tool Development

### Tool Development Checklist

Before creating a new tool, ensure you follow these requirements:

- [ ] **Extends ValidatedTool Base Class**

  ```typescript
  import { ValidatedTool } from "@/core/tools/base/ValidatedTool";

  export class MyNewTool extends ValidatedTool {
    // Implementation
  }
  ```

- [ ] **Implements Required Methods**

  ```typescript
  async validateExecution(params: any): Promise<ValidationResult> {
    // Validate input parameters
    if (!params.query) {
      return { valid: false, message: 'Query is required' };
    }
    return { valid: true };
  }

  async performExecution(params: any): Promise<any> {
    // Actual tool logic here
  }

  getTimeout(): number {
    return DEFAULT_TIMEOUTS.TOOL_EXECUTION;
  }
  ```

- [ ] **Proper Timeout Handling**

  ```typescript
  import { withTimeout, DEFAULT_TIMEOUTS } from '@/utils/timeout';

  async performExecution(params: any): Promise<any> {
    return await withTimeout(
      this.actualExecution(params),
      this.getTimeout(),
      `${this.name} timed out`
    );
  }
  ```

- [ ] **Fallback Mechanism for External Dependencies**

  ```typescript
  async performExecution(params: any): Promise<any> {
    try {
      return await this.primaryMethod(params);
    } catch (primaryError) {
      console.warn(`Primary method failed: ${primaryError.message}`);
      try {
        return await this.fallbackMethod(params);
      } catch (fallbackError) {
        console.warn(`Fallback failed: ${fallbackError.message}`);
        return this.getMockResults(params);
      }
    }
  }
  ```

- [ ] **Comprehensive Error Handling**

  ```typescript
  async handleExecutionError(error: Error): Promise<ToolResult> {
    if (error.message.includes('timeout')) {
      return this.error('Operation timed out. Please try again.');
    }
    if (error.message.includes('network')) {
      return this.error('Network error. Using cached results.');
    }
    return this.error(`Unexpected error: ${error.message}`);
  }
  ```

- [ ] **Unit Tests**

  ```typescript
  describe("MyNewTool", () => {
    it("should handle successful execution", async () => {
      const tool = new MyNewTool();
      const result = await tool.execute({ query: "test" });
      expect(result.success).toBe(true);
    });

    it("should handle timeout gracefully", async () => {
      // Test timeout scenario
    });

    it("should use fallback when primary fails", async () => {
      // Test fallback mechanism
    });
  });
  ```

- [ ] **Documentation in Tool Registry**

  ```typescript
  // src/core/tools/registry.ts
  export const TOOL_REGISTRY = {
    myNewTool: {
      name: "MyNewTool",
      description: "Brief description of what the tool does",
      capabilities: ["capability1", "capability2"],
      requirements: ["external_api_key"],
      timeout: DEFAULT_TIMEOUTS.TOOL_EXECUTION,
    },
  };
  ```

- [ ] **Agent Integration Testing**
      If the tool will be used by agents, test the integration:
  ```typescript
  describe("Agent with MyNewTool", () => {
    it("should process tool results correctly", async () => {
      const agent = new TestAgent();
      const result = await agent.executeWithTool({
        tool: { name: "myNewTool" },
        context: { task: "test task" },
        parameters: { query: "test" },
      });
      expect(result.output).toContain("processed");
    });
  });
  ```

### Common Tool Patterns

1. **External API Tools**
   - Always implement retry logic
   - Use exponential backoff
   - Cache successful responses
   - Document API limitations

2. **Data Processing Tools**
   - Validate data schema
   - Handle large datasets efficiently
   - Implement streaming when possible
   - Clear error messages for data issues

3. **Integration Tools**
   - Use dependency injection
   - Abstract external services
   - Implement health checks
   - Monitor connection status

## Agent Development

### Agent Development Requirements

When creating agents that use tools:

1. **Override executeWithTool if Processing Needed**

   ```typescript
   class MyAgent extends BaseAgent {
     async executeWithTool(params: ToolExecutionParams): Promise<AgentResult> {
       const { tool, context } = params;

       // Check if this tool needs processing
       if (this.requiresProcessing(tool.name)) {
         const toolResult = await tool.execute(params.parameters);

         // Process the results through agent logic
         const processed = await this.processToolResult(toolResult, context);
         return this.formatAgentResponse(processed);
       }

       // Delegate to base for simple tools
       return super.executeWithTool(params);
     }
   }
   ```

2. **Document Tool Dependencies**
   ```typescript
   class MyAgent extends BaseAgent {
     getRequiredTools(): string[] {
       return ["web_search", "data_analysis"];
     }

     getOptionalTools(): string[] {
       return ["cache", "metrics"];
     }
   }
   ```

## Testing Requirements

### Test Coverage Requirements

- Minimum 80% code coverage
- All public methods must have tests
- Error paths must be tested
- Integration tests for agent-tool combinations

### Test Structure

```
src/
├── core/
│   ├── tools/
│   │   ├── MyNewTool.ts
│   │   └── MyNewTool.test.ts
│   └── agents/
│       ├── MyAgent.ts
│       └── MyAgent.test.ts
└── test/
    ├── integration/
    │   └── agent-tool-integration.test.ts
    └── e2e/
        └── full-workflow.test.ts
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test MyNewTool.test.ts

# Run with coverage
npm run test:coverage

# Run integration tests
npm run test:integration
```

## Pull Request Process

1. **Before Creating PR**
   - [ ] All tests pass: `npm test`
   - [ ] Linting passes: `npm run lint`
   - [ ] Type checking passes: `npm run typecheck`
   - [ ] Build succeeds: `npm run build`
   - [ ] Documentation updated

2. **PR Description Template**

   ```markdown
   ## Description

   Brief description of changes

   ## Type of Change

   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## Testing

   - [ ] Unit tests pass
   - [ ] Integration tests pass
   - [ ] Manual testing completed

   ## Checklist

   - [ ] Code follows project style
   - [ ] Self-review completed
   - [ ] Comments added for complex logic
   - [ ] Documentation updated
   - [ ] No new warnings
   ```

3. **Review Process**
   - At least one approval required
   - All CI checks must pass
   - No merge conflicts
   - Documentation reviewed

## Code Review Checklist

When reviewing PRs, check for:

### Tool Integration

- [ ] Tool extends ValidatedTool
- [ ] Timeout handling implemented
- [ ] Fallback mechanism present
- [ ] Error messages are helpful
- [ ] Tests cover success and failure cases

### Agent Integration

- [ ] executeWithTool override if needed
- [ ] Tool results properly processed
- [ ] Context maintained correctly
- [ ] Response formatting consistent

### General Code Quality

- [ ] TypeScript types properly defined
- [ ] No use of `any` without justification
- [ ] Error handling comprehensive
- [ ] Logging at appropriate levels
- [ ] Performance considerations addressed

### Documentation

- [ ] Code comments for complex logic
- [ ] README updated if needed
- [ ] API documentation current
- [ ] Examples provided for new features

## Getting Help

- **Discord**: Join our development channel
- **Issues**: Check existing issues or create new ones
- **Discussions**: Use GitHub Discussions for questions
- **Email**: dev-team@crewai.team

## Recognition

Contributors will be recognized in:

- Release notes
- Contributors list
- Monthly community highlights

Thank you for contributing to CrewAI Team! 🚀
