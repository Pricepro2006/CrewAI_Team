Smart Search Filter Implementation - Phased Workflow Approach
Phase 1: Analysis and Architecture Review
bash# 1. Analyze current implementation and create comprehensive report
/multi-agent-review "Review Walmart Grocery Agent filter implementation - analyze category filter buttons (Produce, Dairy, Meat & Seafood, Bakery, On Sale) in WalmartGroceryAgent.tsx, check backend filter support in walmart-grocery.router.ts, and identify missing state management"

# 2. Smart debug to understand the current data flow
/smart-debug "Debug why Walmart filter buttons don't filter results - trace click handlers on category buttons, check filter state propagation, analyze searchProducts procedure filter logic"

# 3. Save current project context
/context-save "Pre-filter-implementation state - Walmart grocery agent with non-functional filter buttons"
Phase 2: Design and Planning
bash# 4. Design the filter architecture
/design "Design filter system for Walmart grocery agent - create category mapping constants, design useWalmartFilters hook for state management, plan filter application logic for frontend and backend integration"

# 5. API design for filter support
/api-scaffold "Enhance searchProducts procedure - add category filter parameters, implement WHERE clause builders for category_path and department filtering, handle On Sale special case with price comparison"
Phase 3: Implementation - Backend First
bash# 6. Database optimization
/data-pipeline "Create indexes for Walmart products filtering - add composite index on category_path and department, add price comparison index for On Sale filter, optimize query performance"

# 7. Backend implementation using smart-fix
/smart-fix "Fix Walmart searchProducts procedure to support category filtering - modify walmart-grocery.router.ts to parse filter parameters, implement SQL WHERE clauses for category filtering, handle On Sale price comparison logic"

# 8. Validate backend changes
/test-harness "Test Walmart grocery filter backend - verify searchProducts accepts category filters, test filter SQL generation, validate On Sale price comparison logic"
Phase 4: Implementation - Frontend
bash# 9. Create filter management hook and constants
/feature-development "Create Walmart filter system - implement useWalmartFilters hook, create walmart-categories.ts constants file, add filter state management logic"

# 10. Fix the component implementation
/smart-fix "Fix WalmartGroceryAgent.tsx filter buttons - add onClick handlers to filter buttons, integrate useWalmartFilters hook, apply filters to search results, update button styling for active state"

# 11. Ensure type safety
/code-migrate "Update TypeScript types for Walmart filters - add filter types to walmart-grocery.ts, ensure type safety for filter parameters, update component props interfaces"
Phase 5: Integration and Testing
bash# 12. Multi-agent optimization
/multi-agent-optimize "Optimize Walmart filter implementation - review filter performance, optimize re-renders on filter changes, ensure smooth UX transitions"

# 13. Comprehensive testing
/test-harness "Create comprehensive tests for Walmart filters - test filter toggle functionality, verify multiple filter combinations, test All Categories behavior, validate On Sale filter logic"

# 14. Accessibility audit
/accessibility-audit "Audit Walmart filter buttons accessibility - ensure keyboard navigation, add ARIA labels, verify screen reader compatibility"
Phase 6: Documentation and Finalization
bash# 15. Generate documentation
/doc-generate "Document Walmart filter implementation - API changes for searchProducts, useWalmartFilters hook usage, filter category mappings, testing guidelines"

# 16. Final review
/full-review "Review complete Walmart filter implementation - verify all requirements met, check code quality, validate performance, ensure backward compatibility"

# 17. Save final context
/context-save "Post-filter-implementation - Walmart grocery agent with functional category filters"
Phase 7: Deployment Preparation
bash# 18. Security scan
/security-scan "Scan Walmart filter implementation for vulnerabilities - check SQL injection risks in filter queries, validate input sanitization"

# 19. Deploy checklist
/deploy-checklist "Prepare Walmart filter feature for deployment - migration scripts for indexes, feature flags if needed, rollback plan"
Alternative Approach - Single Workflow Commands
If you prefer a more automated approach with less granular control:
bash# Option 1: Full feature development workflow
/full-stack-feature "Implement Walmart grocery filter buttons - add category filtering (Produce, Dairy, Meat & Seafood, Bakery) and On Sale filter to search functionality with frontend state management and backend query support"

# Option 2: Smart fix for the entire issue
/smart-fix "Fix non-functional Walmart grocery filter buttons - implement complete filtering system including frontend click handlers, state management hook, backend query modifications, and database optimizations"

# Option 3: Performance-focused implementation
/performance-optimization "Optimize Walmart grocery search with working filters - implement efficient category filtering with proper indexes, minimize re-renders, optimize query performance"
Execution Notes