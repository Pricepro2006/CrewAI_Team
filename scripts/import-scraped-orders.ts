#!/usr/bin/env tsx
/**
 * Import all scraped Walmart order JSON files into enhanced database
 * Processes 25 order files and populates all tables with relationships
 */

import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

interface ScrapedOrder {
  orderNumber: string;
  orderDate: string;
  deliveryDate?: string;
  pickupDate?: string;
  customerName?: string;
  deliveryAddress?: string;
  storeLocation?: string;
  storeAddress?: string;
  fulfillmentType?: string;
  pickupPerson?: string;
  orderTotal?: string;
  subtotal?: string;
  subtotalAfterSavings?: string;
  tax?: string;
  deliveryFee?: string;
  deliveryFeeSavings?: string;
  driverTip?: string;
  itemsReceived?: number;
  itemsUnavailable?: number;
  totalItems?: number;
  paymentMethod?: any;
  products: ScrapedProduct[];
  unavailableProducts?: ScrapedProduct[];
}

interface ScrapedProduct {
  name: string;
  price: string;
  originalPrice?: string;
  quantity: string;
  unitPrice?: string;
  pricePerEach?: string;
  savings?: string;
  type?: string;
  url?: string;
  specifications?: string;
  brand?: string;
  size?: string;
  substitution?: boolean;
  substitutedFor?: string;
  finalWeight?: string;
  refundDate?: string;
  status?: string;
  note?: string;
}

class WalmartOrderImporter {
  private db: Database.Database;
  private stats = {
    ordersImported: 0,
    productsProcessed: 0,
    orderItemsCreated: 0,
    storesFound: 0,
    customersCreated: 0,
    errors: 0
  };

  constructor() {
    this.db = new Database('./data/walmart_grocery.db');
  }

  async importAllOrders() {
    console.log('🚀 Starting Walmart order import from JSON files...\n');

    const dataDir = './data';
    const orderFiles = readdirSync(dataDir)
      .filter(file => file.startsWith('scraped_order_') && file.endsWith('.json'))
      .sort();

    console.log(`📦 Found ${orderFiles.length} order files to import\n`);

    for (const fileName of orderFiles) {
      try {
        await this.importOrderFile(join(dataDir, fileName));
      } catch (error) {
        console.error(`❌ Error importing ${fileName}:`, error);
        this.stats.errors++;
      }
    }

    this.generateReport();
  }

  private async importOrderFile(filePath: string) {
    const fileName = filePath.split('/').pop()!;
    console.log(`📄 Processing ${fileName}...`);

    const jsonContent = readFileSync(filePath, 'utf8');
    const order: ScrapedOrder = JSON.parse(jsonContent);

    // 1. Process store information
    const storeId = await this.processStore(order);

    // 2. Process customer information (anonymized)
    const customerId = await this.processCustomer(order, storeId);

    // 3. Import order header
    const orderId = await this.importOrderHeader(order, storeId, customerId);

    // 4. Process all products (received and unavailable)
    await this.processOrderProducts(order, orderId);

    this.stats.ordersImported++;
    console.log(`✅ Completed ${fileName} - Order ${order.orderNumber}\n`);
  }

