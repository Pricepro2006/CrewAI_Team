-- Test data for Walmart comprehensive tests

-- Insert sample products
INSERT OR IGNORE INTO products (id, name, price, category, store, availability, created_at) VALUES
('walmart_test_001', 'Test Bananas Organic', 2.98, 'Produce', 'walmart', true, datetime('now')),
('walmart_test_002', 'Test Milk Whole 1 Gallon', 4.12, 'Dairy', 'walmart', true, datetime('now')),
('walmart_test_003', 'Test Bread Whole Wheat', 3.24, 'Bakery', 'walmart', true, datetime('now')),
('walmart_test_004', 'Test Chicken Breast 1lb', 5.98, 'Meat', 'walmart', true, datetime('now')),
('walmart_test_005', 'Test Rice Brown 2lb', 3.67, 'Pantry', 'walmart', false, datetime('now'));

-- Insert sample price history
INSERT OR IGNORE INTO price_history (product_id, price, date_recorded, store) VALUES
('walmart_test_001', 2.50, datetime('now', '-30 days'), 'walmart'),
('walmart_test_001', 2.75, datetime('now', '-15 days'), 'walmart'),
('walmart_test_001', 2.98, datetime('now'), 'walmart'),
('walmart_test_002', 3.98, datetime('now', '-30 days'), 'walmart'),
('walmart_test_002', 4.05, datetime('now', '-15 days'), 'walmart'),
('walmart_test_002', 4.12, datetime('now'), 'walmart');

-- Insert sample user preferences
INSERT OR IGNORE INTO user_preferences (user_id, category, budget_limit, notifications_enabled) VALUES
('test_user', 'Produce', 50.00, true),
('test_user', 'Dairy', 30.00, true),
('test_user', 'Bakery', 20.00, false);

-- Create sample cart items
INSERT OR IGNORE INTO cart_items (user_id, product_id, quantity, added_at) VALUES
('test_user', 'walmart_test_001', 3, datetime('now')),
('test_user', 'walmart_test_002', 1, datetime('now')),
('test_user', 'walmart_test_003', 2, datetime('now'));

-- Create sample grocery lists
INSERT OR IGNORE INTO grocery_lists (id, user_id, name, created_at, is_active) VALUES
('test_list_001', 'test_user', 'Weekly Groceries', datetime('now'), true),
('test_list_002', 'test_user', 'Party Supplies', datetime('now'), false);

-- Add items to grocery lists
INSERT OR IGNORE INTO grocery_list_items (list_id, product_id, quantity, is_completed) VALUES
('test_list_001', 'walmart_test_001', 4, false),
('test_list_001', 'walmart_test_002', 1, true),
('test_list_001', 'walmart_test_004', 2, false);

-- Create sample price alerts
INSERT OR IGNORE INTO price_alerts (user_id, product_id, target_price, is_active, created_at) VALUES
('test_user', 'walmart_test_001', 2.50, true, datetime('now')),
('test_user', 'walmart_test_002', 3.50, true, datetime('now')),
('test_user', 'walmart_test_004', 5.00, false, datetime('now'));

COMMIT;
