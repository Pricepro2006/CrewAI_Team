#!/usr/bin/env tsx
/**
 * Create Location-Based Pricing Schema
 * Implements best practices for storing products with location-specific pricing
 */

import Database from 'better-sqlite3';

class LocationPricingSchema {
  private db: Database.Database;
  
  constructor() {
    this.db = new Database('./data/walmart_grocery.db');
  }

  createLocationPricingTables() {
    console.log('Creating location-based pricing schema...\n');

    // 1. Store Locations Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS store_locations (
        id TEXT PRIMARY KEY,
        store_number TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        zip_code TEXT NOT NULL,
        county TEXT,
        phone TEXT,
        latitude REAL,
        longitude REAL,
        store_type TEXT DEFAULT 'Supercenter',
        is_active BOOLEAN DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // 2. Location-Specific Pricing Table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS location_pricing (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        store_location_id TEXT NOT NULL,
        current_price REAL NOT NULL,
        regular_price REAL,
        sale_price REAL,
        in_stock BOOLEAN DEFAULT 1,
        stock_level INTEGER DEFAULT 0,
        last_updated TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (product_id) REFERENCES walmart_products (id),
        FOREIGN KEY (store_location_id) REFERENCES store_locations (id),
        UNIQUE(product_id, store_location_id)
      )
    `);

    // 3. Historical Location Pricing
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS location_price_history (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        store_location_id TEXT NOT NULL,
        price REAL NOT NULL,
        price_type TEXT DEFAULT 'regular', -- 'regular', 'sale', 'clearance'
        recorded_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (product_id) REFERENCES walmart_products (id),
        FOREIGN KEY (store_location_id) REFERENCES store_locations (id)
      )
    `);

    // 4. Create indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_location_pricing_product ON location_pricing(product_id);
      CREATE INDEX IF NOT EXISTS idx_location_pricing_store ON location_pricing(store_location_id);
      CREATE INDEX IF NOT EXISTS idx_location_price_history_product_date ON location_price_history(product_id, recorded_at);
      CREATE INDEX IF NOT EXISTS idx_store_locations_city_state ON store_locations(city, state);
    `);

    // 5. Views for easy querying
    this.db.exec(`
      CREATE VIEW IF NOT EXISTS product_pricing_by_location AS
      SELECT 
        wp.name as product_name,
        wp.product_id,
        wp.sku,
        wp.brand,
        wp.department,
        sl.name as store_name,
        sl.city,
        sl.state,
        sl.zip_code,
        lp.current_price,
        lp.regular_price,
        lp.sale_price,
        lp.in_stock,
        lp.stock_level,
        lp.last_updated
      FROM walmart_products wp
      JOIN location_pricing lp ON wp.id = lp.product_id
      JOIN store_locations sl ON lp.store_location_id = sl.id
      ORDER BY wp.name, sl.city
    `);

    console.log('✅ Created location-based pricing schema');
  }

  seedSouthCarolinaStores() {
    console.log('🏪 Seeding South Carolina Walmart stores...');

    const stores = [
      {
        id: 'store_spartanburg_1326',
        store_number: '1326',
        name: 'Walmart Supercenter',
        address: '1585 Asheville Highway',
        city: 'Spartanburg',
        state: 'SC',
        zip_code: '29301',
        county: 'Spartanburg',
        phone: '(864) 576-2156',
        latitude: 35.0084,
        longitude: -81.9498
      },
      {
        id: 'store_mount_pleasant_3669',
        store_number: '3669', 
        name: 'Walmart Supercenter',
        address: '1021 Johnnie Dodds Blvd',
        city: 'Mount Pleasant',
        state: 'SC',
        zip_code: '29464',
        county: 'Charleston',
        phone: '(843) 881-2808',
        latitude: 32.8323,
        longitude: -79.8607
      },
      {
        id: 'store_charleston_5432',
        store_number: '5432',
        name: 'Walmart Supercenter', 
        address: '7855 Rivers Ave',
        city: 'North Charleston',
        state: 'SC',
        zip_code: '29406',
        county: 'Charleston',
        phone: '(843) 572-8189',
        latitude: 32.8711,
        longitude: -79.9778
      },
      {
        id: 'store_columbia_1694',
        store_number: '1694',
        name: 'Walmart Supercenter',
        address: '320 Town Center Pl',
        city: 'Columbia',
        state: 'SC', 
        zip_code: '29229',
        county: 'Richland',
        phone: '(803) 736-9991',
        latitude: 34.0851,
        longitude: -80.9736
      },
      {
        id: 'store_greenville_937',
        store_number: '937',
        name: 'Walmart Supercenter',
        address: '1680 Woodruff Rd',
        city: 'Greenville', 
        state: 'SC',
        zip_code: '29607',
        county: 'Greenville',
        phone: '(864) 297-3767',
        latitude: 34.7915,
        longitude: -82.3106
      },
      {
        id: 'store_florence_1124',
        store_number: '1124',
        name: 'Walmart Supercenter',
        address: '2701 David H McLeod Blvd',
        city: 'Florence',
        state: 'SC',
        zip_code: '29501', 
        county: 'Florence',
        phone: '(843) 664-4438',
        latitude: 34.2104,
        longitude: -79.7911
      },
      {
        id: 'store_rock_hill_1015',
        store_number: '1015', 
        name: 'Walmart Supercenter',
        address: '2440 Dave Lyle Blvd',
        city: 'Rock Hill',
        state: 'SC',
        zip_code: '29730',
        county: 'York',
        phone: '(803) 326-6594',
        latitude: 34.9487,
        longitude: -81.0687
      },
      {
        id: 'store_summerville_3094',
        store_number: '3094',
        name: 'Walmart Supercenter', 
        address: '9735 Dorchester Rd',
        city: 'Summerville',
        state: 'SC',
        zip_code: '29485',
        county: 'Dorchester', 
        phone: '(843) 873-5600',
        latitude: 33.0168,
        longitude: -80.2265
      }
    ];

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO store_locations (
        id, store_number, name, address, city, state, zip_code, county,
        phone, latitude, longitude, store_type, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    
    for (const store of stores) {
      stmt.run(
        store.id, store.store_number, store.name, store.address,
        store.city, store.state, store.zip_code, store.county,
        store.phone, store.latitude, store.longitude, 
        'Supercenter', 1, now, now
      );
      console.log(`  ✅ Added ${store.name} - ${store.city}, SC`);
    }

    console.log(`\n📊 Seeded ${stores.length} South Carolina stores`);
  }

  generateSampleLocationPricing() {
    console.log('\n💰 Generating sample location-based pricing...');

    // Get all products and stores
    const products = this.db.prepare('SELECT * FROM walmart_products LIMIT 20').all() as any[];
    const stores = this.db.prepare('SELECT * FROM store_locations').all() as any[];

    if (products.length === 0) {
      console.log('⚠️ No products found. Run product import first.');
      return;
    }

    if (stores.length === 0) {
      console.log('⚠️ No stores found. Stores not seeded properly.');
      return;
    }

    const pricingStmt = this.db.prepare(`
      INSERT OR REPLACE INTO location_pricing (
        id, product_id, store_location_id, current_price, regular_price, 
        sale_price, in_stock, stock_level, last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const historyStmt = this.db.prepare(`
      INSERT INTO location_price_history (
        id, product_id, store_location_id, price, price_type, recorded_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    let totalEntries = 0;
    const now = new Date().toISOString();

    for (const product of products) {
      const basePrice = product.current_price || 5.00;
      
      for (const store of stores) {
        // Generate location-specific price variations
        // Urban areas (Charleston, Columbia) typically 5-15% higher
        // Rural areas (Florence, Spartanburg) typically 5-10% lower
        let priceMultiplier = 1.0;
        
        switch (store.city) {
          case 'Mount Pleasant':
          case 'North Charleston':
            priceMultiplier = 1.08 + (Math.random() * 0.07); // 8-15% higher
            break;
          case 'Columbia': 
            priceMultiplier = 1.05 + (Math.random() * 0.05); // 5-10% higher
            break;
          case 'Greenville':
            priceMultiplier = 1.02 + (Math.random() * 0.04); // 2-6% higher
            break;
          case 'Florence':
          case 'Spartanburg':
            priceMultiplier = 0.92 + (Math.random() * 0.08); // 8% lower to equal
            break;
          default:
            priceMultiplier = 0.98 + (Math.random() * 0.04); // -2% to +2%
        }

        const locationPrice = Math.round(basePrice * priceMultiplier * 100) / 100;
        const regularPrice = Math.round(locationPrice * 1.1 * 100) / 100;
        const salePrice = Math.round(locationPrice * 0.9 * 100) / 100;
        const inStock = Math.random() > 0.1;
        const stockLevel = Math.floor(Math.random() * 100);

        // Insert current pricing
        pricingStmt.run(
          `${product.id}_${store.id}`,
          product.id,
          store.id,
          locationPrice,
          regularPrice,
          Math.random() > 0.7 ? salePrice : null, // 30% chance of sale
          inStock ? 1 : 0,
          stockLevel,
          now
        );

        // Add some historical pricing
        for (let days = 30; days >= 0; days -= 7) {
          const historyDate = new Date();
          historyDate.setDate(historyDate.getDate() - days);
          const historicalPrice = locationPrice * (0.95 + Math.random() * 0.1);
          
          historyStmt.run(
            `hist_${product.id}_${store.id}_${days}`,
            product.id,
            store.id,
            Math.round(historicalPrice * 100) / 100,
            'regular',
            historyDate.toISOString()
          );
        }

        totalEntries++;
      }
    }

    console.log(`  ✅ Generated pricing for ${totalEntries} product-location combinations`);
  }

  printSummaryReport() {
    console.log('\n===========================================');
    console.log('    Location-Based Pricing Schema Ready');
    console.log('===========================================');

    const stats = this.db.prepare(`
      SELECT 
        COUNT(DISTINCT lp.product_id) as products_with_pricing,
        COUNT(DISTINCT lp.store_location_id) as stores_with_pricing,
        COUNT(*) as total_price_entries,
        AVG(lp.current_price) as avg_price,
        MIN(lp.current_price) as min_price,
        MAX(lp.current_price) as max_price
      FROM location_pricing lp
    `).get() as any;

    const storeCount = this.db.prepare('SELECT COUNT(*) as count FROM store_locations').get() as any;
    const priceHistoryCount = this.db.prepare('SELECT COUNT(*) as count FROM location_price_history').get() as any;

    console.log(`📊 Statistics:`);
    console.log(`  • Stores: ${storeCount.count}`);
    console.log(`  • Products with Location Pricing: ${stats.products_with_pricing}`);
    console.log(`  • Total Price Entries: ${stats.total_price_entries}`);
    console.log(`  • Historical Price Records: ${priceHistoryCount.count}`);
    console.log(`  • Average Price: $${stats.avg_price?.toFixed(2) || '0.00'}`);
    console.log(`  • Price Range: $${stats.min_price?.toFixed(2) || '0.00'} - $${stats.max_price?.toFixed(2) || '0.00'}`);

    // Show price variations by city
    const priceByCity = this.db.prepare(`
      SELECT 
        sl.city,
        sl.state,
        COUNT(*) as products,
        AVG(lp.current_price) as avg_price,
        MIN(lp.current_price) as min_price,
        MAX(lp.current_price) as max_price
      FROM location_pricing lp
      JOIN store_locations sl ON lp.store_location_id = sl.id
      GROUP BY sl.city, sl.state
      ORDER BY avg_price DESC
    `).all() as any[];

    console.log(`\n💰 Price Variations by City:`);
    priceByCity.forEach(city => {
      console.log(`  • ${city.city}, ${city.state}: $${city.avg_price.toFixed(2)} avg (${city.products} products)`);
    });

    console.log('\n🔍 Sample Queries:');
    console.log('  • View all pricing: SELECT * FROM product_pricing_by_location;');
    console.log('  • Compare bread prices: SELECT * FROM product_pricing_by_location WHERE product_name LIKE "%bread%";');
    console.log('  • Mount Pleasant vs Spartanburg: SELECT * FROM product_pricing_by_location WHERE city IN ("Mount Pleasant", "Spartanburg");');

    console.log('\n🎯 Next Steps:');
    console.log('  1. Import comprehensive order data from walmart.com/orders');
    console.log('  2. Extract products with location information');  
    console.log('  3. Fetch real location-specific pricing using BrightData MCP');
    console.log('  4. Populate location_pricing table with actual data');
    console.log('===========================================\n');
  }

  close() {
    this.db.close();
  }
}

// Execute
async function main() {
  const schema = new LocationPricingSchema();
  
  try {
    schema.createLocationPricingTables();
    schema.seedSouthCarolinaStores();
    schema.generateSampleLocationPricing();
    schema.printSummaryReport();
  } catch (error) {
    console.error('Error creating location pricing schema:', error);
  } finally {
    schema.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { LocationPricingSchema };