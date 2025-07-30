/**
 * Grocery Repository - Data access layer for grocery-related tables
 * Handles grocery lists, items, and shopping sessions
 */

import type Database from "better-sqlite3";
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
  constructor(db: Database.Database) {
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
      JSON.stringify(list.recurrence_pattern),
      list.next_shop_date,
      list.last_shopped_date,
      JSON.stringify(list.tags),
      list.notes,
      JSON.stringify(list.shared_with),
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

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map((row) => this.mapRowToList(row));
  }

  async updateList(
    id: string,
    updates: Partial<GroceryList>,
  ): Promise<GroceryList> {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key !== "id" && value !== undefined) {
        fields.push(`${key} = ?`);
        if (["tags", "shared_with", "recurrence_pattern"].includes(key)) {
          values.push(JSON.stringify(value));
        } else if (key === "is_recurring") {
          values.push(value ? 1 : 0);
        } else {
          values.push(value);
        }
      }
    }

    if (fields.length === 0) {
      return this.getList(id);
    }

    fields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE grocery_lists 
      SET ${fields.join(", ")}
      WHERE id = ?
    `);

    stmt.run(...values);
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
    const stmt1 = this.db.prepare(
      `DELETE FROM grocery_items WHERE list_id = ?`,
    );
    stmt1.run(id);

    // Then delete the list itself
    const stmt2 = this.db.prepare(`DELETE FROM grocery_lists WHERE id = ?`);
    const result = stmt2.run(id);

    if (result.changes === 0) {
      throw new Error(`Grocery list not found: ${id}`);
    }

    logger.info(`Deleted grocery list: ${id}`, "GROCERY_REPO");
  }

  private mapRowToList(row: any): GroceryList {
    return {
      ...row,
      is_recurring: !!row.is_recurring,
      tags: row.tags ? JSON.parse(row.tags) : [],
      shared_with: row.shared_with ? JSON.parse(row.shared_with) : [],
      recurrence_pattern: row.recurrence_pattern
        ? JSON.parse(row.recurrence_pattern)
        : null,
    };
  }
}

export class GroceryItemRepository extends BaseRepository<GroceryItem> {
  constructor(db: Database.Database) {
    super(db, "grocery_items");
  }

  async addItem(data: GroceryItem): Promise<GroceryItem> {
    const item: GroceryItem = {
      ...data,
      id: data.id || uuidv4(),
      quantity: data.quantity ?? 1,
      unit: data.unit || "each",
      status: data.status || "pending",
      priority: data.priority || "normal",
      dietary_flags: data.dietary_flags || [],
    };

    const stmt = this.db.prepare(`
      INSERT INTO grocery_items (
        id, list_id, item_name, brand_preference, product_id, category,
        quantity, unit, package_size, estimated_price, actual_price,
        discount_amount, status, priority, aisle_location, notes, dietary_flags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      item.notes,
      JSON.stringify(item.dietary_flags),
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

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map((row) => this.mapRowToItem(row));
  }

  async updateItem(
    id: string,
    updates: Partial<GroceryItem>,
  ): Promise<GroceryItem> {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key !== "id" && value !== undefined) {
        fields.push(`${key} = ?`);
        if (key === "dietary_flags") {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
      }
    }

    if (fields.length === 0) {
      return this.getItem(id);
    }

    fields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE grocery_items 
      SET ${fields.join(", ")}
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.getItem(id);
  }

  async markAsCart(id: string): Promise<GroceryItem> {
    return this.updateItem(id, {
      status: "in_cart",
      added_to_cart_at: new Date().toISOString(),
    });
  }

  async markAsPurchased(
    id: string,
    actualPrice?: number,
  ): Promise<GroceryItem> {
    const updates: Partial<GroceryItem> = {
      status: "purchased",
      purchased_at: new Date().toISOString(),
    };

    if (actualPrice !== undefined) {
      updates.actual_price = actualPrice;
    }

    return this.updateItem(id, updates);
  }

  async substituteItem(
    id: string,
    substitutionId: string,
  ): Promise<GroceryItem> {
    return this.updateItem(id, {
      status: "substituted",
      substitution_id: substitutionId,
    });
  }

  async deleteItem(id: string): Promise<void> {
    const stmt = this.db.prepare(`DELETE FROM grocery_items WHERE id = ?`);
    const result = stmt.run(id);

    if (result.changes === 0) {
      throw new Error(`Grocery item not found: ${id}`);
    }

    logger.info(`Deleted grocery item: ${id}`, "GROCERY_REPO");
  }

  async updateListTotal(listId: string): Promise<void> {
    const result = this.db
      .prepare(
        `
      SELECT 
        SUM(CASE WHEN status = 'purchased' THEN actual_price * quantity ELSE estimated_price * quantity END) as total
      FROM grocery_items
      WHERE list_id = ? AND status NOT IN ('removed', 'unavailable')
    `,
      )
      .get(listId) as { total: number };

    this.db
      .prepare(
        `
      UPDATE grocery_lists 
      SET estimated_total = ?
      WHERE id = ?
    `,
      )
      .run(result.total || 0, listId);
  }

  private mapRowToItem(row: any): GroceryItem {
    return {
      ...row,
      dietary_flags: row.dietary_flags ? JSON.parse(row.dietary_flags) : [],
    };
  }
}

export class ShoppingSessionRepository extends BaseRepository<ShoppingSession> {
  constructor(db: Database.Database) {
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

    const stmt = this.db.prepare(`
      INSERT INTO shopping_sessions (
        id, user_id, list_id, session_type, status,
        items_total, items_found, items_substituted, items_unavailable,
        subtotal, tax_amount, delivery_fee, tip_amount, total_amount, savings_amount,
        fulfillment_type, delivery_address, delivery_time_slot
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

    if (fields.length === 0) {
      return this.getSession(id);
    }

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE shopping_sessions 
      SET ${fields.join(", ")}
      WHERE id = ?
    `);

    stmt.run(...values);
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
