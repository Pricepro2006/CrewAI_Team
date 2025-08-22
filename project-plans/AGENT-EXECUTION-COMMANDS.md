# Agent Execution Commands - Parallel Debugging Implementation
**Date:** 2025-08-22
**Purpose:** Ready-to-execute commands for parallel debugging with double-review

## 🚀 Quick Start: Execute All Phases

### Phase 1: Parallel Initial Debug (Execute all 4 simultaneously)

```bash
# Terminal 1: typescript-pro agent
Task agent --type typescript-pro --prompt "
Fix TypeScript errors in files 1-40:
- src/api/middleware/*.ts (10 files)
- src/api/routes/*.ts (10 files) 
- src/api/services/*.ts (10 files)
- src/api/validation/*.ts (10 files)

Focus on: TS2339, TS2345, TS2322 errors
Fix complex types, generics, interfaces
Remove ALL mock/placeholder data
Update file-tracking.json after each file
Do NOT work on other agents' files
"

# Terminal 2: error-resolution-specialist agent
Task agent --type error-resolution-specialist --prompt "
Fix runtime and undefined errors in files 41-80:
- src/core/**/*.ts (15 files)
- src/database/**/*.ts (15 files)
- src/shared/**/*.ts (10 files)

Focus on: undefined types, mock data, runtime errors
Replace ALL placeholder code with real implementations
Fix null/undefined handling
Update file-tracking.json after each file
Do NOT work on other agents' files
"

# Terminal 3: debugger agent
Task agent --type debugger --prompt "
Debug logic issues in files 81-120:
- src/ui/components/**/*.tsx (20 files)
- src/ui/hooks/**/*.ts (10 files)
- src/ui/pages/**/*.tsx (10 files)

Focus on: React errors, hooks, state management
Fix component logic and event handlers
Ensure proper TypeScript in TSX
Update file-tracking.json after each file
Do NOT work on other agents' files
"

# Terminal 4: code-reviewer agent
Task agent --type code-reviewer --prompt "
Review and fix quality issues in files 121-157:
- src/test/**/*.test.ts (15 files)
- src/microservices/**/*.ts (12 files)
- src/config/**/*.ts (10 files)

Focus on: test errors, security, patterns
Fix anti-patterns and vulnerabilities
Ensure best practices
Update file-tracking.json after each file
Do NOT work on other agents' files
"
```

### Phase 2: Cross-Review Process (After Phase 1 completes)

```bash
# Review agents - Execute as files complete in Phase 1

# For files completed by typescript-pro → reviewed by code-reviewer
Task agent --type code-reviewer --prompt "
Second review of files 1-40 after typescript-pro fixes:
Check for remaining TypeScript errors
Find missed mock/placeholder data
Verify logic and security
Fix any issues found
Update file-tracking.json with review metrics
"

# For files completed by error-resolution-specialist → reviewed by typescript-pro  
Task agent --type typescript-pro --prompt "
Second review of files 41-80 after error-resolution-specialist fixes:
Verify type safety and interfaces
Check for runtime error potential
Ensure no mock data remains
Fix any issues found
Update file-tracking.json with review metrics
"

# For files completed by debugger → reviewed by error-resolution-specialist
Task agent --type error-resolution-specialist --prompt "
Second review of files 81-120 after debugger fixes:
Check for undefined behavior
Verify error handling
Ensure production-ready code
Fix any issues found
Update file-tracking.json with review metrics
"

# For files completed by code-reviewer → reviewed by debugger
Task agent --type debugger --prompt "
Second review of files 121-157 after code-reviewer fixes:
Verify logic flow
Check for edge cases
Ensure proper error handling
Fix any issues found
Update file-tracking.json with review metrics
"
```

### Phase 3: Documentation (Sequential - After all reviews)

```bash
# Documentation agent
Task agent --type docs-architect --prompt "
Document all debugging work from file-tracking.json:

1. Create comprehensive debugging report with:
   - Files fixed by each agent
   - Error counts before/after each phase
   - Types of issues resolved
   - Double-review findings

2. Update documentation:
   - README.md with current project state
   - CHANGELOG.md with all fixes
   - docs/DEBUGGING-REPORT-$(date +%Y-%m-%d).md with full details
   - Claude memory with learnings and patterns

3. Generate PDR (Problem Detection Report):
   - Root cause analysis of errors
   - Prevention strategies
   - Architectural improvements needed
   - Lessons learned

Output location: docs/parallel-debug-results/
"
```

### Phase 4: Version Control (Sequential - After documentation)

```bash
# Git version control agent
Task agent --type git-version-control-expert --prompt "
Commit all debugging work with proper version control:

1. Review all changes from parallel agents
2. Create atomic commits by category:
   - fix(types): Resolve TypeScript errors in API layer
   - fix(runtime): Fix runtime errors in core services
   - fix(ui): Repair React component issues
   - fix(tests): Fix test suite failures
   
3. For each commit include:
   - Detailed message with metrics
   - Files affected
   - Errors fixed count
   - Agents involved

4. Create release tag: v1.1.0-parallel-debug-complete
5. Generate comprehensive PR description
6. Include before/after metrics in PR body

Ensure commit history is clean and traceable
"
```

