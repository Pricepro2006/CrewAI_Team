/**
 * Grocery Repository - Data access layer for grocery-related tables
 * Handles grocery lists, items, and shopping sessions
 */

type DatabaseInstance = any;
import { BaseRepository } from "./BaseRepository.js";
import type { BaseEntity } from "./BaseRepository.js";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../../utils/logger.js";

// Types for grocery entities
export interface GroceryList extends BaseEntity {
  id: string;
  user_id: string;
  list_name: string;
  description?: string;
  list_type?: "shopping" | "pantry" | "recipe" | "recurring";
  status?: "active" | "completed" | "archived" | "template";
  store_preference?: string;
  budget_limit?: number;
  estimated_total?: number;
  actual_total?: number;
  is_recurring?: boolean;
  recurrence_pattern?: any;
  next_shop_date?: string;
  last_shopped_date?: string;
  tags?: string[];
  notes?: string;
  shared_with?: string[];
  created_at?: string;
  updated_at?: string;
  completed_at?: string;

  // Additional properties for service compatibility
  items?: GroceryItem[];
  totalEstimate?: number;
  isShared?: boolean;
}

export interface GroceryItem extends BaseEntity {
  id: string;
  list_id: string;
  item_name: string;
  brand_preference?: string;
  product_id?: string;
  category?: string;
  quantity?: number;
  unit?: string;
  package_size?: string;
  estimated_price?: number;
  actual_price?: number;
  discount_amount?: number;
  status?:
    | "pending"
    | "in_cart"
    | "purchased"
    | "unavailable"
    | "substituted"
    | "removed";
  priority?: "essential" | "high" | "normal" | "low";
  aisle_location?: string;
  added_to_cart_at?: string;
  purchased_at?: string;
  substitution_id?: string;
  notes?: string;
  dietary_flags?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface ShoppingSession extends BaseEntity {
  id: string;
  user_id: string;
  list_id?: string;
  session_type?: "online" | "in_store" | "pickup" | "delivery";
  status?: "active" | "completed" | "abandoned" | "cancelled";
  items_total?: number;
  items_found?: number;
  items_substituted?: number;
  items_unavailable?: number;
  subtotal?: number;
  tax_amount?: number;
  delivery_fee?: number;
  tip_amount?: number;
  total_amount?: number;
  savings_amount?: number;
  started_at?: string;
  completed_at?: string;
  duration_minutes?: number;
  fulfillment_type?: string;
  delivery_address?: string;
  delivery_time_slot?: string;
  order_number?: string;
  receipt_url?: string;
  feedback_rating?: number;
  feedback_comment?: string;
}

export class GroceryListRepository extends BaseRepository<GroceryList> {
  constructor(db: DatabaseInstance) {
    super(db, "grocery_lists");
  }

