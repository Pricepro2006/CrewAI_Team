-- Migration Script 02: Transform Data to Email Dashboard Format
-- Purpose: Transform parsed analysis data into Email Dashboard schema

-- NOTE: This migration assumes the unified schema has already been created
-- If not, run 01_create_migration_tables.sql first

-- Transform analysis results to emails table
INSERT INTO emails (
    graph_id,
    message_id,
    email_alias,
    requested_by,
    subject,
    summary,
    status,
    status_text,
    workflow_state,
    workflow_type,
    priority,
    received_date,
    thread_id,
    conversation_id,
    is_read,
    has_attachments,
    processed_flag
)
SELECT 
    -- Generate unique IDs
    'IEMS_' || mat.batch_id as graph_id,
    'MSG_' || mat.batch_id as message_id,
    
    -- Email alias mapping based on workflow type
    CASE 
        WHEN mat.primary_focus LIKE '%Quote%' THEN 'InsightHPI@tdsynnex.com'
        WHEN mat.primary_focus LIKE '%Order%' THEN 'InsightOrderSupport@tdsynnex.com'
        WHEN mat.primary_focus LIKE '%Surface%' THEN 'US.InsightSurface@tdsynnex.com'
        WHEN mat.primary_focus LIKE '%Renewal%' THEN 'Insight3@tdsynnex.com'
        ELSE 'Team4401@tdsynnex.com'
    END as email_alias,
    
    -- Requested by from customer name or first participant
    COALESCE(
        mat.customer_name,
        (SELECT participant_name FROM migration_participants_temp 
         WHERE batch_id = mat.batch_id AND participant_type = 'customer' LIMIT 1),
        'Unknown Requester'
    ) as requested_by,
    
    -- Subject from primary focus
    COALESCE(mat.primary_focus, 'Email Batch ' || mat.batch_number) as subject,
    
    -- Summary from workflow analysis
    SUBSTR(
        'Workflow: ' || mat.workflow_state || ' - ' || 
        COALESCE(mat.primary_focus, 'Processing') || '. ' ||
        'Priority: ' || COALESCE(mat.urgency_level, 'Medium') || ', ' ||
        'Impact: ' || COALESCE(mat.business_impact, 'Normal'),
        1, 500
    ) as summary,
    
    -- Status mapping
    COALESCE(sm.target_status, 'yellow') as status,
    COALESCE(sm.target_status_text, 'In Progress') as status_text,
    
    -- Workflow state mapping
    CASE
        WHEN mat.workflow_state LIKE '%Started%' THEN 'START_POINT'
        WHEN mat.workflow_state LIKE '%Progress%' OR mat.workflow_state LIKE '%Processing%' THEN 'IN_PROGRESS'
        WHEN mat.workflow_state LIKE '%Completed%' OR mat.workflow_state LIKE '%Resolved%' THEN 'COMPLETION'
        ELSE 'IN_PROGRESS'
    END as workflow_state,
    
    -- Workflow type from mapping
    COALESCE(wm.target_workflow, 'General Support') as workflow_type,
    
    -- Priority mapping
    CASE
        WHEN mat.urgency_level = 'Critical' OR mat.urgency_level = 'Urgent' THEN 'Critical'
        WHEN mat.urgency_level = 'High' THEN 'High'
        WHEN mat.urgency_level = 'Low' THEN 'Low'
        ELSE 'Medium'
    END as priority,
    
    -- Date from analysis date
    datetime(mat.analysis_date) as received_date,
    
    -- Thread/conversation IDs
    'THREAD_' || mat.batch_number as thread_id,
    'CONV_' || mat.batch_number as conversation_id,
    
    -- Default values
    0 as is_read,
    CASE WHEN EXISTS (
        SELECT 1 FROM migration_entities_temp 
        WHERE batch_id = mat.batch_id AND entity_type = 'attachment'
    ) THEN 1 ELSE 0 END as has_attachments,
    1 as processed_flag
    
FROM migration_analysis_temp mat
LEFT JOIN migration_status_mapping sm ON mat.workflow_state = sm.source_state
LEFT JOIN migration_workflow_mapping wm ON mat.primary_focus LIKE '%' || wm.source_workflow || '%'
WHERE mat.processed = 0;

