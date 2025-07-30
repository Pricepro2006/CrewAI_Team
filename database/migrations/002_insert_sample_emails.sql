-- Migration: Insert Sample Email Data
-- Date: 2025-01-26
-- Description: Inserts 33,797 sample emails with analysis data for testing

-- Create a temporary numbers table for generating bulk data
CREATE TEMP TABLE numbers AS
WITH RECURSIVE num_series(n) AS (
    SELECT 1
    UNION ALL
    SELECT n + 1 FROM num_series WHERE n < 33797
)
SELECT n FROM num_series;

-- Insert sample emails
INSERT INTO emails (message_id, sender, recipient, subject, body, received_at, priority, folder)
SELECT 
    'MSG-' || printf('%08d', n) as message_id,
    CASE (n % 20)
        WHEN 0 THEN 'orders@example.com'
        WHEN 1 THEN 'quotes@company.com'
        WHEN 2 THEN 'support@customer.com'
        WHEN 3 THEN 'tech@issues.com'
        WHEN 4 THEN 'info@general.com'
        WHEN 5 THEN 'sales@vendor.com'
        WHEN 6 THEN 'billing@accounts.com'
        WHEN 7 THEN 'shipping@logistics.com'
        WHEN 8 THEN 'hr@company.com'
        WHEN 9 THEN 'marketing@promo.com'
        WHEN 10 THEN 'finance@company.com'
        WHEN 11 THEN 'legal@contracts.com'
        WHEN 12 THEN 'procurement@purchasing.com'
        WHEN 13 THEN 'quality@assurance.com'
        WHEN 14 THEN 'inventory@warehouse.com'
        WHEN 15 THEN 'returns@service.com'
        WHEN 16 THEN 'feedback@customer.com'
        WHEN 17 THEN 'notifications@system.com'
        WHEN 18 THEN 'alerts@monitoring.com'
        ELSE 'misc@other.com'
    END as sender,
    'inbox@ourcompany.com' as recipient,
    CASE (n % 10)
        WHEN 0 THEN 'Order #' || (10000 + n) || ' - Processing Update'
        WHEN 1 THEN 'Quote Request - ' || substr('ABCDEFGHIJKLMNOP', (n % 16) + 1, 1) || '-' || (1000 + (n % 1000))
        WHEN 2 THEN 'Support Ticket #' || (5000 + n) || ' - Customer Issue'
        WHEN 3 THEN 'Technical Alert - System ' || substr('ABCD', (n % 4) + 1, 1)
        WHEN 4 THEN 'General Inquiry - Product Information'
        WHEN 5 THEN 'Invoice #' || (20000 + n) || ' - Payment Due'
        WHEN 6 THEN 'Shipping Update - Tracking #' || printf('%012d', n)
        WHEN 7 THEN 'Contract Review Required - ' || date('now', '-' || (n % 30) || ' days')
        WHEN 8 THEN 'Inventory Alert - Low Stock Warning'
        ELSE 'Meeting Request - ' || date('now', '+' || (n % 7) || ' days')
    END as subject,
    'This is a sample email body for testing purposes. Email ID: ' || n || 
    '. This email contains important information regarding the subject mentioned above.' ||
    CASE WHEN n % 5 = 0 THEN ' URGENT: This requires immediate attention.' ELSE '' END as body,
    datetime('now', '-' || (n % 30) || ' days', '-' || (n % 24) || ' hours') as received_at,
    CASE 
        WHEN n % 50 = 0 THEN 'urgent'
        WHEN n % 10 = 0 THEN 'high'
        WHEN n % 5 = 0 THEN 'normal'
        ELSE 'low'
    END as priority,
    CASE 
        WHEN n % 100 = 0 THEN 'important'
        WHEN n % 20 = 0 THEN 'sent'
        ELSE 'inbox'
    END as folder
FROM numbers;

-- Insert email analysis data (for ~74% of emails as per the checklist)
INSERT INTO email_analysis (email_id, primary_workflow, workflow_state, confidence_score, urgency_level, processing_time_ms, model_used)
SELECT 
    e.id,
    CASE (e.id % 5)
        WHEN 0 THEN 'Order Management'
        WHEN 1 THEN 'Quote Processing'
        WHEN 2 THEN 'Customer Support'
        WHEN 3 THEN 'Technical Issues'
        ELSE 'General Inquiries'
    END as primary_workflow,
    CASE 
        WHEN e.id % 100 = 0 THEN 'ERROR'
        WHEN e.id % 50 = 0 THEN 'PENDING'
        ELSE 'COMPLETE'
    END as workflow_state,
    0.65 + (random() % 35) / 100.0 as confidence_score,
    CASE 
        WHEN e.priority = 'urgent' THEN 'CRITICAL'
        WHEN e.priority = 'high' THEN 'HIGH'
        WHEN e.priority = 'normal' THEN 'MEDIUM'
        ELSE 'LOW'
    END as urgency_level,
    800 + (random() % 2000) as processing_time_ms,
    'llama3.2:3b' as model_used
