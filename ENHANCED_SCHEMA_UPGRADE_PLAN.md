# Enhanced Schema Upgrade Plan

## Overview

This document outlines the plan to upgrade from the current production schema (21 tables) to the enhanced schema (22+ tables) that includes advanced features like workflow states, agent management, and comprehensive analytics.

## Current State vs Enhanced State

### Current Production Schema (21 tables)
- Basic email storage and analysis
- Simple workflow patterns
- Limited agent tracking
- Basic analytics capabilities

### Enhanced Schema (22+ tables)
- Advanced workflow state management
- Comprehensive agent and task tracking
- Enhanced email categorization
- Full audit trail and event logging
- Integrated deal and customer management
- Advanced analytics and reporting

## Upgrade Strategy

### Phase 1: Pre-Migration Preparation (1-2 hours)

1. **Full Database Backup**
   ```bash
   sqlite3 data/app.db ".backup data/app.db.pre-enhanced.backup"
   ```

2. **Migration Testing Environment**
   - Copy production database to test environment
   - Run migration scripts in test
   - Validate data integrity
   - Performance testing

3. **Dependency Check**
   - Ensure all services support new schema
   - Update TypeScript interfaces
   - Review API endpoints

### Phase 2: Schema Migration (2-3 hours)

1. **Add New Columns to Existing Tables**
   ```sql
   -- Add workflow columns to emails table
   ALTER TABLE emails ADD COLUMN workflow_state TEXT DEFAULT 'pending';
   ALTER TABLE emails ADD COLUMN workflow_type TEXT;
   ALTER TABLE emails ADD COLUMN priority TEXT DEFAULT 'medium';
   ALTER TABLE emails ADD COLUMN status TEXT DEFAULT 'yellow';
   ```

2. **Create New Tables**
   - agents
   - agent_tasks
   - agent_executions
   - agent_task_dependencies
   - events
   - audit_logs
   - settings
   - api_keys

3. **Migrate Workflow Data**
   ```sql
   -- Move workflow data from email_analysis to emails
   UPDATE emails 
   SET 
     workflow_state = ea.workflow_state,
     workflow_type = ea.quick_workflow,
     priority = ea.quick_priority
   FROM email_analysis ea
   WHERE emails.id = ea.email_id;
   ```

### Phase 3: Service Updates (1-2 hours)

1. **Update DatabaseManager**
   - Switch from basic to enhanced implementation
   - Enable repository pattern
   - Activate advanced features

2. **Update EmailStorageService**
   - Use new workflow columns
   - Enable agent integration
   - Activate event logging

3. **Update Frontend Components**
   - Utilize new schema fields
   - Enable advanced filtering
   - Show agent assignments

### Phase 4: Data Validation (1 hour)

1. **Integrity Checks**
   ```sql
   -- Verify no data loss
   SELECT COUNT(*) FROM emails;
   SELECT COUNT(*) FROM email_analysis;
   SELECT COUNT(*) FROM emails WHERE workflow_state IS NOT NULL;
   ```

2. **Performance Testing**
   - Query performance benchmarks
   - Index optimization
   - Connection pool testing

3. **Feature Testing**
   - Workflow transitions
   - Agent task creation
   - Analytics accuracy

## Migration Script

```bash
#!/bin/bash
# enhanced_schema_migration.sh

echo "Starting Enhanced Schema Migration..."

# 1. Backup current database
sqlite3 data/app.db ".backup data/app.db.$(date +%Y%m%d_%H%M%S).backup"

# 2. Run migration SQL
sqlite3 data/app.db < src/database/schema/migration_to_enhanced.sql

# 3. Migrate workflow data
sqlite3 data/app.db < src/database/schema/migrate_workflow_data.sql

# 4. Create indexes
sqlite3 data/app.db < src/database/schema/enhanced_indexes.sql

# 5. Verify migration
node src/scripts/verify_enhanced_migration.js

echo "Migration completed!"
```

## Benefits of Upgrade

### Immediate Benefits
1. **Workflow State in Emails Table**: Faster queries, no joins needed
2. **Agent Management**: Track AI agent performance and tasks
3. **Audit Trail**: Complete history of all actions
4. **Enhanced Analytics**: Deeper insights into email patterns

### Future Capabilities
1. **Multi-Agent Collaboration**: Agents can work together
2. **Advanced Automation**: Rule-based workflow triggers
3. **Integration Ready**: ChromaDB vector search
4. **Scalability**: Repository pattern for growth

## Risk Mitigation

### Rollback Plan
1. Keep backup of current database
2. Maintain compatibility layer for 30 days
3. Feature flags for gradual rollout
4. Automated rollback script ready

### Testing Strategy
1. Unit tests for all repositories
2. Integration tests for workflows
3. Performance regression tests
4. User acceptance testing

## Timeline

- **Week 1**: Testing and preparation
- **Week 2**: Migration execution (off-hours)
- **Week 3**: Monitoring and optimization
- **Week 4**: Full feature activation

## Success Criteria

1. Zero data loss during migration
2. Query performance maintained or improved
3. All existing features continue working
4. New features accessible and functional
5. No downtime during business hours

## Next Steps

1. Review and approve plan
2. Schedule migration window
3. Prepare rollback procedures
4. Notify stakeholders
5. Execute migration

## Conclusion

The enhanced schema upgrade will unlock significant capabilities while maintaining backward compatibility. The phased approach ensures minimal risk and allows for validation at each step.