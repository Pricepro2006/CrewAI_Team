-- Schema Update Script for Email Chain Analysis
-- Optimized for 143k emails with 6%/54%/40% chain distribution

-- Performance indexes for chain analysis and phase routing
DROP INDEX IF EXISTS idx_emails_chain_completeness;
DROP INDEX IF EXISTS idx_emails_phase_routing;
DROP INDEX IF EXISTS idx_emails_workflow_analysis;
DROP INDEX IF EXISTS idx_emails_analysis_status;

-- Chain completeness index for fast phase routing
CREATE INDEX idx_emails_chain_completeness 
ON emails_enhanced(chain_completeness_score, is_chain_complete, chain_type);

-- Phase routing optimization index
CREATE INDEX idx_emails_phase_routing 
ON emails_enhanced(chain_completeness_score, phase_completed, status);

-- Workflow analysis index for business intelligence
CREATE INDEX idx_emails_workflow_analysis 
ON emails_enhanced(workflow_state, chain_completeness_score, confidence_score);

-- Combined analysis status index
CREATE INDEX idx_emails_analysis_status 
ON emails_enhanced(status, phase_completed, analyzed_at);

-- Chain performance index for analytics
CREATE INDEX idx_emails_chain_performance 
ON emails_enhanced(chain_id, chain_completeness_score, workflow_state);

-- Bulk update optimization index
CREATE INDEX idx_emails_bulk_update 
ON emails_enhanced(id, chain_id);

-- Time-based analysis index
CREATE INDEX idx_emails_time_analysis 
ON emails_enhanced(received_date_time, workflow_state, status);

-- Create a summary view for monitoring
CREATE VIEW IF NOT EXISTS email_chain_distribution AS
SELECT 
    CASE 
        WHEN chain_completeness_score >= 0.8 THEN 'complete'
        WHEN chain_completeness_score >= 0.4 THEN 'partial'
        ELSE 'broken'
    END as chain_category,
    CASE 
        WHEN chain_completeness_score >= 0.8 THEN 1  -- Phase 1 (Rule-based)
        WHEN chain_completeness_score >= 0.4 THEN 2  -- Phase 2 (Llama 3.2)
        ELSE 3  -- Phase 3 (Phi-4)
    END as recommended_phase,
    COUNT(*) as email_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM emails_enhanced), 2) as percentage
FROM emails_enhanced 
WHERE chain_completeness_score IS NOT NULL
GROUP BY chain_category, recommended_phase
ORDER BY recommended_phase;

-- Create monitoring query for import progress
CREATE VIEW IF NOT EXISTS import_progress_monitor AS
SELECT 
    COUNT(*) as total_emails,
    COUNT(CASE WHEN chain_id IS NOT NULL THEN 1 END) as emails_with_chain_id,
    COUNT(CASE WHEN chain_completeness_score IS NOT NULL THEN 1 END) as emails_with_completeness_score,
    COUNT(CASE WHEN workflow_state IS NOT NULL THEN 1 END) as emails_with_workflow_state,
    ROUND(COUNT(CASE WHEN chain_completeness_score IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 2) as completion_percentage
FROM emails_enhanced;

-- Vacuum and analyze for optimal performance
VACUUM;
ANALYZE;

-- Display current distribution
SELECT 
    'Schema Update Complete' as status,
    datetime('now') as updated_at;

SELECT * FROM import_progress_monitor;