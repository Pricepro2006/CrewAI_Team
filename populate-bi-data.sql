INSERT OR IGNORE INTO email_entities_bi (email_id, entity_type, entity_value, source_field)
SELECT 
    email_id,
    'po_number',
    entities_po_numbers,
    'extracted_entities'
FROM email_analysis 
WHERE entities_po_numbers IS NOT NULL AND entities_po_numbers != '';

INSERT OR IGNORE INTO email_entities_bi (email_id, entity_type, entity_value, source_field)
SELECT 
    email_id,
    'quote_number',
    entities_quote_numbers,
    'extracted_entities'
FROM email_analysis 
WHERE entities_quote_numbers IS NOT NULL AND entities_quote_numbers != '';

INSERT OR IGNORE INTO email_entities_bi (email_id, entity_type, entity_value, source_field)
SELECT 
    email_id,
    'case_number',
    entities_case_numbers,
    'extracted_entities'
FROM email_analysis 
WHERE entities_case_numbers IS NOT NULL AND entities_case_numbers != '';

INSERT OR IGNORE INTO email_entities_bi (email_id, entity_type, entity_value, source_field)
SELECT 
    email_id,
    'part_number',
    entities_part_numbers,
    'extracted_entities'
FROM email_analysis 
WHERE entities_part_numbers IS NOT NULL AND entities_part_numbers != '';