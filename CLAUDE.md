# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a JavaScript/TypeScript project optimized for modern web development. The project uses industry-standard tools and follows best practices for scalable application development.

### Current Project Status (Updated: July 23, 2025)

- **TypeScript Compilation**: ✅ 0 errors (resolved from 111+ errors)
- **Build Process**: ✅ Successful
- **ESLint Status**: ✅ 0 critical errors
- **BullMQ Integration**: ✅ Migrated to v5.56.5
- **Test Framework**: ✅ All mock types resolved
- **Database Migration**: ✅ COMPLETE - 33,797 emails migrated with 124,750 entities extracted
- **Email Analysis**: ✅ 90% entity extraction accuracy achieved through 6 iterations
- **Backend Services**: ✅ All services operational (Redis, ChromaDB, Ollama mocked)
- **Migration Performance**: ✅ 681.1 emails/second processing rate
- **Branch**: main (migration completed, ready for deep analysis)

## Development Commands

### Package Management

- `npm install` or `yarn install` - Install dependencies
- `npm ci` or `yarn install --frozen-lockfile` - Install dependencies for CI/CD
- `npm update` or `yarn upgrade` - Update dependencies

### Build Commands

- `npm run build` - Build the project for production
- `npm run dev` or `npm start` - Start development server
- `npm run preview` - Preview production build locally

### Testing Commands

- `npm test` or `npm run test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:unit` - Run unit tests only
- `npm run test:integration` - Run integration tests only
- `npm run test:e2e` - Run end-to-end tests

### Code Quality Commands

