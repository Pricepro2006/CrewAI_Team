# CrewAI to App.db Migration Plan: Full Claude-Level Analysis

## Executive Summary

This plan outlines the migration of 33,797 emails from crewai.db to app.db with proper multi-stage Claude-level analysis. The goal is to transform basic categorized emails into deeply analyzed business intelligence.

## Current State

### crewai.db (Source)
- **Emails**: 33,797 in emails_enhanced table
- **Analysis**: Basic categorization only (Order Processing, Quote Management, etc.)
- **Entities**: None extracted (0 records in email_entities)
- **Workflow**: No workflow state tracking

### app.db (Target)
- **Emails**: 77 with deep analysis
- **Analysis**: Multi-stage with workflow states, entities, context
- **Architecture**: Separate email_analysis table with 40+ analysis fields
- **Quality**: Claude-level insights with business context

## Migration Strategy

### Phase 1: Infrastructure Preparation (Day 1)

1. **Backup Both Databases**
   ```bash
   cp data/crewai.db data/crewai.db.backup.$(date +%Y%m%d)
   cp data/app.db data/app.db.backup.$(date +%Y%m%d)
   ```

2. **Create Migration Tracking Table**
   ```sql
   CREATE TABLE migration_progress (
       batch_id INTEGER PRIMARY KEY,
       source_count INTEGER,
       migrated_count INTEGER,
       analyzed_count INTEGER,
       status TEXT,
       started_at TIMESTAMP,
       completed_at TIMESTAMP
   );
   ```

3. **Prepare Analysis Pipeline**
   - Verify email_analysis table schema
   - Create analysis queue system
   - Set up batch processing infrastructure

### Phase 2: Email Migration (Day 1-2)

1. **Extract Emails from crewai.db**
   - Export in batches of 1,000 emails
   - Preserve all metadata and categories
   - Map crewai.db fields to app.db schema

2. **Import to app.db**
   - Use transaction batches for safety
   - Generate unique graph_ids
   - Maintain referential integrity

3. **Verification**
   - Confirm all 33,797 emails migrated
   - Validate data integrity
   - Check for duplicates

### Phase 3: Multi-Stage Analysis Pipeline (Day 2-5)

#### Stage 1: Quick Analysis (Automated)
- **Workflow Detection**: Identify email lifecycle stage
- **Priority Assessment**: Critical, High, Medium, Low
- **Intent Classification**: Request, Information, Action Required
- **Urgency Scoring**: Based on keywords and patterns

#### Stage 2: Entity Extraction (Automated)
- **Business Entities**:
  - PO Numbers (PO#, BO#, SO#, LYPO#)
  - Quote Numbers (FTQ-*, Q-*-*, F5Q-*)
  - SKUs and Part Numbers
  - Company Names
  - Contact Information
- **Relationship Mapping**: Link entities across emails

#### Stage 3: Deep Analysis (LLM-Powered)
- **Contextual Understanding**: Generate summaries
- **Action Item Extraction**: What needs to be done
- **SLA Assessment**: Deadline detection
- **Business Impact**: Revenue and satisfaction implications

#### Stage 4: Workflow Integration
- **State Assignment**: NEW, IN_PROGRESS, WAITING, COMPLETE
- **Process Mapping**: Link to business workflows
- **Bottleneck Detection**: Identify stuck processes
- **Chain Analysis**: Connect related emails

### Phase 4: Quality Assurance (Day 5-6)

1. **Sampling Validation**
   - Random sample 1% (338 emails)
   - Manual review of analysis quality
   - Adjust patterns if needed

2. **Metrics Verification**
   - Entity extraction accuracy
   - Workflow state distribution
   - Category mapping consistency

3. **Performance Testing**
   - Dashboard load times
   - Query performance
   - Analytics calculations

## Implementation Scripts

### 1. Migration Script (migrate_crewai_to_app.py)
```python
#!/usr/bin/env python3
"""
Migrates emails from crewai.db to app.db
Preserves all metadata and prepares for analysis
"""
- Connect to both databases
- Batch processing (1,000 emails/batch)
- Progress tracking
- Error handling and rollback
```

### 2. Quick Analysis Script (quick_email_analysis.py)
```python
#!/usr/bin/env python3
"""
Stage 1: Quick analysis for workflow, priority, intent
Uses pattern matching and keyword analysis
"""
- Process all migrated emails
- Apply workflow detection rules
- Assign priorities based on urgency indicators
- Update email_analysis table
```

### 3. Entity Extraction Script (extract_email_entities.py)
```python
#!/usr/bin/env python3
"""
Stage 2: Extract business entities using regex patterns
Patterns refined through 6 iterations (90% accuracy)
"""
- Extract PO/Quote/SKU numbers
- Identify companies and contacts
- Create entity relationships
- Populate entity fields
```

### 4. Deep Analysis Script (deep_email_analysis.py)
```python
#!/usr/bin/env python3
"""
Stage 3: LLM-powered deep analysis
Generates context, actions, and business insights
"""
- Batch emails for LLM processing
- Generate contextual summaries
- Extract action items
- Assess business impact
```

### 5. Workflow Mapping Script (map_email_workflows.py)
```python
#!/usr/bin/env python3
"""
Stage 4: Connect emails to business workflows
Identify chains and bottlenecks
"""
- Group related emails
- Assign workflow states
- Detect process bottlenecks
- Update workflow metrics
```

## Timeline

### Week 1
- **Day 1**: Infrastructure setup and migration start
- **Day 2**: Complete migration, begin quick analysis
- **Day 3**: Entity extraction
- **Day 4**: Deep analysis processing
- **Day 5**: Workflow mapping
- **Day 6**: Quality assurance
- **Day 7**: Final verification and go-live

## Success Criteria

1. **Migration Completeness**: 100% of 33,797 emails migrated
2. **Analysis Coverage**: 95%+ emails with complete analysis
3. **Entity Extraction**: 90%+ accuracy (matching previous iterations)
4. **Workflow Mapping**: All emails assigned appropriate states
5. **Performance**: Dashboard loads in <2 seconds
6. **Quality**: Sample validation shows Claude-level insights

## Risk Mitigation

1. **Data Loss**: Full backups before migration
2. **Analysis Errors**: Staged rollout with validation
3. **Performance Issues**: Batch processing and indexing
4. **LLM Costs**: Use local models where possible
5. **Downtime**: Run migration during off-hours

## Post-Migration

1. **Monitoring**
   - Track analysis quality metrics
   - Monitor dashboard performance
   - Collect user feedback

2. **Continuous Improvement**
   - Refine analysis patterns
   - Update workflow mappings
   - Enhance entity extraction

3. **Documentation**
   - Update all technical docs
   - Create user guides
   - Document lessons learned

## Conclusion

This migration will transform 33,797 basically categorized emails into a rich business intelligence resource with Claude-level analysis, providing actionable insights for TD SYNNEX's email workflow management.