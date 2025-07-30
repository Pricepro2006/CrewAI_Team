# Contributing to CrewAI Team Enterprise Application

Thank you for your interest in contributing to the CrewAI Team Enterprise Application! This document provides guidelines and information for contributors.

## 🎯 Project Mission

We are migrating from static/hardcoded data to a fully dynamic, real-time enterprise application. Our goal is to eliminate all mock data and create a production-ready system with real-time email analytics and Walmart grocery data integration.

## 📋 Current Migration Status

This project is actively undergoing a **Static to Dynamic Data Migration** following our [Bulletproof Implementation Checklist](../master_knowledge_base/bulletproof_implementation_checklist_2025.md).

### Active Migration Phases:
- **Phase 1**: Infrastructure Foundation (Days 1-14)
- **Phase 2**: Email Dashboard Migration (Days 15-28)
- **Phase 3**: Walmart Agent Migration (Days 29-42)
- **Phase 4**: Real-Time Infrastructure (Days 43-56)

## 🚀 Getting Started

### Prerequisites
- **Node.js**: 18.x or higher
- **npm**: 9.x or higher
- **Git**: Latest version
- **SQLite**: For database operations
- **Redis**: For caching (optional for development)

### Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/pricepro2006/CrewAI_Team.git
   cd CrewAI_Team
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Initialize the database**:
   ```bash
   npm run init-db
   ```

5. **Start development server**:
   ```bash
   npm run dev
   ```

6. **Run tests**:
   ```bash
   npm test
   ```

## 🔄 Development Workflow