## 📊 Monitoring Commands

### Real-time Progress Tracking

```bash
# Monitor file completion
watch -n 5 'jq ".phase1_agents | to_entries | .[] | {agent: .key, completed: .value.completed | length, total: .value.assigned | length}" file-tracking.json'

# Monitor error reduction
watch -n 10 'echo "TypeScript Errors: $(npm run typecheck 2>&1 | grep error | wc -l)"'

# Monitor specific agent progress
tail -f agent-typescript-pro.log
tail -f agent-error-resolution.log
tail -f agent-debugger.log
tail -f agent-code-reviewer.log
```

### Validation Commands

```bash
# After Phase 1
npm run typecheck 2>&1 | tee phase1-complete.txt
echo "Phase 1 Errors: $(grep error phase1-complete.txt | wc -l)"

# After Phase 2
npm run typecheck 2>&1 | tee phase2-complete.txt
echo "Phase 2 Errors: $(grep error phase2-complete.txt | wc -l)"

# Final validation
npm run build && npm run test && echo "✅ All systems operational"
```

## 🎯 Single Command Execution (Advanced)

### Execute all Phase 1 agents in parallel with single command:

```bash
# Create and execute parallel debugging script
cat > parallel-debug.sh << 'EOF'
#!/bin/bash

echo "🚀 Starting Parallel Debug Process..."

# Initialize tracking
cat > file-tracking.json << 'JSON'
{
  "start_time": "$(date -Iseconds)",
  "phase1_agents": {
    "typescript-pro": {"assigned": [], "completed": [], "errors_fixed": 0},
    "error-resolution-specialist": {"assigned": [], "completed": [], "errors_fixed": 0},
    "debugger": {"assigned": [], "completed": [], "errors_fixed": 0},
    "code-reviewer": {"assigned": [], "completed": [], "errors_fixed": 0}
  },
  "phase2_reviews": {},
  "completion_status": "in_progress"
}
JSON

# Capture baseline
npm run typecheck 2>&1 > baseline-errors.txt
BASELINE_ERRORS=$(grep -c error baseline-errors.txt)
echo "Baseline TypeScript errors: $BASELINE_ERRORS"

# Launch all agents in parallel
(
  Task agent --type typescript-pro --prompt "..." > typescript-pro.log 2>&1 &
  Task agent --type error-resolution-specialist --prompt "..." > error-specialist.log 2>&1 &
  Task agent --type debugger --prompt "..." > debugger.log 2>&1 &
  Task agent --type code-reviewer --prompt "..." > code-reviewer.log 2>&1 &
  wait
)

echo "✅ Phase 1 Complete - Starting Cross-Review..."

# Phase 2: Cross-review (simplified for single command)
Task agent --type code-reviewer --prompt "Review typescript-pro files..." &
Task agent --type typescript-pro --prompt "Review error-specialist files..." &
Task agent --type error-resolution-specialist --prompt "Review debugger files..." &
Task agent --type debugger --prompt "Review code-reviewer files..." &
wait

echo "✅ Phase 2 Complete - Starting Documentation..."

# Phase 3: Documentation
Task agent --type docs-architect --prompt "Document all changes..."

# Phase 4: Git
Task agent --type git-version-control-expert --prompt "Commit all changes..."

# Final validation
npm run typecheck 2>&1 > final-errors.txt
FINAL_ERRORS=$(grep -c error final-errors.txt)
echo "Final TypeScript errors: $FINAL_ERRORS"
echo "Errors fixed: $((BASELINE_ERRORS - FINAL_ERRORS))"

echo "🎉 Parallel Debug Process Complete!"
EOF

chmod +x parallel-debug.sh
./parallel-debug.sh
```

## ✅ Checklist for Execution

### Before Starting
- [ ] Git branch created and current work backed up
- [ ] file-tracking.json initialized
- [ ] All agent terminals ready
- [ ] Baseline metrics captured

### During Phase 1
- [ ] All 4 agents running in parallel
- [ ] No file overlap occurring
- [ ] Progress being tracked
- [ ] Logs being generated

### During Phase 2
- [ ] Review agents started as files complete
- [ ] Double-review coverage tracked
- [ ] Issues from first pass being fixed
- [ ] Metrics being updated

### After Completion
- [ ] All files reviewed twice
- [ ] Documentation generated
- [ ] Git commits created properly
- [ ] PR ready for review
- [ ] Zero errors achieved

## 🔧 Troubleshooting

### If an agent fails:
```bash
# Check agent log
tail -100 agent-[name].log

# Restart specific agent with remaining files
Task agent --type [agent-type] --prompt "Continue from file X..."
```

### If errors increase:
```bash
# Rollback to last good state
git reset --hard HEAD
# Review what went wrong
git diff HEAD~1
```

### If tracking gets corrupted:
```bash
# Backup current tracking
cp file-tracking.json file-tracking.backup.json
# Rebuild from logs
grep "Completed:" *.log > completion-status.txt
```

---

**Note:** These commands are designed for immediate execution. Simply copy and paste into terminals to begin the parallel debugging process.

**Critical:** Ensure all agents complete their assigned files before moving to Phase 2 cross-review.