  async createList(data: GroceryList): Promise<GroceryList> {
    const list: GroceryList = {
      ...data,
      id: data.id || uuidv4(),
      list_type: data.list_type || "shopping",
      status: data.status || "active",
      store_preference: data.store_preference || "walmart",
      is_recurring: data.is_recurring || false,
      tags: data.tags || [],
      shared_with: data.shared_with || [],
    };

    const stmt = this?.db?.prepare(`
      INSERT INTO grocery_lists (
        id, user_id, list_name, description, 
        list_type, status, store_id, estimated_total, 
        items_count, shared_with, tags, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt?.run(
      list.id,
      list.user_id,
      list.list_name,
      list.description,
      list.list_type,
      list.status,
      list.store_preference, // maps to store_id
      list.estimated_total || 0,
      0, // items_count - starts at 0
      JSON.stringify(list.shared_with || []),
      JSON.stringify(list.tags || []),
      JSON.stringify({ 
        is_recurring: list.is_recurring,
        recurrence_pattern: list.recurrence_pattern,
        next_shop_date: list.next_shop_date,
        budget_limit: list.budget_limit 
      }) // metadata field for additional data
    );

    logger.info(`Created grocery list: ${list.id}`, "GROCERY_REPO");
    return this.getList(list.id!);
  }

  async getList(id: string): Promise<GroceryList> {
    const row = this.db
      .prepare("SELECT * FROM grocery_lists WHERE id = ?")
      .get(id) as any;
    if (!row) {
      throw new Error(`Grocery list not found: ${id}`);
    }
    return this.mapRowToList(row);
  }

  async getUserLists(userId: string, status?: string): Promise<GroceryList[]> {
    let query = "SELECT * FROM grocery_lists WHERE user_id = ?";
    const params: any[] = [userId];

    if (status) {
      query += " AND status = ?";
      params.push(status);
    }

    query += " ORDER BY updated_at DESC";

    const rows = this?.db?.prepare(query).all(...params) as any[];
    return rows?.map((row: any) => this.mapRowToList(row));
  }

  async updateList(
    id: string,
    updates: Partial<GroceryList>,
  ): Promise<GroceryList> {
    const fields = [];
    const values = [];
    
    // Get current metadata to merge with updates
    const current = await this.getList(id);
    const currentMetadata = current ? {
      is_recurring: current.is_recurring,
      recurrence_pattern: current.recurrence_pattern,
      next_shop_date: current.next_shop_date,
      last_shopped_date: current.last_shopped_date,
      budget_limit: current.budget_limit,
      notes: current.notes
    } : {};

    // Prepare metadata updates
    const metadataUpdates: Record<string, any> = { ...currentMetadata };
    
    // Map interface properties to database columns
    const columnMappings: Record<string, string> = {
      'list_name': 'list_name',
      'description': 'description',
      'list_type': 'list_type',
      'status': 'status',
      'store_preference': 'store_id',
      'estimated_total': 'estimated_total',
      'actual_total': 'actual_total',
      'completed_at': 'completed_at',
      'tags': 'tags',
      'shared_with': 'shared_with'
    };

    for (const [key, value] of Object.entries(updates)) {
      if (key !== "id" && value !== undefined) {
        // Handle metadata fields
        if (['is_recurring', 'recurrence_pattern', 'next_shop_date', 'last_shopped_date', 'budget_limit', 'notes'].includes(key)) {
          metadataUpdates[key] = value;
        } 
        // Handle direct column mappings
        else if (columnMappings[key]) {
          const dbColumn = columnMappings[key];
          fields.push(`${dbColumn} = ?`);
          
          if (["tags", "shared_with"].includes(key)) {
            values.push(JSON.stringify(value));
          } else {
            values.push(value);
          }
        }
      }
    }
    
    // Always update metadata if any metadata field changed
    if (Object.keys(metadataUpdates).length > 0) {
      fields.push('metadata = ?');
      values.push(JSON.stringify(metadataUpdates));
    }

    if (fields.length === 0) {
      return this.getList(id);
    }

    fields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    const stmt = this?.db?.prepare(`
      UPDATE grocery_lists 
      SET ${fields.join(", ")}
      WHERE id = ?
    `);

    stmt?.run(...values);
    return this.getList(id);
  }

  async completeList(id: string, actualTotal?: number): Promise<GroceryList> {
    const updates: Partial<GroceryList> = {
      status: "completed",
      completed_at: new Date().toISOString(),
    };

    if (actualTotal !== undefined) {
      updates.actual_total = actualTotal;
    }

    if ((await this.getList(id)).is_recurring) {
      // Calculate next shop date based on recurrence pattern
      updates.last_shopped_date = new Date().toISOString();
      // TODO: Calculate next_shop_date based on recurrence_pattern
    }

    return this.updateList(id, updates);
  }

  async deleteList(id: string): Promise<void> {
    // First delete all items in the list
    const stmt1 = this?.db?.prepare(
      `DELETE FROM grocery_items WHERE list_id = ?`,
    );
    stmt1?.run(id);

    // Then delete the list itself
    const stmt2 = this?.db?.prepare(`DELETE FROM grocery_lists WHERE id = ?`);
    const result = stmt2?.run(id);

    if (!result || result.changes === 0) {
      throw new Error(`Grocery list not found: ${id}`);
    }

    logger.info(`Deleted grocery list: ${id}`, "GROCERY_REPO");
  }

  private mapRowToList(row: any): GroceryList {
    // Parse metadata to extract additional fields
    const metadata = row.metadata ? JSON.parse(row.metadata) : {};
    
    return {
      id: row.id,
      user_id: row.user_id,
      list_name: row.list_name, // Database uses list_name
      description: row.description,
      list_type: row.list_type,
      status: row.status,
      store_preference: row.store_id, // Database uses store_id
      budget_limit: metadata.budget_limit,
      estimated_total: row.estimated_total,
      actual_total: row.actual_total,
      is_recurring: metadata.is_recurring || false,
      recurrence_pattern: metadata.recurrence_pattern,
      next_shop_date: metadata.next_shop_date,
      last_shopped_date: metadata.last_shopped_date,
      tags: row.tags ? JSON.parse(row.tags) : [],
      notes: metadata.notes,
      shared_with: row.shared_with ? JSON.parse(row.shared_with) : [],
      created_at: row.created_at,
      updated_at: row.updated_at,
      completed_at: row.completed_at,
      // Additional service compatibility fields
      items: undefined,
      totalEstimate: row.estimated_total,
      isShared: row.shared_with ? JSON.parse(row.shared_with).length > 0 : false
    };
  }
}

export class GroceryItemRepository extends BaseRepository<GroceryItem> {
  constructor(db: DatabaseInstance) {
    super(db, "grocery_items");
  }

  async addItem(data: GroceryItem): Promise<GroceryItem> {
    const item: GroceryItem = {
      ...data,
      id: data.id || uuidv4(),
      quantity: data.quantity ?? 1,
      unit: data.unit || "each",
    };

    // Map to actual database schema
    const stmt = this?.db?.prepare(`
      INSERT INTO grocery_items (
        id, list_id, product_id, item_name, brand_preference,
        quantity, unit, category, estimated_price, actual_price,
        coupon_applied, coupon_amount, substitution_allowed, 
        substitute_product_id, notes, priority, status,
        found_in_store, aisle_location
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt?.run(
      item.id,
      item.list_id,
      item.product_id || null,
      item.item_name, // Correct column name
      item.brand_preference || null,
      item.quantity,
      item.unit,
      item.category || null,
      item.estimated_price || null,
      item.actual_price || null,
      0, // coupon_applied default
      null, // coupon_amount
      1, // substitution_allowed default
      item.substitution_id || null, // maps to substitute_product_id
      item.notes || null,
      item.priority === 'essential' ? 10 : 
        item.priority === 'high' ? 7 :
        item.priority === 'normal' ? 5 :
        item.priority === 'low' ? 3 : 5, // Convert priority to numeric
      item.status || 'pending',
      null, // found_in_store
      item.aisle_location || null
    );

    logger.info(`Added grocery item: ${item.id}`, "GROCERY_REPO");
    return this.getItem(item.id!);
  }

  async getItem(id: string): Promise<GroceryItem> {
    const row = this.db
      .prepare("SELECT * FROM grocery_items WHERE id = ?")
      .get(id) as any;
    if (!row) {
      throw new Error(`Grocery item not found: ${id}`);
    }
    return this.mapRowToItem(row);
  }

  async getListItems(listId: string, status?: string): Promise<GroceryItem[]> {
    let query = "SELECT * FROM grocery_items WHERE list_id = ?";
    const params: any[] = [listId];

    if (status) {
      query += " AND status = ?";
      params.push(status);
    }

    query += " ORDER BY priority DESC, created_at ASC";

    const rows = this?.db?.prepare(query).all(...params) as any[];
    return rows?.map((row: any) => this.mapRowToItem(row));
  }

  async updateItem(
    id: string,
    updates: Partial<GroceryItem>,
  ): Promise<GroceryItem> {
    const fields: string[] = [];
    const values: any[] = [];
    
    // Map interface properties to database columns
    const columnMappings: Record<string, string> = {
      'item_name': 'item_name',
      'brand_preference': 'brand_preference',
      'product_id': 'product_id',
      'category': 'category',
      'quantity': 'quantity',
      'unit': 'unit',
      'package_size': 'package_size',
      'estimated_price': 'estimated_price',
      'actual_price': 'actual_price',
      'discount_amount': 'coupon_amount',
      'status': 'status',
      'aisle_location': 'aisle_location',
      'added_to_cart_at': 'checked_at',
      'purchased_at': 'checked_at',
      'substitution_id': 'substitute_product_id',
      'notes': 'notes'
    };

    for (const [key, value] of Object.entries(updates)) {
      if (key !== "id" && value !== undefined) {
        // Handle priority conversion
        if (key === 'priority') {
          fields.push('priority = ?');
          const priorityValue = value === 'essential' ? 10 : 
            value === 'high' ? 7 :
            value === 'normal' ? 5 :
            value === 'low' ? 3 : 5;
          values.push(priorityValue);
        }
        // Handle dietary_flags
        else if (key === "dietary_flags") {
          // Store dietary_flags in notes as JSON for now since column doesn't exist
          const currentItem = await this.getItem(id);
          const notes = currentItem.notes || '{}';
          let notesObj: Record<string, any> = {};
          try {
            notesObj = JSON.parse(notes);
          } catch {
            notesObj = { text: notes };
          }
          notesObj['dietary_flags'] = value;
          fields.push('notes = ?');
          values.push(JSON.stringify(notesObj));
        }
        // Handle discount_amount -> coupon fields
        else if (key === 'discount_amount') {
          fields.push('coupon_applied = ?');
          const discountValue = value as number;
          values.push(discountValue > 0 ? 1 : 0);
          fields.push('coupon_amount = ?');
          values.push(discountValue);
        }
        // Handle direct column mappings
        else if (columnMappings[key]) {
          const dbColumn = columnMappings[key];
          // Skip if column name is the same (avoid duplicates)
          if (!fields.includes(`${dbColumn} = ?`)) {
            fields.push(`${dbColumn} = ?`);
            values.push(value);
          }
        }
      }
    }

    if (fields.length === 0) {
      return this.getItem(id);
    }

    fields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    const stmt = this?.db?.prepare(`
      UPDATE grocery_items 
      SET ${fields.join(", ")}
      WHERE id = ?
    `);

    stmt?.run(...values);
    return this.getItem(id);
  }

  async markAsCart(id: string): Promise<GroceryItem> {
    // Update status and checked_at (which maps to added_to_cart_at)
    const stmt = this?.db?.prepare(`
      UPDATE grocery_items 
      SET status = ?,
          checked_at = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt?.run('in_cart', new Date().toISOString(), id);
    return this.getItem(id);
  }

  async markAsPurchased(
    id: string,
    actualPrice?: number,
  ): Promise<GroceryItem> {
    // Update status and checked_at (which maps to purchased_at) 
    const fields = ['status = ?', 'checked_at = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const values: any[] = ['purchased', new Date().toISOString()];
    
    if (actualPrice !== undefined) {
      fields.push('actual_price = ?');
      values.push(actualPrice);
    }
    
    values.push(id);
    
    const stmt = this?.db?.prepare(`
      UPDATE grocery_items 
      SET ${fields.join(', ')}
      WHERE id = ?
    `);
    
    stmt?.run(...values);
    return this.getItem(id);
  }

  async substituteItem(
    id: string,
    substitutionId: string,
  ): Promise<GroceryItem> {
    // Update status and substitute_product_id directly
    const stmt = this?.db?.prepare(`
      UPDATE grocery_items 
      SET status = ?,
          substitute_product_id = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt?.run('substituted', substitutionId, id);
    return this.getItem(id);
  }

  async deleteItem(id: string): Promise<void> {
    const stmt = this?.db?.prepare(`DELETE FROM grocery_items WHERE id = ?`);
    const result = stmt?.run(id);

    if (!result || result.changes === 0) {
      throw new Error(`Grocery item not found: ${id}`);
    }

    logger.info(`Deleted grocery item: ${id}`, "GROCERY_REPO");
  }

  async updateListTotal(listId: string): Promise<void> {
    // Calculate totals from items
    const result = this.db
      .prepare(
        `
      SELECT 
        COUNT(*) as total_items,
        SUM(estimated_price * quantity) as estimated_total
      FROM grocery_items
      WHERE list_id = ?
    `,
      )
      .get(listId) as { total_items: number; estimated_total: number | null };

    // Update the grocery_lists table with correct column names
    this.db
      .prepare(
        `
        UPDATE grocery_lists 
        SET items_count = ?,
            estimated_total = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      )
      ?.run(
        result.total_items || 0, 
        result.estimated_total || 0,
        listId
      );
  }

  private mapRowToItem(row: any): GroceryItem {
    // Convert numeric priority back to string
    let priority: 'essential' | 'high' | 'normal' | 'low' = 'normal';
    if (row.priority >= 10) priority = 'essential';
    else if (row.priority >= 7) priority = 'high';
    else if (row.priority >= 5) priority = 'normal';
    else priority = 'low';

    return {
      id: row.id,
      list_id: row.list_id,
      item_name: row.item_name, // Correct column name
      brand_preference: row.brand_preference,
      product_id: row.product_id,
      category: row.category,
      quantity: row.quantity,
      unit: row.unit,
      package_size: row.package_size,
      estimated_price: row.estimated_price,
      actual_price: row.actual_price,
      discount_amount: row.coupon_applied ? row.coupon_amount : null,
      status: row.status || 'pending',
      priority: priority,
      aisle_location: row.aisle_location,
      added_to_cart_at: row.checked_at, // Map checked_at to added_to_cart_at
      purchased_at: row.status === 'purchased' ? row.checked_at : null,
      substitution_id: row.substitute_product_id, // Map substitute_product_id to substitution_id
      notes: row.notes,
      dietary_flags: row.dietary_flags ? JSON.parse(row.dietary_flags) : [],
      created_at: row.added_at || row.created_at,
      updated_at: row.updated_at
    };
  }
}

export class ShoppingSessionRepository extends BaseRepository<ShoppingSession> {
  constructor(db: DatabaseInstance) {
    super(db, "shopping_sessions");
  }

  async createSession(data: ShoppingSession): Promise<ShoppingSession> {
    const session: ShoppingSession = {
      ...data,
      id: data.id || uuidv4(),
      session_type: data.session_type || "online",
      status: data.status || "active",
      items_total: data.items_total || 0,
      items_found: data.items_found || 0,
      items_substituted: data.items_substituted || 0,
      items_unavailable: data.items_unavailable || 0,
      started_at: data.started_at || new Date().toISOString(),
    };

    const stmt = this?.db?.prepare(`
      INSERT INTO shopping_sessions (
        id, user_id, list_id, session_type, status,
        items_total, items_found, items_substituted, items_unavailable,
        subtotal, tax_amount, delivery_fee, tip_amount, total_amount, savings_amount,
        fulfillment_type, delivery_address, delivery_time_slot
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt?.run(
      session.id,
      session.user_id,
      session.list_id,
      session.session_type,
      session.status,
      session.items_total,
      session.items_found,
      session.items_substituted,
      session.items_unavailable,
      session.subtotal,
      session.tax_amount,
      session.delivery_fee,
      session.tip_amount,
      session.total_amount,
      session.savings_amount,
      session.fulfillment_type,
      session.delivery_address,
      session.delivery_time_slot,
    );

    logger.info(`Created shopping session: ${session.id}`, "GROCERY_REPO");
    return this.getSession(session.id!);
  }

  async getSession(id: string): Promise<ShoppingSession> {
    const row = this.db
      .prepare("SELECT * FROM shopping_sessions WHERE id = ?")
      .get(id) as any;
    if (!row) {
      throw new Error(`Shopping session not found: ${id}`);
    }
    return row;
  }

  async getActiveSession(userId: string): Promise<ShoppingSession | null> {
    const row = this.db
      .prepare(
        `
      SELECT * FROM shopping_sessions 
      WHERE user_id = ? AND status = 'active' 
      ORDER BY started_at DESC 
      LIMIT 1
    `,
      )
      .get(userId) as any;

    return row || null;
  }

  async updateSession(
    id: string,
    updates: Partial<ShoppingSession>,
  ): Promise<ShoppingSession> {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key !== "id" && value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields?.length || 0 === 0) {
      return this.getSession(id);
    }

    values.push(id);

    const stmt = this?.db?.prepare(`
      UPDATE shopping_sessions 
      SET ${fields.join(", ")}
      WHERE id = ?
    `);

    stmt?.run(...values);
    return this.getSession(id);
  }

  async completeSession(
    id: string,
    orderNumber?: string,
  ): Promise<ShoppingSession> {
    const session = await this.getSession(id);
    const duration = Math.floor(
      (Date.now() - new Date(session.started_at!).getTime()) / 60000,
    );

    const updates: Partial<ShoppingSession> = {
      status: "completed",
      completed_at: new Date().toISOString(),
      duration_minutes: duration,
      order_number: orderNumber,
    };

    return this.updateSession(id, updates);
  }

  async updateProgress(
    id: string,
    progress: {
      itemsFound?: number;
      itemsSubstituted?: number;
      itemsUnavailable?: number;
    },
  ): Promise<ShoppingSession> {
    const updates: Partial<ShoppingSession> = {};

    if (progress.itemsFound !== undefined) {
      updates.items_found = progress.itemsFound;
    }
    if (progress.itemsSubstituted !== undefined) {
      updates.items_substituted = progress.itemsSubstituted;
    }
    if (progress.itemsUnavailable !== undefined) {
      updates.items_unavailable = progress.itemsUnavailable;
    }

    return this.updateSession(id, updates);
  }
}
