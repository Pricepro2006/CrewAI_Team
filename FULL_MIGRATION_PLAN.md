# Full IEMS Migration Plan - 141,075 Emails

## Objective
Complete migration of all 141,075 analyzed emails from IEMS to the Unified Email Dashboard.

## Pre-Migration Checklist

### 1. System Requirements
- [ ] Disk space: ~3GB available (verified)
- [ ] Database backup created
- [ ] Server resources available for processing
- [ ] No critical operations running

### 2. Code Preparation
- [ ] Remove artificial 100-file limit in migration script
- [ ] Add progress reporting for large dataset
- [ ] Implement batch commits for performance
- [ ] Add error recovery mechanism

### 3. Data Validation
- [ ] Verify source data availability (141,075 emails)
- [ ] Check analysis files integrity
- [ ] Confirm database schema compatibility
- [ ] Test connection to both databases

## Migration Steps

### Phase 1: Script Updates (5 minutes)
1. Remove limit from `direct_migration.py` line 226
2. Add progress reporting every 1000 emails
3. Implement batch commits every 500 records
4. Add comprehensive error logging

### Phase 2: Full Migration Execution (2-3 hours)
1. Clear any test data from previous runs
2. Run updated migration script
3. Monitor progress and performance
4. Track any errors or warnings

### Phase 3: Data Verification (30 minutes)
1. Verify total email count matches source
2. Check workflow state distribution
3. Validate email analysis completeness
4. Test search and filter functionality

### Phase 4: Performance Optimization (30 minutes)
1. Create additional indexes if needed
2. Update database statistics
3. Optimize query performance
4. Test dashboard responsiveness

## Success Metrics

1. **Email Count**: 141,075 emails imported
2. **Analysis Records**: Matching analysis for each email
3. **Zero Data Loss**: All fields preserved
4. **Performance**: Dashboard loads in <2 seconds
5. **Search**: Full-text search works across all emails

## Risk Mitigation

1. **Backup**: Full database backup before migration
2. **Rollback Plan**: Script to remove migrated data if needed
3. **Monitoring**: Real-time progress tracking
4. **Error Recovery**: Resume from last successful batch

## Post-Migration Tasks

1. Update dashboard statistics
2. Verify all views display correctly
3. Test workflow analytics with full dataset
4. Document any performance considerations
5. Create user guide for new features

## Timeline

- **Total Duration**: 3-4 hours
- **Active Monitoring**: First 30 minutes critical
- **Completion Target**: Today

Let's proceed with the migration!