### Git Workflow
We use **GitHub Flow** with the following branches:
- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/*`: Feature development branches
- `hotfix/*`: Critical bug fixes

### Branch Naming Convention
- `feature/phase1-email-analytics-service`
- `feature/phase2-remove-hardcoded-stats`
- `feature/phase3-walmart-search-integration`
- `hotfix/critical-search-bug`
- `docs/update-api-documentation`

### Commit Message Format
We use **Conventional Commits**:

```
type(scope): description

feat(email): implement real-time analytics service
fix(walmart): resolve search result accuracy issue
docs(api): update endpoint documentation
refactor(ui): optimize dashboard component rendering
test(integration): add BrightData API tests
```

Valid types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`, `revert`

## 🧪 Testing Requirements

### Test Coverage Standards
- **Unit Tests**: 90%+ coverage required
- **Integration Tests**: All API endpoints must be tested
- **End-to-End Tests**: Critical user workflows must be covered

### Test Commands
```bash
npm run test:unit          # Unit tests
npm run test:integration   # Integration tests
npm run test:e2e          # End-to-end tests
npm run test:coverage     # Coverage report
```

### Testing Guidelines
1. **Mock External Dependencies**: Use mocks for BrightData API, database calls
2. **Test Real Data Flows**: Ensure tests verify actual data processing
3. **Performance Testing**: API responses <500ms, UI interactions <2s
4. **Error Scenarios**: Test all error conditions and edge cases

## 📊 Code Quality Standards

### TypeScript Standards
- **Strict Mode**: Enabled in `tsconfig.json`
- **Type Safety**: No `any` types allowed
- **Interface Definitions**: All data structures must be typed
- **Error Handling**: Proper error types and handling

### ESLint Configuration
- **React Hooks**: Follow hooks rules
- **Import Order**: Organize imports consistently
- **Accessibility**: Follow a11y best practices
- **Performance**: Avoid unnecessary re-renders

### Code Review Checklist

#### Migration-Specific Requirements
- [ ] **No Hardcoded Data**: Verify no static/mock data introduced
- [ ] **Real Data Integration**: Confirm actual API/database usage
- [ ] **Error Handling**: Proper loading states and error boundaries
- [ ] **Performance**: Response times within acceptable limits
- [ ] **Type Safety**: Full TypeScript compliance

#### General Requirements
- [ ] **Tests**: Unit and integration tests included
- [ ] **Documentation**: Code comments and API docs updated
- [ ] **Security**: Input validation and sanitization
- [ ] **Accessibility**: WCAG 2.1 AA compliance
- [ ] **Performance**: No performance regressions

## 🎯 Priority Areas for Contributions

### High Priority (Critical Path)
1. **Replace Mock Functions**: Remove all `mockSearch`, hardcoded stats
2. **Database Integration**: Connect UI components to real data
3. **BrightData Integration**: Implement actual Walmart product searches
4. **Real-Time Features**: WebSocket implementation for live updates

### Medium Priority
1. **Performance Optimization**: Query optimization, caching strategies
2. **Error Handling**: Comprehensive error states and recovery
3. **Testing**: Expand test coverage for edge cases
4. **Documentation**: API documentation and user guides

### Low Priority (Post-Migration)
1. **UI Enhancements**: Advanced filtering, sorting features
2. **Analytics**: Advanced reporting and insights
3. **Mobile Optimization**: Responsive design improvements
4. **Integrations**: Additional data sources and APIs

## 🔒 Security Guidelines

### Data Security
- **Input Validation**: Sanitize all user inputs
- **SQL Injection**: Use parameterized queries
- **XSS Prevention**: Sanitize displayed data
- **API Security**: Implement rate limiting and authentication

### Code Security
- **Dependencies**: Keep dependencies updated
- **Secrets**: Never commit API keys or credentials
- **Environment Variables**: Use `.env` files for configuration
- **Audit**: Run `npm audit` regularly

## 📝 Documentation Standards

### Code Documentation
- **JSDoc Comments**: All public functions and classes
- **Type Definitions**: Comprehensive interface documentation
- **Examples**: Include usage examples in comments
- **Error Documentation**: Document all possible error conditions

### API Documentation
- **OpenAPI/Swagger**: Keep API documentation current
- **Request/Response Examples**: Include real data examples
- **Error Codes**: Document all error responses
- **Authentication**: Document required authentication

## 🚦 Pull Request Process

### Before Creating a PR
1. **Sync with develop**: `git pull origin develop`
2. **Run all tests**: `npm test`
3. **Lint and format**: `npm run lint && npm run format`
4. **Build successfully**: `npm run build`
5. **Manual testing**: Test your changes thoroughly

### PR Requirements
1. **Fill out PR template** completely
2. **Link related issues** using GitHub keywords
3. **Include screenshots** for UI changes
4. **Request appropriate reviewers**
5. **Ensure CI checks pass**

### Review Process
1. **Automated Checks**: All CI checks must pass
2. **Code Review**: At least 1 approval required for develop, 2 for main
3. **Migration Alignment**: Changes must align with migration plan
4. **Quality Gates**: Must pass phase-specific quality criteria

## 🐛 Issue Reporting

### Bug Reports
Use the bug report template and include:
- **Reproduction Steps**: Clear, step-by-step instructions
- **Environment Details**: OS, browser, Node.js version
- **Expected vs Actual**: What should happen vs what happens
- **Impact Assessment**: How many users affected, severity level

### Feature Requests
Use the feature request template and include:
- **Problem Statement**: What problem does this solve?
- **Proposed Solution**: Detailed description of the feature
- **Migration Alignment**: Which phase does this belong to?
- **Acceptance Criteria**: Specific requirements for completion

## 📞 Getting Help

### Resources
- **Documentation**: Check `/docs` and `/master_knowledge_base`
- **Code Examples**: See existing implementations for patterns
- **Migration Plan**: Reference the bulletproof implementation checklist
- **Test Examples**: Look at existing tests for patterns

### Communication
- **Issues**: Use GitHub issues for bug reports and feature requests
- **Discussions**: Use GitHub discussions for questions and ideas
- **Code Review**: Use PR comments for code-specific discussions

## 🎖️ Recognition

Contributors who help with the migration effort will be recognized in:
- **CHANGELOG.md**: All contributions documented
- **README.md**: Major contributors listed
- **Commit History**: Proper attribution maintained
- **Release Notes**: Significant contributions highlighted

## 📚 Learning Resources

### Project-Specific Knowledge
- [Migration Plan](../master_knowledge_base/static_to_dynamic_data_migration_plan_2025.md)
- [Implementation Checklist](../master_knowledge_base/bulletproof_implementation_checklist_2025.md)
- [Functionality Test Report](../master_knowledge_base/functionality_test_report_2025_01_26.md)

### Technical Resources
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Documentation](https://react.dev/)
- [tRPC Documentation](https://trpc.io/)
- [SQLite Documentation](https://sqlite.org/docs.html)

## 📋 Checklist for New Contributors

- [ ] Read this contributing guide completely
- [ ] Set up development environment
- [ ] Run tests to ensure setup is correct
- [ ] Read the migration plan and current phase status
- [ ] Pick an appropriate issue or create a feature request
- [ ] Create a feature branch with proper naming
- [ ] Make changes following code quality standards
- [ ] Add/update tests for your changes
- [ ] Update documentation as needed
- [ ] Create a pull request using the template
- [ ] Respond to code review feedback promptly

---

Thank you for contributing to the CrewAI Team Enterprise Application! Your efforts help us create a robust, real-time system that serves our users effectively. 🚀