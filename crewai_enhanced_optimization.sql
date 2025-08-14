-- Optimization Script for CrewAI Enhanced
-- Generated: 2025-08-12T18:14:36.847687

-- Optimize database settings for production
PRAGMA journal_mode = WAL;  -- Enable Write-Ahead Logging
PRAGMA synchronous = NORMAL;  -- Balance durability and performance
PRAGMA cache_size = -64000;  -- 64MB cache
PRAGMA temp_store = MEMORY;  -- Use memory for temp tables
PRAGMA mmap_size = 268435456;  -- 256MB memory map
PRAGMA busy_timeout = 10000;  -- 10 second timeout
PRAGMA foreign_keys = ON;  -- Enforce foreign keys

-- Create recommended indexes
-- Common search: name with stock filter
CREATE INDEX idx_walmart_products_name_in_stock ON walmart_products(name, in_stock);

-- Category browse with price sort
CREATE INDEX idx_walmart_products_category_path_current_price ON walmart_products(category_path, current_price);

-- Brand filtering within departments
CREATE INDEX idx_walmart_products_brand_department ON walmart_products(brand, department);

-- Update statistics for query optimizer
ANALYZE;

-- Defragment database (high fragmentation detected)
VACUUM;