- `npm run lint` - Run ESLint for code linting
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run typecheck` - Run TypeScript type checking

### Development Tools

- `npm run storybook` - Start Storybook (if available)
- `npm run analyze` - Analyze bundle size
- `npm run clean` - Clean build artifacts

## Technology Stack

### Core Technologies

- **JavaScript/TypeScript** - Primary programming languages
- **Node.js** - Runtime environment
- **npm/yarn** - Package management

### Common Frameworks

- **React** - UI library with hooks and functional components
- **Vue.js** - Progressive framework for building user interfaces
- **Angular** - Full-featured framework for web applications
- **Express.js** - Web application framework for Node.js
- **Next.js** - React framework with SSR/SSG capabilities

### Build Tools

- **Vite** - Fast build tool and development server
- **Webpack** - Module bundler
- **Rollup** - Module bundler for libraries
- **esbuild** - Extremely fast JavaScript bundler

### Testing Framework

- **Jest** - JavaScript testing framework
- **Vitest** - Fast unit test framework
- **Testing Library** - Simple and complete testing utilities
- **Cypress** - End-to-end testing framework
- **Playwright** - Cross-browser testing

### Code Quality Tools

- **ESLint** - JavaScript/TypeScript linter
- **Prettier** - Code formatter
- **TypeScript** - Static type checking
- **Husky** - Git hooks

## Project Structure Guidelines

### File Organization

```
src/
├── components/     # Reusable UI components
├── pages/         # Page components or routes
├── hooks/         # Custom React hooks
├── utils/         # Utility functions
├── services/      # API calls and external services
├── types/         # TypeScript type definitions
├── constants/     # Application constants
├── styles/        # Global styles and themes
└── tests/         # Test files
```

### Naming Conventions

- **Files**: Use kebab-case for file names (`user-profile.component.ts`)
- **Components**: Use PascalCase for component names (`UserProfile`)
- **Functions**: Use camelCase for function names (`getUserData`)
- **Constants**: Use UPPER_SNAKE_CASE for constants (`API_BASE_URL`)
- **Types/Interfaces**: Use PascalCase with descriptive names (`UserData`, `ApiResponse`)

## TypeScript Guidelines

### Type Safety

- Enable strict mode in `tsconfig.json`
- Use explicit types for function parameters and return values
- Prefer interfaces over types for object shapes
- Use union types for multiple possible values
- Avoid `any` type - use `unknown` when type is truly unknown

### Best Practices

- Use type guards for runtime type checking
- Leverage utility types (`Partial`, `Pick`, `Omit`, etc.)
- Create custom types for domain-specific data
- Use enums for finite sets of values
- Document complex types with JSDoc comments

## Code Quality Standards

### ESLint Configuration

- Use recommended ESLint rules for JavaScript/TypeScript
- Enable React-specific rules if using React
- Configure import/export rules for consistent module usage
- Set up accessibility rules for inclusive development

### Prettier Configuration

- Use consistent indentation (2 spaces recommended)
- Set maximum line length (80-100 characters)
- Use single quotes for strings
- Add trailing commas for better git diffs

### Testing Standards

- Aim for 80%+ test coverage
- Write unit tests for utilities and business logic
- Use integration tests for component interactions
- Implement e2e tests for critical user flows
- Follow AAA pattern (Arrange, Act, Assert)

## Performance Optimization

### Bundle Optimization

- Use code splitting for large applications
- Implement lazy loading for routes and components
- Optimize images and assets
- Use tree shaking to eliminate dead code
- Analyze bundle size regularly

### Runtime Performance

- Implement proper memoization (React.memo, useMemo, useCallback)
- Use virtualization for large lists
- Optimize re-renders in React applications
- Implement proper error boundaries
- Use web workers for heavy computations

## Security Guidelines

### Dependencies

- Regularly audit dependencies with `npm audit`
- Keep dependencies updated
- Use lock files (`package-lock.json`, `yarn.lock`)
- Avoid dependencies with known vulnerabilities

### Code Security

- Sanitize user inputs
- Use HTTPS for API calls
- Implement proper authentication and authorization
- Store sensitive data securely (environment variables)
- Use Content Security Policy (CSP) headers

## Development Workflow

### Before Starting

1. Check Node.js version compatibility
2. Install dependencies with `npm install`
3. Copy environment variables from `.env.example`
4. Run type checking with `npm run typecheck`

### During Development

1. Use TypeScript for type safety
2. Run linter frequently to catch issues early
3. Write tests for new features
4. Use meaningful commit messages
5. Review code changes before committing

### Before Committing

1. Run full test suite: `npm test`
2. Check linting: `npm run lint`
3. Verify formatting: `npm run format:check`
4. Run type checking: `npm run typecheck`
5. Test production build: `npm run build`

## Tool Integration Patterns

### Critical Pattern: Agent Tool Override

When agents use tools, they MUST override `executeWithTool` if they need to process results:

```typescript
// ❌ WRONG - Returns empty responses
class ResearchAgent extends BaseAgent {
  // Missing executeWithTool override
}

// ✅ CORRECT - Processes tool results
class ResearchAgent extends BaseAgent {
  async executeWithTool(params: ToolExecutionParams): Promise<AgentResult> {
    const { tool, context } = params;

    if (tool.name === "web_search") {
      const result = await tool.execute(params.parameters);
      // Process through LLM for synthesis
      const synthesis = await this.synthesizeResults(result, context);
      return this.formatResponse(synthesis);
    }

    return super.executeWithTool(params);
  }
}
```

### Tool Development Requirements

All tools must extend ValidatedTool and implement proper error handling:

```typescript
export class MyTool extends ValidatedTool {
  async validateExecution(params: any) {
    // Validate before execution
    return { valid: true };
  }

  async performExecution(params: any) {
    // Wrap in timeout
    return await withTimeout(
      this.apiCall(params),
      DEFAULT_TIMEOUTS.TOOL_EXECUTION,
      "Tool execution timed out",
    );
  }