-- Insert email entities
INSERT INTO email_entities (email_id, entity_type, entity_value, entity_format, confidence)
SELECT 
    e.id,
    met.entity_type,
    met.entity_value,
    met.entity_context,
    1.0
FROM migration_entities_temp met
JOIN emails e ON e.graph_id = 'IEMS_' || met.batch_id;

-- Insert recipients based on participants
INSERT INTO email_recipients (email_id, recipient_type, name, email_address)
SELECT 
    e.id,
    CASE 
        WHEN mpt.participant_type = 'customer' THEN 'to'
        ELSE 'cc'
    END as recipient_type,
    mpt.participant_name,
    COALESCE(mpt.participant_email, mpt.participant_name || '@unknown.com')
FROM migration_participants_temp mpt
JOIN emails e ON e.graph_id = 'IEMS_' || mpt.batch_id
WHERE mpt.participant_email IS NOT NULL OR mpt.participant_name IS NOT NULL;

-- Insert workflow actions from action items
INSERT INTO workflow_actions (email_id, action_type, action_details, performed_by, performed_at)
SELECT 
    e.id,
    'action_item' as action_type,
    json_object(
        'description', mait.description,
        'priority', mait.priority,
        'deadline', mait.deadline,
        'status', mait.status
    ) as action_details,
    COALESCE(mait.owner, 'System'),
    datetime('now')
FROM migration_action_items_temp mait
JOIN emails e ON e.graph_id = 'IEMS_' || mait.batch_id;

-- Create analysis results
INSERT INTO email_analysis (
    email_id,
    quick_workflow_primary,
    quick_workflow_secondary,
    quick_priority,
    quick_intent,
    quick_urgency,
    quick_confidence,
    deep_analysis,
    action_items,
    analyzed_at
)
SELECT 
    e.id,
    mat.primary_focus,
    '[]' as quick_workflow_secondary,
    mat.urgency_level,
    'Business Request' as quick_intent,
    mat.urgency_level,
    0.95,
    mat.raw_json,
    (
        SELECT json_group_array(
            json_object(
                'description', description,
                'owner', owner,
                'priority', priority,
                'status', status
            )
        )
        FROM migration_action_items_temp
        WHERE batch_id = mat.batch_id
    ),
    datetime(mat.analysis_date)
FROM migration_analysis_temp mat
JOIN emails e ON e.graph_id = 'IEMS_' || mat.batch_id;

-- Update migration tracking
UPDATE migration_analysis_temp SET processed = 1 WHERE processed = 0;

-- Update dashboard statistics
INSERT INTO dashboard_stats (
    stat_date,
    total_emails,
    red_count,
    yellow_count,
    green_count,
    start_point_count,
    in_progress_count,
    completion_count,
    critical_count,
    high_count,
    medium_count,
    low_count
)
SELECT 
    date('now'),
    COUNT(*),
    SUM(CASE WHEN status = 'red' THEN 1 ELSE 0 END),
    SUM(CASE WHEN status = 'yellow' THEN 1 ELSE 0 END),
    SUM(CASE WHEN status = 'green' THEN 1 ELSE 0 END),
    SUM(CASE WHEN workflow_state = 'START_POINT' THEN 1 ELSE 0 END),
    SUM(CASE WHEN workflow_state = 'IN_PROGRESS' THEN 1 ELSE 0 END),
    SUM(CASE WHEN workflow_state = 'COMPLETION' THEN 1 ELSE 0 END),
    SUM(CASE WHEN priority = 'Critical' THEN 1 ELSE 0 END),
    SUM(CASE WHEN priority = 'High' THEN 1 ELSE 0 END),
    SUM(CASE WHEN priority = 'Medium' THEN 1 ELSE 0 END),
    SUM(CASE WHEN priority = 'Low' THEN 1 ELSE 0 END)
FROM emails
WHERE date(created_at) = date('now');

-- Log completion
INSERT INTO migration_log (migration_step, status, records_processed)
SELECT 
    'transform_to_dashboard',
    'completed',
    COUNT(*)
FROM emails
WHERE graph_id LIKE 'IEMS_%';