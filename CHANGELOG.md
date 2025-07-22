# Changelog

All notable changes to the AI Agent Team Framework project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Git hooks with Husky for automated code quality checks on commit
- Lint-staged configuration for formatting and linting staged files
- Claude hooks configuration for AI-assisted development workflows
- Comprehensive GitHub Actions CI/CD pipeline with multiple jobs:
  - Linting and type checking
  - Unit and integration tests
  - Security scanning with Trivy
  - E2E tests with Playwright
  - Build verification
  - PR validation workflows
- Real Ollama integration testing framework:
  - Test helpers for Ollama service management
  - Model pulling and availability checks
  - Timeout handling for LLM operations
  - Integration test setup with real models
- Integration tests for MasterOrchestrator with real Ollama
- Integration tests for ResearchAgent with real web operations
- Proper test configuration separating unit and integration tests
- Test utilities for database and request mocking

### Changed

- Updated vitest configuration to support both unit and integration tests
- Modified package.json test scripts for proper test execution
- Enhanced test infrastructure to use real Ollama instead of mocks
- Improved test timeout settings for LLM operations

### Fixed

- Test script commands in package.json
- ESM module resolution in test environments

## [1.0.0] - 2025-01-15

### Added

- Initial production implementation replacing all mock servers
- Complete MasterOrchestrator with real Ollama integration
- Functional agent implementations:
  - ResearchAgent with web search and content analysis
  - CodeAgent with generation and optimization
  - DataAnalysisAgent with data processing
  - WriterAgent with content creation
  - ToolExecutorAgent with tool integration
- Full tool implementations:
  - WebSearchTool with DuckDuckGo integration
  - WebScraperTool with Cheerio
  - FileSystemTool with safe operations
  - CodeExecutorTool with sandboxing
- RAG system with ChromaDB integration
- SQLite database with better-sqlite3
- Comprehensive error handling and logging
- Memory management and context handling

### Infrastructure

- TypeScript-based architecture
- tRPC for type-safe API communication
- React frontend with Vite
- Express backend
- Ollama for local LLM inference
- Winston for logging
- PM queue for task management

### Documentation

- Comprehensive CLAUDE.md for AI assistance
- Production migration plan
- README with setup instructions
- Inline code documentation