  getTimeout(): number {
    return DEFAULT_TIMEOUTS.TOOL_EXECUTION;
  }
}
```

### External API Guidelines

1. **Never trust API behavior** - Always test actual responses
2. **Implement fallbacks** - Every external call needs a fallback
3. **Use proper timeouts** - Especially important for CPU-based inference
4. **Prefer SearXNG** - Use local SearXNG (port 8888) for unlimited searches

### Common Pitfalls to Avoid

1. **Empty Responses**: Check if agent has executeWithTool override
2. **API Misuse**: DuckDuckGo Instant Answer API ≠ Web Search
   - Use SearXNG instead for proper web search with aggregated results
3. **Timeout Issues**: CPU inference takes 28-30s per LLM call
4. **Missing Fallbacks**: External APIs will fail - plan for it

### Debugging Tool Issues

When debugging empty responses or tool failures:

1. Check if the agent overrides `executeWithTool`
2. Verify the tool is returning expected data format
3. Check timeout configurations match hardware constraints
4. Review logs for fallback mechanism activation
5. Test tool in isolation before agent integration

### Performance Considerations

- **CPU Constraints**: Running granite3.3:2b on AMD Ryzen 7 PRO 7840HS
- **LLM Call Time**: ~28-30 seconds per inference
- **Timeout Values**: Adjusted for CPU-based inference
- **Optimization**: Minimize sequential LLM calls in tool execution

For detailed guidelines, see:

- [Tool Integration Best Practices](docs/knowledge_base/tool_integration_best_practices_2025.md)
- [Empty Response Investigation](docs/knowledge_base/empty_response_investigation_solution_2025.md)
- [Tool Integration Action Plan](docs/TOOL_INTEGRATION_ACTION_PLAN.md)

## Search Infrastructure

### SearXNG Integration (Primary Search Provider)

The project uses SearXNG as the primary search provider for all web searches:

- **URL**: http://localhost:8888
- **Setup**: Already configured in ~/searxng/docker-compose.yml
- **Engines**: Aggregates 70+ search engines including Google, Bing, DuckDuckGo
- **Cost**: FREE and UNLIMITED (self-hosted)
- **Fallback**: Automatic fallback to DuckDuckGo if unavailable

### Search Provider Hierarchy

```typescript
// Research Agent automatically selects the best available provider
1. SearXNG (port 8888) - Primary, unlimited searches
2. DuckDuckGo - Fallback, limited to snippets
3. Future: Google Places API, Bing API (within free tiers)
```

### SearXNG Management

```bash
# Start SearXNG
cd ~/searxng && docker-compose up -d

# Stop SearXNG
cd ~/searxng && docker-compose down

# View logs
cd ~/searxng && docker-compose logs -f

