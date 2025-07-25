/**
 * Grocery Repository - Data access layer for grocery lists and shopping sessions
 * Handles list management, item tracking, and shopping session operations
 */

import type Database from "better-sqlite3";
import { BaseRepository } from "./BaseRepository";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../../utils/logger";

// Types for grocery entities
export interface GroceryList {
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
}

export interface GroceryItem {
  id: string;
  list_id: string;
  item_name: string;
  brand_preference?: string;
  product_id?: string;
  category?: string;
  quantity: number;
  unit?: string;
  package_size?: string;
  estimated_price?: number;
  actual_price?: number;
  discount_amount?: number;
  status?: "pending" | "in_cart" | "purchased" | "unavailable" | "substituted" | "removed";
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

export interface ShoppingSession {
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
  constructor(db: Database.Database) {
    super(db, "grocery_lists");
  }

  async createList(data: Partial<GroceryList>): Promise<GroceryList> {
    const list: GroceryList = {
      id: data.id || uuidv4(),
      user_id: data.user_id!,
      list_name: data.list_name!,
      description: data.description,
      list_type: data.list_type || "shopping",
      status: data.status || "active",
      store_preference: data.store_preference || "walmart",
      budget_limit: data.budget_limit,
      estimated_total: data.estimated_total || 0,
      actual_total: data.actual_total,
      is_recurring: data.is_recurring || false,
      recurrence_pattern: data.recurrence_pattern ? JSON.stringify(data.recurrence_pattern) : null,
      next_shop_date: data.next_shop_date,
      last_shopped_date: data.last_shopped_date,
      tags: data.tags || [],
      notes: data.notes,
      shared_with: data.shared_with || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const stmt = this.db.prepare(`
      INSERT INTO grocery_lists (
        id, user_id, list_name, description, list_type, status,
        store_preference, budget_limit, estimated_total, actual_total,
        is_recurring, recurrence_pattern, next_shop_date, last_shopped_date,
        tags, notes, shared_with
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      list.id,
      list.user_id,
      list.list_name,
      list.description,
      list.list_type,
      list.status,
      list.store_preference,
      list.budget_limit,
      list.estimated_total,
      list.actual_total,
      list.is_recurring ? 1 : 0,
      list.recurrence_pattern,
      list.next_shop_date,
      list.last_shopped_date,
      JSON.stringify(list.tags),
      list.notes,
      JSON.stringify(list.shared_with)
    );

    logger.info(`Created grocery list: ${list.id}`, "GROCERY_REPO");
    return this.getList(list.id);
  }

  async getList(listId: string): Promise<GroceryList> {
    const row = this.db
      .prepare("SELECT * FROM grocery_lists WHERE id = ?")
      .get(listId) as any;
    
    if (!row) {
      throw new Error(`Grocery list not found: ${listId}`);
    }
    
    return this.mapRowToList(row);
  }

  async getUserLists(
    userId: string, 
    status?: string,
    limit?: number
  ): Promise<GroceryList[]> {
    let query = "SELECT * FROM grocery_lists WHERE user_id = ?";
    const params: any[] = [userId];

    if (status) {
      query += " AND status = ?";
      params.push(status);
    }

    query += " ORDER BY updated_at DESC";

    if (limit) {
      query += " LIMIT ?";
      params.push(limit);
    }

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map(row => this.mapRowToList(row));
  }

  async updateList(listId: string, updates: Partial<GroceryList>): Promise<GroceryList> {
    const updateFields: string[] = [];
    const values: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== "id" && key !== "created_at") {
        updateFields.push(`${key} = ?`);
        if (key === "tags" || key === "shared_with") {
          values.push(JSON.stringify(value));
        } else if (key === "is_recurring") {
          values.push(value ? 1 : 0);
        } else {
          values.push(value);
        }
      }
    });

    updateFields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(listId);

    const stmt = this.db.prepare(`
      UPDATE grocery_lists 
      SET ${updateFields.join(", ")}
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.getList(listId);
  }

  async completeList(listId: string, actualTotal?: number): Promise<GroceryList> {
    return this.updateList(listId, {
      status: "completed",
      actual_total: actualTotal,
      completed_at: new Date().toISOString()
    });
  }

  async archiveList(listId: string): Promise<GroceryList> {
    return this.updateList(listId, { status: "archived" });
  }

  async deleteList(listId: string): Promise<void> {
    this.db.prepare("DELETE FROM grocery_lists WHERE id = ?").run(listId);
    logger.info(`Deleted grocery list: ${listId}`, "GROCERY_REPO");
  }

  private mapRowToList(row: any): GroceryList {
    return {
      ...row,
      is_recurring: !!row.is_recurring,
      recurrence_pattern: row.recurrence_pattern ? JSON.parse(row.recurrence_pattern) : null,
      tags: row.tags ? JSON.parse(row.tags) : [],
      shared_with: row.shared_with ? JSON.parse(row.shared_with) : []
    };
  }
}

export class GroceryItemRepository extends BaseRepository<GroceryItem> {
  constructor(db: Database.Database) {
    super(db, "grocery_items");
  }

  async addItem(data: Partial<GroceryItem>): Promise<GroceryItem> {
    const item: GroceryItem = {
      id: data.id || uuidv4(),
      list_id: data.list_id!,
      item_name: data.item_name!,
      brand_preference: data.brand_preference,
      product_id: data.product_id,
      category: data.category,
      quantity: data.quantity || 1,
      unit: data.unit || "each",
      package_size: data.package_size,
      estimated_price: data.estimated_price,
      actual_price: data.actual_price,
      discount_amount: data.discount_amount,
      status: data.status || "pending",
      priority: data.priority || "normal",
      aisle_location: data.aisle_location,
      substitution_id: data.substitution_id,
      notes: data.notes,
      dietary_flags: data.dietary_flags || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const stmt = this.db.prepare(`
      INSERT INTO grocery_items (
        id, list_id, item_name, brand_preference, product_id, category,
        quantity, unit, package_size, estimated_price, actual_price,
        discount_amount, status, priority, aisle_location, substitution_id,
        notes, dietary_flags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      item.id,
      item.list_id,
      item.item_name,
      item.brand_preference,
      item.product_id,
      item.category,
      item.quantity,
      item.unit,
      item.package_size,
      item.estimated_price,
      item.actual_price,
      item.discount_amount,
      item.status,
      item.priority,
      item.aisle_location,
      item.substitution_id,
      item.notes,
      JSON.stringify(item.dietary_flags)
    );

    logger.info(`Added grocery item: ${item.id}`, "GROCERY_REPO");
    return this.getItem(item.id);
  }

  async getItem(itemId: string): Promise<GroceryItem> {
    const row = this.db
      .prepare("SELECT * FROM grocery_items WHERE id = ?")
      .get(itemId) as any;
    
    if (!row) {
      throw new Error(`Grocery item not found: ${itemId}`);
    }
    
    return this.mapRowToItem(row);
  }

  async getItemsByList(listId: string): Promise<GroceryItem[]> {
    const rows = this.db
      .prepare("SELECT * FROM grocery_items WHERE list_id = ? ORDER BY priority DESC, created_at ASC")
      .all(listId) as any[];
    
    return rows.map(row => this.mapRowToItem(row));
  }

  async getItemsByStatus(listId: string, status: string): Promise<GroceryItem[]> {
    const rows = this.db
      .prepare("SELECT * FROM grocery_items WHERE list_id = ? AND status = ?")
      .all(listId, status) as any[];
    
    return rows.map(row => this.mapRowToItem(row));
  }

  async updateItem(itemId: string, updates: Partial<GroceryItem>): Promise<GroceryItem> {
    const updateFields: string[] = [];
    const values: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== "id" && key !== "created_at") {
        updateFields.push(`${key} = ?`);
        if (key === "dietary_flags") {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
      }
    });

    updateFields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(itemId);

    const stmt = this.db.prepare(`
      UPDATE grocery_items 
      SET ${updateFields.join(", ")}
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.getItem(itemId);
  }

  async updateItemStatus(
    itemId: string, 
    status: GroceryItem["status"],
    actualPrice?: number
  ): Promise<GroceryItem> {
    const updates: Partial<GroceryItem> = { status };
    
    if (status === "purchased" && actualPrice !== undefined) {
      updates.actual_price = actualPrice;
      updates.purchased_at = new Date().toISOString();
    } else if (status === "in_cart") {
      updates.added_to_cart_at = new Date().toISOString();
    }

    return this.updateItem(itemId, updates);
  }

  async deleteItem(itemId: string): Promise<void> {
    this.db.prepare("DELETE FROM grocery_items WHERE id = ?").run(itemId);
    logger.info(`Deleted grocery item: ${itemId}`, "GROCERY_REPO");
  }

  async deleteItemsByList(listId: string): Promise<void> {
    this.db.prepare("DELETE FROM grocery_items WHERE list_id = ?").run(listId);
    logger.info(`Deleted all items for list: ${listId}`, "GROCERY_REPO");
  }

  private mapRowToItem(row: any): GroceryItem {
    return {
      ...row,
      dietary_flags: row.dietary_flags ? JSON.parse(row.dietary_flags) : []
    };
  }
}

export class ShoppingSessionRepository extends BaseRepository<ShoppingSession> {
  constructor(db: Database.Database) {
    super(db, "shopping_sessions");
  }

  async createSession(data: Partial<ShoppingSession>): Promise<ShoppingSession> {
    const session: ShoppingSession = {
      id: data.id || uuidv4(),
      user_id: data.user_id!,
      list_id: data.list_id,
      session_type: data.session_type || "online",
      status: data.status || "active",
      items_total: data.items_total || 0,
      items_found: data.items_found || 0,
      items_substituted: data.items_substituted || 0,
      items_unavailable: data.items_unavailable || 0,
      started_at: new Date().toISOString()
    };

    const stmt = this.db.prepare(`
      INSERT INTO shopping_sessions (
        id, user_id, list_id, session_type, status,
        items_total, items_found, items_substituted, items_unavailable
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      session.id,
      session.user_id,
      session.list_id,
      session.session_type,
      session.status,
      session.items_total,
      session.items_found,
      session.items_substituted,
      session.items_unavailable
    );

    logger.info(`Created shopping session: ${session.id}`, "GROCERY_REPO");
    return this.getSession(session.id);
  }

  async getSession(sessionId: string): Promise<ShoppingSession> {
    const row = this.db
      .prepare("SELECT * FROM shopping_sessions WHERE id = ?")
      .get(sessionId) as any;
    
    if (!row) {
      throw new Error(`Shopping session not found: ${sessionId}`);
    }
    
    return row;
  }

  async getUserSessions(
    userId: string,
    status?: string,
    limit?: number
  ): Promise<ShoppingSession[]> {
    let query = "SELECT * FROM shopping_sessions WHERE user_id = ?";
    const params: any[] = [userId];

    if (status) {
      query += " AND status = ?";
      params.push(status);
    }

    query += " ORDER BY started_at DESC";

    if (limit) {
      query += " LIMIT ?";
      params.push(limit);
    }

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows;
  }

  async getActiveSession(userId: string): Promise<ShoppingSession | null> {
    const row = this.db
      .prepare("SELECT * FROM shopping_sessions WHERE user_id = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1")
      .get(userId) as any;
    
    return row || null;
  }

  async updateSession(sessionId: string, updates: Partial<ShoppingSession>): Promise<ShoppingSession> {
    const updateFields: string[] = [];
    const values: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== "id" && key !== "started_at") {
        updateFields.push(`${key} = ?`);
        values.push(value);
      }
    });

    values.push(sessionId);

    const stmt = this.db.prepare(`
      UPDATE shopping_sessions 
      SET ${updateFields.join(", ")}
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.getSession(sessionId);
  }

  async completeSession(sessionId: string, totals: {
    subtotal: number;
    tax_amount?: number;
    delivery_fee?: number;
    tip_amount?: number;
    total_amount: number;
    savings_amount?: number;
  }): Promise<ShoppingSession> {
    const session = await this.getSession(sessionId);
    const duration = Math.floor(
      (Date.now() - new Date(session.started_at!).getTime()) / (1000 * 60)
    );

    return this.updateSession(sessionId, {
      ...totals,
      status: "completed",
      completed_at: new Date().toISOString(),
      duration_minutes: duration
    });
  }

  async abandonSession(sessionId: string): Promise<ShoppingSession> {
    return this.updateSession(sessionId, {
      status: "abandoned",
      completed_at: new Date().toISOString()
    });
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.db.prepare("DELETE FROM shopping_sessions WHERE id = ?").run(sessionId);
    logger.info(`Deleted shopping session: ${sessionId}`, "GROCERY_REPO");
  }
}