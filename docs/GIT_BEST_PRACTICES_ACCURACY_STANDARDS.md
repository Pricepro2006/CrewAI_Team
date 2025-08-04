# Git Best Practices - Accuracy Standards

## Purpose
This document establishes mandatory practices to prevent false claims, ensure accuracy, and maintain project integrity in all git operations.

## 🚨 CRITICAL RULES

### 1. Verification-First Principle
**NEVER commit claims about completed work without verification**

- ✅ **Before claiming completion**: Run tests, verify functionality, check database states
- ✅ **Before claiming deployment**: Verify services are running and processing data
- ✅ **Before claiming statistics**: Query actual data sources for real numbers
- ❌ **Never commit**: Aspirational or projected completion states as if they're real

### 2. Evidence-Based Documentation
**All completion claims must include verifiable evidence**

Required evidence for different claim types:
- **Processing Claims**: Database queries showing actual processed records
- **LLM Integration**: Actual API call logs and response samples
- **Performance Claims**: Actual benchmark results and timing data
- **Deployment Claims**: Service status verification and health checks

### 3. Commit Message Standards

#### ✅ Good Commit Messages (Accurate)
```
feat: implement email consolidation framework
- Add consolidation scripts for multi-source email import
- Create database schema for enhanced email storage
- Scripts tested with 143,850 real emails successfully

docs: document current architecture design
- Add Phase 1-3 processing pipeline specification
- Include database schema and API designs
- Note: Implementation still pending LLM integration
```

#### ❌ Bad Commit Messages (False Claims)
```
feat: deploy Claude Opus-level email processing ❌
- Complete LLM integration with 60+ emails/minute ❌  
- Business intelligence extraction operational ❌
- Production-ready deployment successful ❌
```

### 4. Branch Naming Conventions

#### Implementation Phases
- `feat/design-[feature]` - Architecture and design work
- `feat/implement-[feature]` - Actual implementation
- `feat/test-[feature]` - Testing and validation
- `feat/deploy-[feature]` - Production deployment

#### Cleanup and Fixes
- `fix/[specific-issue]` - Bug fixes and corrections
- `cleanup/[what-being-cleaned]` - Removing false claims or outdated code
- `refactor/[component]` - Code improvements without feature changes

### 5. Documentation Standards

#### Required Sections for Status Documents
```markdown
## ✅ VERIFIED COMPLETED (with evidence)
- List only tested, working functionality
- Include verification method used
- Provide links to evidence (database queries, test results)

## 🚧 IN PROGRESS (honest assessment)
- Current work status
- Realistic completion timeline
- Dependencies and blockers

## ❌ NOT STARTED (clear about what's missing)
- Features designed but not implemented
- Components that need development
- Integration work still required
```

## 🔧 WORKFLOW PROCEDURES

### Pre-Commit Checklist
Before committing ANY work claiming completion:

1. **[ ] Functional Verification**
   - Run relevant tests and verify they pass
   - Check database states match claims
   - Verify services are actually running if claimed

2. **[ ] Documentation Accuracy**
   - Ensure all statistics are from real data queries
   - Verify all "completed" features actually work
   - Include evidence for all performance claims

3. **[ ] Future-Proofing**
   - Use "design" or "framework" language for unimplemented work
   - Clearly separate completed vs planned work
   - Include realistic next steps and timelines

### Branch Protection Rules

#### Main Branch Protection
- Require pull request reviews for main branch
- Require status checks to pass
- Require evidence documentation for completion claims
- No direct pushes to main branch

#### Feature Branch Workflow
```
1. Create feature branch: feat/implement-[specific-feature]
2. Implement and test functionality
3. Document actual results with evidence
4. Create pull request with verification checklist
5. Review for accuracy before merge
```

### Code Review Requirements

#### Mandatory Review Checklist
- [ ] **Accuracy Verification**: Do completion claims match actual functionality?
- [ ] **Evidence Provided**: Are statistics and metrics from real sources?
- [ ] **Testing Completed**: Has the work been functionally tested?
- [ ] **Documentation Accurate**: Does documentation reflect actual state?

#### Review Rejection Criteria
- Claims of completion without functional evidence
- Statistics that cannot be verified from actual data
- Documentation that misrepresents project state
- Commits mixing aspirational content with actual work

## 🎯 QUALITY GATES

### Definition of "Complete"
A feature is only "complete" when:
- [ ] All code is implemented and tested
- [ ] All tests pass consistently
- [ ] Documentation accurately reflects functionality
- [ ] Performance meets specified requirements
- [ ] Integration with other components verified

### Definition of "Deployed"
A system is only "deployed" when:
- [ ] Services are running in production environment
- [ ] Health checks pass consistently
- [ ] Monitoring and alerting configured
- [ ] Performance metrics meet requirements
- [ ] User acceptance testing completed

### Definition of "Processing X Records"
Processing claims require:
- [ ] Database queries showing actual processed records
- [ ] Logs demonstrating successful processing
- [ ] Error rates within acceptable limits
- [ ] Performance metrics from real processing runs

## 🚨 RECOVERY PROCEDURES

### When False Claims Are Discovered

1. **Immediate Actions**
   - Stop all related development work
   - Create cleanup branch: `cleanup/remove-false-[issue]`
   - Document actual vs claimed state
   - Remove or correct false claims

2. **Documentation Updates**
   - Create accurate status document
   - Clearly separate completed vs planned work
   - Include evidence for all completion claims
   - Document lessons learned

3. **Process Improvements**
   - Review how false claims occurred
   - Update verification procedures
   - Implement additional quality gates
   - Train team on accuracy standards

## 📊 MONITORING AND ACCOUNTABILITY

### Regular Audits
- Monthly review of completion claims vs actual functionality
- Quarterly verification of deployment and processing claims
- Annual assessment of project accuracy standards

### Metrics to Track
- Percentage of commits with verified completion claims
- Time between claimed completion and actual deployment
- Number of false claims discovered and corrected
- Team adherence to accuracy standards

---

**Commitment**: These standards are mandatory for all project contributors. Accuracy and honesty in git operations are non-negotiable requirements for project integrity.

**Review Date**: This document should be reviewed and updated quarterly to ensure continued effectiveness.