/**
 * Create Test Products in Walmart Database
 * This script adds test products so we can properly test the CRUD operations
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'data', 'walmart_grocery.db');

console.log('🗄️ Creating test products in Walmart database...');

try {
  const db = new Database(dbPath);
  
  // Create the walmart_products table if it doesn't exist
  console.log('📋 Creating walmart_products table...');
  
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS walmart_products (
      id TEXT PRIMARY KEY,
      product_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      brand TEXT,
      description TEXT,
      category_path TEXT,
      department TEXT,
      current_price REAL,
      regular_price REAL,
      unit_price REAL,
      unit_measure TEXT,
      in_stock BOOLEAN DEFAULT 1,
      stock_level INTEGER,
      online_only BOOLEAN DEFAULT 0,
      store_only BOOLEAN DEFAULT 0,
      upc TEXT,
      sku TEXT,
      model_number TEXT,
      manufacturer TEXT,
      thumbnail_url TEXT,
      large_image_url TEXT,
      average_rating REAL,
      review_count INTEGER,
      nutritional_info TEXT,
      ingredients TEXT,
      allergens TEXT,
      size_info TEXT,
      weight_info TEXT,
      product_attributes TEXT,
      search_keywords TEXT,
      embedding_vector BLOB,
      first_seen_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_checked_at TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `;
  
  db.exec(createTableSQL);
  console.log('✅ Table created successfully');
  
  // Insert test products
  console.log('🛒 Inserting test products...');
  
  const insertSQL = `
    INSERT OR REPLACE INTO walmart_products (
      id, product_id, name, brand, description, category_path, department,
      current_price, regular_price, unit_price, unit_measure, in_stock, stock_level,
      thumbnail_url, average_rating, review_count, size_info, weight_info
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  const stmt = db.prepare(insertSQL);
  
  const testProducts = [
    {
      id: 'test-product-1',
      product_id: 'test-product-1',
      name: 'Organic Bananas',
      brand: 'Great Value',
      description: 'Fresh organic bananas, perfect for snacking or baking',
      category_path: 'Food > Fresh Produce > Fruit > Bananas',
      department: 'Grocery',
      current_price: 1.28,
      regular_price: 1.28,
      unit_price: 0.48,
      unit_measure: 'per lb',
      in_stock: 1,
      stock_level: 50,
      thumbnail_url: 'https://i5.walmartimages.com/asr/bananas-thumb.jpg',
      average_rating: 4.3,
      review_count: 1250,
      size_info: '1 bunch (approx 6-8 bananas)',
      weight_info: '2.5 lbs'
    },
    {
      id: 'test-product-2',
      product_id: 'test-product-2',
      name: 'Greek Yogurt Plain',
      brand: 'Two Good',
      description: 'Low sugar Greek yogurt with 12g protein',
      category_path: 'Food > Dairy > Yogurt > Greek Yogurt',
      department: 'Grocery',
      current_price: 4.98,
      regular_price: 5.48,
      unit_price: 0.83,
      unit_measure: 'per cup',
      in_stock: 1,
      stock_level: 25,
      thumbnail_url: 'https://i5.walmartimages.com/asr/yogurt-thumb.jpg',
      average_rating: 4.1,
      review_count: 875,
      size_info: '6 cups (5.3 oz each)',
      weight_info: '32 oz total'
    },
    {
      id: 'test-product-3',
      product_id: 'test-product-3',
      name: 'Whole Wheat Bread',
      brand: 'Wonder',
      description: 'Soft whole wheat sandwich bread',
      category_path: 'Food > Bakery > Bread > Sandwich Bread',
      department: 'Grocery',
      current_price: 2.98,
      regular_price: 2.98,
      unit_price: 0.14,
      unit_measure: 'per slice',
      in_stock: 1,
      stock_level: 15,
      thumbnail_url: 'https://i5.walmartimages.com/asr/bread-thumb.jpg',
      average_rating: 4.0,
      review_count: 543,
      size_info: '20 slices',
      weight_info: '20 oz'
    },
    {
      id: 'test-product-4',
      product_id: 'test-product-4',
      name: 'Chicken Breast Boneless',
      brand: 'Tyson',
      description: 'Fresh boneless skinless chicken breast',
      category_path: 'Food > Meat & Seafood > Chicken > Chicken Breast',
      department: 'Fresh',
      current_price: 12.98,
      regular_price: 14.98,
      unit_price: 5.49,
      unit_measure: 'per lb',
      in_stock: 1,
      stock_level: 8,
      thumbnail_url: 'https://i5.walmartimages.com/asr/chicken-thumb.jpg',
      average_rating: 4.2,
      review_count: 329,
      size_info: '2.5 lb package',
      weight_info: '2.5 lbs'
    },
    {
      id: 'test-product-5',
      product_id: 'test-product-5',
      name: 'Organic Apples Gala',
      brand: 'Marketside',
      description: 'Fresh organic Gala apples',
      category_path: 'Food > Fresh Produce > Fruit > Apples',
      department: 'Grocery',
      current_price: 4.48,
      regular_price: 4.48,
      unit_price: 1.49,
      unit_measure: 'per lb',
      in_stock: 1,
      stock_level: 35,
      thumbnail_url: 'https://i5.walmartimages.com/asr/apples-thumb.jpg',
      average_rating: 4.4,
      review_count: 678,
      size_info: '3 lb bag',
      weight_info: '3 lbs'
    }
  ];
  
  for (const product of testProducts) {
    stmt.run(
      product.id,
      product.product_id,
      product.name,
      product.brand,
      product.description,
      product.category_path,
      product.department,
      product.current_price,
      product.regular_price,
      product.unit_price,
      product.unit_measure,
      product.in_stock,
      product.stock_level,
      product.thumbnail_url,
      product.average_rating,
      product.review_count,
      product.size_info,
      product.weight_info
    );
    
    console.log(`✅ Added: ${product.name} (${product.product_id})`);
  }
  
  // Verify products were inserted
  console.log('\n📊 Verifying products...');
  const countResult = db.prepare('SELECT COUNT(*) as count FROM walmart_products').get();
  console.log(`📋 Total products in database: ${countResult.count}`);
  
  const products = db.prepare('SELECT product_id, name, current_price FROM walmart_products').all();
  console.log('\n🛒 Available products:');
  products.forEach(product => {
    console.log(`  - ${product.product_id}: ${product.name} ($${product.current_price})`);
  });
  
  db.close();
  console.log('\n🎉 Test products created successfully!');
  console.log('💡 You can now use these product IDs in your CRUD tests:');
  testProducts.forEach(product => {
    console.log(`   - ${product.product_id}`);
  });
  
} catch (error) {
  console.error('❌ Error creating test products:', error.message);
  console.error(error.stack);
  process.exit(1);
}