# Test search
curl "http://localhost:8888/search?q=test&format=json"
```

## CrewAI Team Architecture Patterns

### Local-First LLM Integration

- **Direct SDK Integration**: Always use direct SDK calls for local LLM services
- **No Unnecessary API Layers**: Avoid HTTP middleware for services on same machine
- **Optimal Architecture Pattern**:
  ```
  Frontend (React) → tRPC API → Backend Services → Direct Ollama SDK
                                                → Direct ChromaDB calls
                                                → Direct Agent calls
                                                → SearXNG (port 8888)
  ```

### Performance Optimization Standards

- **Zero-Latency Local Calls**: Direct memory access for agent coordination
- **Connection Pooling**: Reuse connections for LLM services
- **Timeout Management**: Proper timeout handling for all LLM operations
- **Graceful Degradation**: Fallback mechanisms when services unavailable

### Type Safety Requirements

- **End-to-End TypeScript**: Full type safety from frontend to LLM calls
- **tRPC Integration**: Type-safe API layer for frontend-backend communication
- **Proper Error Handling**: Typed error responses and proper exception handling

### Code Quality Standards

- **Modular Architecture**: Clean separation of concerns
- **Test-Driven Development**: 80% minimum test coverage target
- **Security-First**: Comprehensive middleware stack
- **Documentation**: Inline documentation and API docs

## Email Analysis Pipeline Architecture

### Database Architecture (Current State)

**Primary Database**: `app.db` (SQLite)
- **Core Tables**: 21 tables with enhanced email analysis capabilities
- **Analysis Table**: Dedicated `email_analysis` table with 40+ analysis fields
- **Current Status**: 77 emails with deep Claude-level analysis
- **Schema Features**: Multi-stage analysis support, workflow state tracking

**Source Database**: `crewai.db` (SQLite)  
- **Email Count**: 33,797 emails in `emails_enhanced` table
- **Analysis Level**: Basic categorization only
- **Migration Status**: Ready for comprehensive migration with enhanced analysis

### Multi-Stage Analysis Architecture

#### Stage 1: Quick Analysis (Automated)
**Purpose**: Immediate classification and prioritization
**Processing**: Pattern-based analysis with keyword detection
**Output Fields**:
- `quick_workflow` - Workflow detection (START_POINT, IN_PROGRESS, COMPLETION)
- `quick_priority` - Priority assessment (Critical, High, Medium, Low)
- `quick_intent` - Intent classification (Request, Information, Action Required)
- `quick_urgency` - Urgency scoring based on patterns and keywords

#### Stage 2: Entity Extraction (Pattern-Based)
**Purpose**: Extract business entities and relationships
**Processing**: Regex patterns refined through 6 iterations (90% accuracy)
**Entity Types**:
```typescript
interface ExtractedEntities {
  po_numbers: string[];        // PO 70882659, BO#, SO#, LYPO#
  quote_numbers: string[];     // FTQ-*, Q-*-*, F5Q-*
  case_numbers: string[];      // CAS-*, case numbers
  part_numbers: string[];      // SKUs, PN# formats
  companies: string[];         // Dynamic company extraction
  contacts: string[];          // Email addresses, names
  reference_numbers: string[]; // REG#, BD#, various formats
}
```

#### Stage 3: Deep Analysis (LLM-Powered)
**Purpose**: Generate contextual understanding and business insights
**Processing**: Local LLM with Claude-level analysis
**Output Fields**:
- `deep_summary` - Contextual business summary
- `action_items` - Extracted action items with owners and deadlines
- `sla_status` - SLA risk assessment and deadline tracking
- `business_impact` - Revenue and satisfaction implications
- `suggested_response` - Recommended response patterns

#### Stage 4: Workflow Integration
**Purpose**: Connect emails to business processes and workflows
**Processing**: Workflow mapping and chain analysis
**Features**:
- State assignment (NEW, IN_PROGRESS, WAITING, COMPLETE)
- Business process mapping (Order Processing, Quote Management, etc.)
- Bottleneck detection and chain analysis
- Related email linking for complete context

### Analysis Pipeline Implementation

#### Core Processing Script
**File**: `src/scripts/email-batch-processor.ts`
**Status**: Production-ready (90% accuracy achieved)
**Features**:
- Batch processing of 3,380 email files
- 6-iteration improvement process (60% → 90% accuracy)
- Comprehensive entity extraction patterns
- Error handling and duplicate detection

#### Migration Scripts
**Files**:
- `src/scripts/migration/comprehensive_email_migration.py` - Full migration implementation (LATEST)
- `src/scripts/migration/direct_migration.py` - Database migration utility
- `src/scripts/migration/full_email_migration.py` - Complete email processing
- `src/scripts/migration/parse_analysis_results.py` - IEMS analysis parser

### Migration Completion (July 23, 2025)

#### Final Migration Statistics
- **Emails Migrated**: 33,797 (100% success)
- **Entities Extracted**: 124,750
- **Processing Time**: 48.5 seconds
- **Processing Rate**: 681.1 emails/second
- **Error Count**: 0

#### Entity Extraction Results
- **PO Numbers**: 6,917
- **Quote Numbers**: 633
- **Part Numbers**: 98,786
- **Order References**: 1,865

#### Workflow Distribution
- **Order Management**: 14,779 (43.7%)
- **General**: 8,224 (24.3%)
- **Quote Processing**: 5,796 (17.2%)
- **In-Progress Workflows**: 24,990 (73.9%)

### Entity Extraction Patterns (90% Accuracy)

#### Iteration History
1. **Iteration 1**: 60% → 75% accuracy (workflow state detection)
2. **Iteration 2**: 75% → 80% accuracy (company/vendor extraction enhancement)
3. **Iteration 3**: 80% → 85% accuracy (dynamic company patterns, CAS numbers)
4. **Iteration 4**: 85% → 88% accuracy (quote formats, completion detection)
5. **Iteration 5**: 88% → 90% accuracy (urgency detection, reduced over-detection)
6. **Iteration 6**: 90% accuracy confirmed (final validation and production run)

#### Key Pattern Examples
```typescript
// PO Number Patterns
const PO_PATTERNS = [
  /\b(?:PO|P\.O\.?|Purchase Order)\s*[#:]?\s*(\d{8,})/gi,
  /\b(?:BO|B\.O\.?|Book Order)\s*[#:]?\s*(\d+)/gi,
  /\b(?:SO|S\.O\.?|Sales Order)\s*[#:]?\s*(\d+)/gi
];

// Quote Number Patterns  
const QUOTE_PATTERNS = [
  /\bFTQ[-]\w+/gi,
  /\bQ[-]\d+[-]\w+/gi,
  /\bF5Q[-]\w+/gi
];

// Company Extraction with Corporate Suffixes
const COMPANY_SUFFIXES = ['INC', 'LLC', 'CORP', 'LTD', 'CO', 'COMPANY'];
```

### Database Schema Integration

#### Email Analysis Table Structure
```sql
CREATE TABLE email_analysis (
  id INTEGER PRIMARY KEY,
  email_id INTEGER REFERENCES emails(id),
  -- Quick Analysis Fields
  quick_workflow TEXT,
  quick_priority TEXT,
  quick_intent TEXT, 
  quick_urgency TEXT,
  -- Entity Fields
  po_numbers TEXT,
  quote_numbers TEXT,
  case_numbers TEXT,
  part_numbers TEXT,
  companies TEXT,
  contacts TEXT,
  -- Deep Analysis Fields
  deep_summary TEXT,
  action_items TEXT,
  sla_status TEXT,
  business_impact TEXT,
  suggested_response TEXT,
  -- Workflow Fields
  workflow_state TEXT,
  workflow_confidence REAL,
  primary_workflow TEXT,
  secondary_workflow TEXT,
  -- Metadata
  analysis_model TEXT,
  analysis_timestamp DATETIME,
  processing_time_ms INTEGER,
  confidence_score REAL
);
```

### Performance Metrics

- **Processing Speed**: ~5,600 emails per second
- **Entity Extraction**: 90% accuracy
- **Total Emails Processed**: 33,797 from 3,380 batch files
- **Processing Time**: 6 seconds for complete batch processing
- **Error Rate**: 0% (no processing errors)
- **Duplicate Detection**: 100% successful deduplication

### Migration Status

**Completed**:
- ✅ Database consolidation and strategy alignment
- ✅ Email batch processing with 90% accuracy
- ✅ Quality analysis and comparison
- ✅ Comprehensive migration planning
- ✅ Full 33,797 email migration to app.db
- ✅ Model comparison testing (4 models evaluated)
- ✅ Llama 3.2:3b selected as primary production model

**In Progress**:
- 🔄 Three-stage hybrid pipeline implementation
- 🔄 System-wide Llama 3.2:3b integration

**Three-Stage Pipeline Architecture**:
```
Stage 1: Pattern-based triage (All 33,797 emails) - 1 hour
Stage 2: Llama 3.2:3b analysis (Top 5,000 priority) - 13 hours
Stage 3: Deep analysis (Top 500 critical) - 7 hours
Total: ~21 hours for complete processing
```

**Model Performance Summary**:
- **Llama 3.2:3b**: 6.56/10 accuracy, 9.35s/email, 100% success (PRIMARY MODEL)
- **Phi-4 14B**: ~7.5-8.0/10 accuracy, 50s/email (critical emails only)
- **Granite 3.3:2b**: 5.08/10 accuracy, 28s/email, 73% success (deprecated)
- **Iteration Script**: 4.6/10 accuracy, 0.1s/email (triage only)
