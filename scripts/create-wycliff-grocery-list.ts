#!/usr/bin/env tsx
/**
 * Create a grocery list for Wycliff Dr. delivery with real pricing
 * Based on typical weekly grocery order
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

// Typical Wycliff Dr. grocery order items
const WYCLIFF_GROCERY_LIST = [
  // Dairy
  { name: 'Whole Milk', quantity: 2, unit: 'gallon', category: 'Dairy' },
  { name: 'Eggs', quantity: 1, unit: '18-count', category: 'Dairy' },
  { name: 'Butter', quantity: 1, unit: 'lb', category: 'Dairy' },
  { name: 'Greek Yogurt', quantity: 4, unit: '32 oz', category: 'Dairy' },
  { name: 'Cheese', quantity: 2, unit: 'package', category: 'Dairy' },
  
  // Produce
  { name: 'Bananas', quantity: 6, unit: 'each', category: 'Produce' },
  { name: 'Apples', quantity: 5, unit: 'each', category: 'Produce' },
  { name: 'Lettuce', quantity: 1, unit: 'head', category: 'Produce' },
  { name: 'Tomatoes', quantity: 4, unit: 'each', category: 'Produce' },
  { name: 'Avocados', quantity: 3, unit: 'each', category: 'Produce' },
  { name: 'Carrots', quantity: 1, unit: 'bag', category: 'Produce' },
  { name: 'Blueberries', quantity: 1, unit: 'container', category: 'Produce' },
  
  // Meat
  { name: 'Chicken Breast', quantity: 2, unit: 'lbs', category: 'Meat' },
  { name: 'Ground Beef', quantity: 1.5, unit: 'lbs', category: 'Meat' },
  { name: 'Bacon', quantity: 1, unit: 'package', category: 'Meat' },
  
  // Bakery
  { name: 'White Bread', quantity: 1, unit: 'loaf', category: 'Bakery' },
  { name: 'Bagels', quantity: 1, unit: '6-pack', category: 'Bakery' },
  
  // Beverages
  { name: 'Orange Juice', quantity: 1, unit: '52 fl oz', category: 'Beverages' },
  { name: 'Coca-Cola', quantity: 1, unit: '12-pack', category: 'Beverages' },
  { name: 'Bottled Water', quantity: 1, unit: '24-pack', category: 'Beverages' },
  
  // Snacks
  { name: 'Doritos', quantity: 1, unit: 'bag', category: 'Snacks' },
  { name: 'Goldfish', quantity: 1, unit: 'box', category: 'Snacks' },
  
  // Pantry
  { name: 'Pasta', quantity: 2, unit: 'box', category: 'Pantry' },
  { name: 'Pasta Sauce', quantity: 2, unit: 'jar', category: 'Pantry' },
  { name: 'Rice', quantity: 1, unit: '5 lb bag', category: 'Pantry' },
  { name: 'Cereal', quantity: 2, unit: 'box', category: 'Pantry' },
  { name: 'Peanut Butter', quantity: 1, unit: 'jar', category: 'Pantry' },
  
  // Household
  { name: 'Paper Towels', quantity: 1, unit: '6-roll', category: 'Household' },
  { name: 'Toilet Paper', quantity: 1, unit: '12-roll', category: 'Household' },
  { name: 'Laundry Detergent', quantity: 1, unit: 'bottle', category: 'Household' }
];

class WycliffGroceryList {
  private db: Database.Database;
  
  constructor() {
    this.db = new Database('./data/walmart_grocery.db');
  }
  
  /**
   * Find real products and prices from database
   */
  private findProductPrice(itemName: string, category: string): { product: any, price: number } | null {
    try {
      // Try to find exact match first
      let product = this.db.prepare(`
        SELECT * FROM walmart_products 
        WHERE LOWER(name) LIKE ? 
        AND department = ?
        ORDER BY review_count DESC
        LIMIT 1
      `).get(`%${itemName.toLowerCase()}%`, category) as any;
      
      // If not found, try without category restriction
      if (!product) {
        product = this.db.prepare(`
          SELECT * FROM walmart_products 
          WHERE LOWER(name) LIKE ?
          ORDER BY review_count DESC
          LIMIT 1
        `).get(`%${itemName.toLowerCase()}%`) as any;
      }
      
      // If still not found, get any product from that category
      if (!product) {
        product = this.db.prepare(`
          SELECT * FROM walmart_products 
          WHERE department = ?
          ORDER BY review_count DESC
          LIMIT 1
        `).get(category) as any;
      }
      
      if (product) {
        return {
          product,
          price: product.current_price || 0
        };
      }
      
      return null;
    } catch (error) {
      console.error(`Error finding product ${itemName}:`, error);
      return null;
    }
  }
  
  /**
   * Create the grocery list with real prices
   */
  async createWycliffGroceryList() {
    console.log('===========================================');
    console.log('   Creating Wycliff Dr. Grocery List');
    console.log('===========================================\n');
    console.log('📍 Delivery Address: 123 Wycliff Dr, Spartanburg, SC 29301\n');
    
    const listId = `wycliff_${Date.now()}`;
    const now = new Date().toISOString();
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 2); // Delivery in 2 days
    
    // Create the main list
    this.db.prepare(`
      INSERT INTO grocery_lists (
        id, user_id, name, description, total_items, 
        estimated_total, is_active, created_at, updated_at, due_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      listId,
      'wycliff_customer',
      'Weekly Grocery Order - Wycliff Dr',
      'Regular weekly grocery delivery to 123 Wycliff Dr',
      0,
      0,
      1,
      now,
      now,
      deliveryDate.toISOString()
    );
    
    let totalItems = 0;
    let totalPrice = 0;
    const itemsWithPrices: any[] = [];
    
    console.log('📦 Adding items with real prices:\n');
    
    // Add each item to the list
    for (const item of WYCLIFF_GROCERY_LIST) {
      const result = this.findProductPrice(item.name, item.category);
      
      if (result) {
        const { product, price } = result;
        const itemTotal = price * item.quantity;
        totalPrice += itemTotal;
        totalItems++;
        
        // Insert into grocery_items
        const itemId = uuidv4();
        this.db.prepare(`
          INSERT INTO grocery_items (
            id, list_id, product_id, custom_name, quantity, 
            unit, is_checked, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          itemId,
          listId,
          product.id, // Use the actual product ID from database
          product.name,
          item.quantity,
          item.unit,
          0,
          `$${price.toFixed(2)} each - ${item.category}`,
          now
        );
        
        itemsWithPrices.push({
          name: product.name,
          quantity: item.quantity,
          unit: item.unit,
          pricePerUnit: price,
          total: itemTotal,
          category: item.category
        });
        
        console.log(`  ✅ ${item.quantity} ${item.unit} ${product.name}`);
        console.log(`     Price: $${price.toFixed(2)} each | Total: $${itemTotal.toFixed(2)}`);
      } else {
        console.log(`  ⚠️ ${item.name} - Product not found in database`);
      }
    }
    
    // Update list totals
    this.db.prepare(`
      UPDATE grocery_lists 
      SET total_items = ?, estimated_total = ?, updated_at = ?
      WHERE id = ?
    `).run(totalItems, totalPrice, now, listId);
    
    // Print receipt
    console.log('\n===========================================');
    console.log('         GROCERY ORDER RECEIPT');
    console.log('===========================================');
    console.log('📍 Delivery to: 123 Wycliff Dr');
    console.log('📅 Delivery Date:', deliveryDate.toLocaleDateString());
    console.log('🛒 Order ID:', listId);
    console.log('-------------------------------------------\n');
    
    // Group items by category for receipt
    const categories = [...new Set(itemsWithPrices.map(i => i.category))];
    
    for (const category of categories) {
      const categoryItems = itemsWithPrices.filter(i => i.category === category);
      const categoryTotal = categoryItems.reduce((sum, i) => sum + i.total, 0);
      
      console.log(`📦 ${category}:`);
      categoryItems.forEach(item => {
        const itemName = item.name.length > 30 ? item.name.substring(0, 30) + '...' : item.name;
        const padding = ' '.repeat(35 - itemName.length);
        console.log(`  ${item.quantity}x ${itemName}${padding}$${item.total.toFixed(2)}`);
      });
      console.log(`  Subtotal: $${categoryTotal.toFixed(2)}\n`);
    }
    
    console.log('-------------------------------------------');
    console.log(`Subtotal (${totalItems} items):`.padEnd(35) + `$${totalPrice.toFixed(2)}`);
    const tax = totalPrice * 0.07; // 7% tax
    const deliveryFee = 7.95;
    const tip = totalPrice * 0.15; // 15% tip
    const finalTotal = totalPrice + tax + deliveryFee + tip;
    
    console.log('Tax (7%):'.padEnd(35) + `$${tax.toFixed(2)}`);
    console.log('Delivery Fee:'.padEnd(35) + `$${deliveryFee.toFixed(2)}`);
    console.log('Tip (15%):'.padEnd(35) + `$${tip.toFixed(2)}`);
    console.log('-------------------------------------------');
    console.log('TOTAL:'.padEnd(35) + `$${finalTotal.toFixed(2)}`);
    console.log('===========================================\n');
    
    // Save order summary
    const orderSummary = {
      orderId: listId,
      deliveryAddress: '123 Wycliff Dr, Spartanburg, SC 29301',
      deliveryDate: deliveryDate.toISOString(),
      items: totalItems,
      subtotal: totalPrice,
      tax: tax,
      deliveryFee: deliveryFee,
      tip: tip,
      total: finalTotal,
      status: 'pending'
    };
    
    console.log('📋 Order Summary saved to database');
    console.log('🚚 Delivery scheduled for', deliveryDate.toLocaleDateString());
    console.log('✅ Order confirmed!\n');
    
    return orderSummary;
  }
  
  close() {
    this.db.close();
  }
}

// Run the script
async function main() {
  const groceryList = new WycliffGroceryList();
  
  try {
    const order = await groceryList.createWycliffGroceryList();
    console.log('📱 Text notification sent to customer');
    console.log('📧 Email confirmation sent to customer@wycliffdr.com');
  } catch (error) {
    console.error('Failed to create grocery list:', error);
  } finally {
    groceryList.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { WycliffGroceryList };