  private async processStore(order: ScrapedOrder): Promise<string | null> {
    if (!order.storeLocation) return null;

    // Extract city and state from store location
    let city = '', state = '', zipCode = '';
    if (order.storeAddress) {
      const addressParts = order.storeAddress.split(', ');
      if (addressParts.length >= 3) {
        city = addressParts[addressParts.length - 2];
        const stateZip = addressParts[addressParts.length - 1].split(' ');
        state = stateZip[0];
        zipCode = stateZip[1] || '';
      }
    }

    const storeCheck = this.db.prepare(`
      SELECT id FROM walmart_stores 
      WHERE store_name = ? AND COALESCE(store_address, '') = COALESCE(?, '')
    `).get(order.storeLocation, order.storeAddress || '');

    if (storeCheck) {
      return storeCheck.id;
    }

    // Insert new store
    const storeId = this.generateId();
    this.db.prepare(`
      INSERT INTO walmart_stores (
        id, store_name, store_address, city, state, zip_code,
        supports_delivery, supports_pickup, supports_curbside,
        first_seen_date, last_order_date, total_orders
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      storeId,
      order.storeLocation,
      order.storeAddress || null,
      city || null,
      state || null,
      zipCode || null,
      order.fulfillmentType?.includes('Delivery') ? 1 : 0,
      order.fulfillmentType?.includes('Pickup') ? 1 : 0,
      order.fulfillmentType?.includes('Curbside') ? 1 : 0,
      order.orderDate,
      order.orderDate
    );

    this.stats.storesFound++;
    return storeId;
  }

  private async processCustomer(order: ScrapedOrder, storeId: string | null): Promise<string | null> {
    if (!order.customerName) return null;

    // Create hash for customer privacy
    const customerHash = createHash('sha256').update(order.customerName.toLowerCase()).digest('hex').substring(0, 16);

    const customerCheck = this.db.prepare(`
      SELECT id FROM walmart_customers WHERE customer_hash = ?
    `).get(customerHash);

    if (customerCheck) {
      // Update customer stats
      this.db.prepare(`
        UPDATE walmart_customers 
        SET order_count = order_count + 1,
            last_order_date = ?,
            total_spent = total_spent + ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE customer_hash = ?
      `).run(order.orderDate, this.parsePrice(order.orderTotal || '0'), customerHash);
      
      return customerCheck.id;
    }

    // Insert new customer
    const customerId = this.generateId();
    this.db.prepare(`
      INSERT INTO walmart_customers (
        id, customer_hash, order_count, first_order_date, last_order_date,
        total_spent, favorite_store_id, preferred_fulfillment_type
      ) VALUES (?, ?, 1, ?, ?, ?, ?, ?)
    `).run(
      customerId,
      customerHash,
      order.orderDate,
      order.orderDate,
      this.parsePrice(order.orderTotal || '0'),
      storeId,
      order.fulfillmentType || null
    );

    this.stats.customersCreated++;
    return customerId;
  }

  private async importOrderHeader(order: ScrapedOrder, storeId: string | null, customerId: string | null): Promise<string> {
    const orderId = this.generateId();

    this.db.prepare(`
      INSERT INTO walmart_order_history (
        id, order_number, order_date, delivery_date, pickup_date,
        customer_name, delivery_address, store_location, store_address,
        fulfillment_type, pickup_person, order_total, subtotal,
        subtotal_after_savings, tax, delivery_fee, delivery_fee_savings,
        driver_tip, items_received, items_unavailable, total_items,
        payment_method_json, unavailable_products_json, order_status,
        processing_status, item_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId,
      order.orderNumber,
      order.orderDate,
      order.deliveryDate || null,
      order.pickupDate || null,
      order.customerName || null,
      order.deliveryAddress || null,
      order.storeLocation || null,
      order.storeAddress || null,
      order.fulfillmentType || null,
      order.pickupPerson || null,
      this.parsePrice(order.orderTotal || '0'),
      this.parsePrice(order.subtotal || '0'),
      this.parsePrice(order.subtotalAfterSavings || '0'),
      this.parsePrice(order.tax || '0'),
      this.parsePrice(order.deliveryFee || '0'),
      order.deliveryFeeSavings || null,
      this.parsePrice(order.driverTip || '0'),
      order.itemsReceived || 0,
      order.itemsUnavailable || 0,
      order.totalItems || 0,
      JSON.stringify(order.paymentMethod || null),
      JSON.stringify(order.unavailableProducts || []),
      'completed',
      'imported',
      (order.products || []).length
    );

    return orderId;
  }

  private async processOrderProducts(order: ScrapedOrder, orderId: string) {
    const allProducts = [
      ...(order.products || []),
      ...(order.unavailableProducts || []).map(p => ({ ...p, type: 'unavailable' }))
    ];

    for (const product of allProducts) {
      await this.processProduct(product, order, orderId);
    }
  }

  private async processProduct(product: ScrapedProduct, order: ScrapedOrder, orderId: string) {
    // 1. Insert/update in comprehensive products table
    const productId = await this.upsertProduct(product, order);

    // 2. Insert order item relationship
    await this.insertOrderItem(product, order, orderId, productId);

    this.stats.productsProcessed++;
  }

  private async upsertProduct(product: ScrapedProduct, order: ScrapedOrder): Promise<string> {
    // Check if product exists by name
    const existingProduct = this.db.prepare(`
      SELECT product_id FROM walmart_order_products_comprehensive 
      WHERE name = ?
    `).get(product.name);

    if (existingProduct) {
      // Update existing product with new price/order information
      this.db.prepare(`
        UPDATE walmart_order_products_comprehensive
        SET 
          last_seen_date = ?,
          order_count = order_count + 1,
          total_quantity = total_quantity + ?,
          order_numbers = order_numbers || ',' || ?,
          price_history = json_insert(
            COALESCE(price_history, '[]'), 
            '$[#]', 
            json_object('price', ?, 'date', ?, 'order', ?)
          ),
          updated_at = CURRENT_TIMESTAMP
        WHERE product_id = ?
      `).run(
        order.orderDate,
        parseInt(product.quantity) || 1,
        order.orderNumber,
        product.price,
        order.orderDate,
        order.orderNumber,
        existingProduct.product_id
      );
      
      return existingProduct.product_id;
    }

    // Insert new product
    const productId = `WM_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.db.prepare(`
      INSERT INTO walmart_order_products_comprehensive (
        id, product_id, name, brand, current_price, original_price,
        unit_price, category, first_seen_date, last_seen_date,
        order_count, total_quantity, order_numbers, price_history,
        walmart_url, product_specifications
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
    `).run(
      this.generateId(),
      productId,
      product.name,
      product.brand || this.extractBrand(product.name),
      this.parsePrice(product.price),
      this.parsePrice(product.originalPrice || '0'),
      product.unitPrice || null,
      this.categorizeProduct(product.name),
      order.orderDate,
      order.orderDate,
      parseInt(product.quantity) || 1,
      order.orderNumber,
      JSON.stringify([{
        price: product.price,
        date: order.orderDate,
        order: order.orderNumber
      }]),
      product.url || null,
      product.specifications || null
    );

    return productId;
  }

  private async insertOrderItem(product: ScrapedProduct, order: ScrapedOrder, orderId: string, productId: string) {
    this.db.prepare(`
      INSERT INTO walmart_order_items (
        id, order_id, product_id, order_number, product_name,
        quantity, price, original_price, unit_price, price_per_each,
        savings, product_type, substitution_note, final_weight,
        refund_date, unavailable_reason, walmart_url, specifications
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      this.generateId(),
      orderId,
      productId,
      order.orderNumber,
      product.name,
      product.quantity,
      product.price,
      product.originalPrice || null,
      product.unitPrice || null,
      product.pricePerEach || null,
      product.savings || null,
      product.type || 'shopped',
      product.substitutedFor || null,
      product.finalWeight || null,
      product.refundDate || null,
      product.status || null,
      product.url || null,
      product.specifications || null
    );

    this.stats.orderItemsCreated++;
  }

  private parsePrice(priceStr: string): number {
    if (!priceStr) return 0;
    const cleaned = priceStr.replace(/[^0-9.]/g, '');
    return parseFloat(cleaned) || 0;
  }

  private extractBrand(name: string): string {
    const brands = [
      'Great Value', 'Marketside', 'Sam\'s Choice', 'Equate',
      'Freshness Guaranteed', 'Parent\'s Choice', 'Nature Valley',
      'KIND', 'Perdue', 'HORMEL', 'Pepperidge Farm', 'Old El Paso',
      'Kraft', 'Jif', 'Dannon', 'Oikos', 'Welch\'s', 'Funables'
    ];

    for (const brand of brands) {
      if (name.toLowerCase().includes(brand.toLowerCase())) {
        return brand;
      }
    }

    return 'Generic';
  }

  private categorizeProduct(name: string): string {
    const lowerName = name.toLowerCase();
    
    if (lowerName.match(/banana|apple|orange|lettuce|tomato|potato|onion|carrot|cucumber|grapes|bell pepper|corn|spinach|romaine/)) {
      return 'Produce';
    }
    if (lowerName.match(/milk|cheese|yogurt|butter|cream|egg/)) {
      return 'Dairy';
    }
    if (lowerName.match(/chicken|beef|pork|turkey|fish|salmon|shrimp|meat|bacon/)) {
      return 'Meat & Seafood';
    }
    if (lowerName.match(/bread|bagel|muffin|cake|cookie|donut|bakery/)) {
      return 'Bakery';
    }
    if (lowerName.match(/snack|cracker|chip|granola|fruit snack|bar/)) {
      return 'Snacks';
    }
    if (lowerName.match(/pasta|seasoning|sauce|dip|cheese dip/)) {
      return 'Pantry';
    }
    if (lowerName.match(/salad kit|chopped salad/)) {
      return 'Prepared Foods';
    }
    if (lowerName.match(/umbrella|outdoor|patio/)) {
      return 'Outdoor & Garden';
    }
    if (lowerName.match(/sponge|body sponge/)) {
      return 'Personal Care';
    }
    
    return 'General';
  }

  private generateId(): string {
    return Buffer.from(Math.random().toString()).toString('base64').substring(0, 16);
  }

  private generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('🎉 WALMART ORDER IMPORT COMPLETE');
    console.log('='.repeat(60));
    
    console.log('\n📊 IMPORT STATISTICS:');
    console.log(`  Orders Imported:     ${this.stats.ordersImported}`);
    console.log(`  Products Processed:  ${this.stats.productsProcessed}`);
    console.log(`  Order Items Created: ${this.stats.orderItemsCreated}`);
    console.log(`  Stores Found:        ${this.stats.storesFound}`);
    console.log(`  Customers Created:   ${this.stats.customersCreated}`);
    console.log(`  Errors:              ${this.stats.errors}`);

    // Database verification
    const verification = {
      orders: this.db.prepare('SELECT COUNT(*) as count FROM walmart_order_history').get().count,
      products: this.db.prepare('SELECT COUNT(*) as count FROM walmart_order_products_comprehensive').get().count,
      orderItems: this.db.prepare('SELECT COUNT(*) as count FROM walmart_order_items').get().count,
      stores: this.db.prepare('SELECT COUNT(*) as count FROM walmart_stores').get().count,
      customers: this.db.prepare('SELECT COUNT(*) as count FROM walmart_customers').get().count
    };

    console.log('\n✅ DATABASE VERIFICATION:');
    console.log(`  Total Orders in DB:      ${verification.orders}`);
    console.log(`  Total Products in DB:    ${verification.products}`);
    console.log(`  Total Order Items in DB: ${verification.orderItems}`);
    console.log(`  Total Stores in DB:      ${verification.stores}`);
    console.log(`  Total Customers in DB:   ${verification.customers}`);

    // Sample data verification
    console.log('\n🔍 SAMPLE DATA VERIFICATION:');
    const sampleOrder = this.db.prepare(`
      SELECT order_number, order_date, store_location, order_total, items_received
      FROM walmart_order_history 
      ORDER BY order_date DESC 
      LIMIT 1
    `).get();

    if (sampleOrder) {
      console.log(`  Latest Order: ${sampleOrder.order_number}`);
      console.log(`  Date: ${sampleOrder.order_date}`);
      console.log(`  Store: ${sampleOrder.store_location}`);
      console.log(`  Total: $${sampleOrder.order_total}`);
      console.log(`  Items: ${sampleOrder.items_received}`);
    }

    const topProduct = this.db.prepare(`
      SELECT name, order_count, current_price
      FROM walmart_order_products_comprehensive
      ORDER BY order_count DESC
      LIMIT 1
    `).get();

    if (topProduct) {
      console.log(`  Most Ordered Product: ${topProduct.name}`);
      console.log(`  Ordered ${topProduct.order_count} times at $${topProduct.current_price}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎯 Import completed successfully!');
    console.log('Database ready for analysis and API integration.');
    console.log('='.repeat(60) + '\n');
  }

  close() {
    this.db.close();
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const importer = new WalmartOrderImporter();
  importer.importAllOrders()
    .then(() => importer.close())
    .catch(error => {
      console.error('❌ Import failed:', error);
      importer.close();
      process.exit(1);
    });
}

export { WalmartOrderImporter };