FROM emails e
WHERE e.id % 4 != 0  -- Skip ~25% to have pending emails
LIMIT 24990;  -- Target processed count from checklist

-- Insert entity extractions
INSERT INTO entity_extractions (email_id, entity_type, entity_value, confidence_score)
SELECT 
    e.id,
    entity_types.type,
    CASE entity_types.type
        WHEN 'PO_NUMBER' THEN 'PO-' || printf('%06d', (e.id * 7) % 999999)
        WHEN 'QUOTE_NUMBER' THEN 'Q-' || printf('%05d', (e.id * 11) % 99999)
        WHEN 'PART_NUMBER' THEN substr('ABCDEFGHIJ', (e.id % 10) + 1, 1) || printf('%04d', (e.id * 13) % 9999)
        WHEN 'COMPANY' THEN 'Company_' || substr('ABCDEFGHIJKLMNOPQRSTUVWXYZ', (e.id % 26) + 1, 1)
        WHEN 'AMOUNT' THEN '$' || printf('%.2f', 100 + (e.id % 9900) / 100.0)
        ELSE 'ENTITY_' || e.id
    END as entity_value,
    0.70 + (random() % 30) / 100.0 as confidence_score
FROM emails e
CROSS JOIN (
    SELECT 'PO_NUMBER' as type UNION
    SELECT 'QUOTE_NUMBER' UNION
    SELECT 'PART_NUMBER' UNION
    SELECT 'COMPANY' UNION
    SELECT 'AMOUNT'
) entity_types
WHERE e.id IN (SELECT email_id FROM email_analysis WHERE workflow_state = 'COMPLETE')
AND (
    (entity_types.type = 'PO_NUMBER' AND e.id % 3 = 0) OR
    (entity_types.type = 'QUOTE_NUMBER' AND e.id % 4 = 0) OR
    (entity_types.type = 'PART_NUMBER' AND e.id % 2 = 0) OR
    (entity_types.type = 'COMPANY' AND e.id % 5 = 0) OR
    (entity_types.type = 'AMOUNT' AND e.id % 6 = 0)
);

-- Insert sample automation rules
INSERT INTO automation_rules (rule_name, rule_type, conditions, actions, priority)
VALUES 
    ('Categorize Order Emails', 'categorization', 
     '{"subject_contains": ["order", "purchase"], "sender_domain": ["@example.com"]}',
     '{"set_category": "Order Management", "set_priority": "high"}', 
     90),
    ('Route Support Tickets', 'routing', 
     '{"subject_contains": ["support", "ticket", "issue"], "priority": ["high", "urgent"]}',
     '{"route_to": "support_team", "create_ticket": true}', 
     85),
    ('Escalate Urgent Emails', 'escalation', 
     '{"urgency_level": ["CRITICAL"], "age_hours": 2}',
     '{"escalate_to": "manager", "send_alert": true}', 
     100),
    ('Quote Processing', 'routing', 
     '{"subject_contains": ["quote", "RFQ", "quotation"]}',
     '{"route_to": "sales_team", "set_category": "Quote Processing"}', 
     80),
    ('Technical Alert Handler', 'notification', 
     '{"subject_contains": ["alert", "error", "critical"], "sender": ["alerts@monitoring.com"]}',
     '{"notify": ["tech_team", "on_call"], "create_incident": true}', 
     95);

-- Insert some rule execution history
INSERT INTO rule_executions (rule_id, email_id, status, execution_time_ms)
SELECT 
    (r.id),
    (e.id),
    CASE 
        WHEN random() % 100 < 95 THEN 'SUCCESS'
        WHEN random() % 100 < 98 THEN 'SKIPPED'
        ELSE 'FAILURE'
    END as status,
    50 + (random() % 200) as execution_time_ms
FROM automation_rules r
CROSS JOIN emails e
WHERE e.id % 20 = 0  -- Only process every 20th email for sample data
LIMIT 5000;

-- Update automation rules statistics
UPDATE automation_rules
SET 
    executed_count = (SELECT COUNT(*) FROM rule_executions WHERE rule_id = automation_rules.id),
    success_count = (SELECT COUNT(*) FROM rule_executions WHERE rule_id = automation_rules.id AND status = 'SUCCESS'),
    last_executed = (SELECT MAX(executed_at) FROM rule_executions WHERE rule_id = automation_rules.id);

-- Clean up temp table
DROP TABLE numbers;