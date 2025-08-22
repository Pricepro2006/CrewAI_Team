/**
 * Grocery Repository - Data access layer for grocery-related tables
 * Handles grocery lists, items, and shopping sessions
 */
import { BaseRepository } from "./BaseRepository.js";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../../utils/logger.js";
export class GroceryListRepository extends BaseRepository {
    constructor(db) {
        super(db, "grocery_lists");
    }
    async createList(data) {
        const list = {
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
        id, user_id, list_name, description, list_type, status,
        store_preference, budget_limit, estimated_total, actual_total,
        is_recurring, recurrence_pattern, next_shop_date, last_shopped_date,
        tags, notes, shared_with
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(list.id, list.user_id, list.list_name, list.description, list.list_type, list.status, list.store_preference, list.budget_limit, list.estimated_total, list.actual_total, list.is_recurring ? 1 : 0, JSON.stringify(list.recurrence_pattern), list.next_shop_date, list.last_shopped_date, JSON.stringify(list.tags), list.notes, JSON.stringify(list.shared_with));
        logger.info(`Created grocery list: ${list.id}`, "GROCERY_REPO");
        return this.getList(list.id);
    }
    async getList(id) {
        const row = this.db
            .prepare("SELECT * FROM grocery_lists WHERE id = ?")
            .get(id);
        if (!row) {
            throw new Error(`Grocery list not found: ${id}`);
        }
        return this.mapRowToList(row);
    }
    async getUserLists(userId, status) {
        let query = "SELECT * FROM grocery_lists WHERE user_id = ?";
        const params = [userId];
        if (status) {
            query += " AND status = ?";
            params.push(status);
        }
        query += " ORDER BY updated_at DESC";
        const rows = this?.db?.prepare(query).all(...params);
        return rows?.map((row) => this.mapRowToList(row));
    }
    async updateList(id, updates) {
        const fields = [];
        const values = [];
        for (const [key, value] of Object.entries(updates)) {
            if (key !== "id" && value !== undefined) {
                fields.push(`${key} = ?`);
                if (["tags", "shared_with", "recurrence_pattern"].includes(key)) {
                    values.push(JSON.stringify(value));
                }
                else if (key === "is_recurring") {
                    values.push(value ? 1 : 0);
                }
                else {
                    values.push(value);
                }
            }
        }
        if (fields?.length || 0 === 0) {
            return this.getList(id);
        }
        fields.push("updated_at = CURRENT_TIMESTAMP");
        values.push(id);
        const stmt = this?.db?.prepare(`
      UPDATE grocery_lists 
      SET ${fields.join(", ")}
      WHERE id = ?
    `);
        stmt.run(...values);
        return this.getList(id);
    }
    async completeList(id, actualTotal) {
        const updates = {
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
    async deleteList(id) {
        // First delete all items in the list
        const stmt1 = this?.db?.prepare(`DELETE FROM grocery_items WHERE list_id = ?`);
        stmt1.run(id);
        // Then delete the list itself
        const stmt2 = this?.db?.prepare(`DELETE FROM grocery_lists WHERE id = ?`);
        const result = stmt2.run(id);
        if (result.changes === 0) {
            throw new Error(`Grocery list not found: ${id}`);
        }
        logger.info(`Deleted grocery list: ${id}`, "GROCERY_REPO");
    }
    mapRowToList(row) {
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
export class GroceryItemRepository extends BaseRepository {
    constructor(db) {
        super(db, "grocery_items");
    }
    async addItem(data) {
        const item = {
            ...data,
            id: data.id || uuidv4(),
            quantity: data.quantity ?? 1,
            unit: data.unit || "each",
            status: data.status || "pending",
            priority: data.priority || "normal",
            dietary_flags: data.dietary_flags || [],
        };
        const stmt = this?.db?.prepare(`
      INSERT INTO grocery_items (
        id, list_id, item_name, brand_preference, product_id, category,
        quantity, unit, package_size, estimated_price, actual_price,
        discount_amount, status, priority, aisle_location, notes, dietary_flags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(item.id, item.list_id, item.item_name, item.brand_preference, item.product_id, item.category, item.quantity, item.unit, item.package_size, item.estimated_price, item.actual_price, item.discount_amount, item.status, item.priority, item.aisle_location, item.notes, JSON.stringify(item.dietary_flags));
        logger.info(`Added grocery item: ${item.id}`, "GROCERY_REPO");
        return this.getItem(item.id);
    }
    async getItem(id) {
        const row = this.db
            .prepare("SELECT * FROM grocery_items WHERE id = ?")
            .get(id);
        if (!row) {
            throw new Error(`Grocery item not found: ${id}`);
        }
        return this.mapRowToItem(row);
    }
    async getListItems(listId, status) {
        let query = "SELECT * FROM grocery_items WHERE list_id = ?";
        const params = [listId];
        if (status) {
            query += " AND status = ?";
            params.push(status);
        }
        query += " ORDER BY priority DESC, created_at ASC";
        const rows = this?.db?.prepare(query).all(...params);
        return rows?.map((row) => this.mapRowToItem(row));
    }
    async updateItem(id, updates) {
        const fields = [];
        const values = [];
        for (const [key, value] of Object.entries(updates)) {
            if (key !== "id" && value !== undefined) {
                fields.push(`${key} = ?`);
                if (key === "dietary_flags") {
                    values.push(JSON.stringify(value));
                }
                else {
                    values.push(value);
                }
            }
        }
        if (fields?.length || 0 === 0) {
            return this.getItem(id);
        }
        fields.push("updated_at = CURRENT_TIMESTAMP");
        values.push(id);
        const stmt = this?.db?.prepare(`
      UPDATE grocery_items 
      SET ${fields.join(", ")}
      WHERE id = ?
    `);
        stmt.run(...values);
        return this.getItem(id);
    }
    async markAsCart(id) {
        return this.updateItem(id, {
            status: "in_cart",
            added_to_cart_at: new Date().toISOString(),
        });
    }
    async markAsPurchased(id, actualPrice) {
        const updates = {
            status: "purchased",
            purchased_at: new Date().toISOString(),
        };
        if (actualPrice !== undefined) {
            updates.actual_price = actualPrice;
        }
        return this.updateItem(id, updates);
    }
    async substituteItem(id, substitutionId) {
        return this.updateItem(id, {
            status: "substituted",
            substitution_id: substitutionId,
        });
    }
    async deleteItem(id) {
        const stmt = this?.db?.prepare(`DELETE FROM grocery_items WHERE id = ?`);
        const result = stmt.run(id);
        if (result.changes === 0) {
            throw new Error(`Grocery item not found: ${id}`);
        }
        logger.info(`Deleted grocery item: ${id}`, "GROCERY_REPO");
    }
    async updateListTotal(listId) {
        const result = this.db
            .prepare(`
      SELECT 
        SUM(CASE WHEN status = 'purchased' THEN actual_price * quantity ELSE estimated_price * quantity END) as total
      FROM grocery_items
      WHERE list_id = ? AND status NOT IN ('removed', 'unavailable')
    `)
            .get(listId);
        this.db
            .prepare(`
      UPDATE grocery_lists 
      SET estimated_total = ?
      WHERE id = ?
    `)
            .run(result.total || 0, listId);
    }
    mapRowToItem(row) {
        return {
            ...row,
            dietary_flags: row.dietary_flags ? JSON.parse(row.dietary_flags) : [],
        };
    }
}
export class ShoppingSessionRepository extends BaseRepository {
    constructor(db) {
        super(db, "shopping_sessions");
    }
    async createSession(data) {
        const session = {
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
        stmt.run(session.id, session.user_id, session.list_id, session.session_type, session.status, session.items_total, session.items_found, session.items_substituted, session.items_unavailable, session.subtotal, session.tax_amount, session.delivery_fee, session.tip_amount, session.total_amount, session.savings_amount, session.fulfillment_type, session.delivery_address, session.delivery_time_slot);
        logger.info(`Created shopping session: ${session.id}`, "GROCERY_REPO");
        return this.getSession(session.id);
    }
    async getSession(id) {
        const row = this.db
            .prepare("SELECT * FROM shopping_sessions WHERE id = ?")
            .get(id);
        if (!row) {
            throw new Error(`Shopping session not found: ${id}`);
        }
        return row;
    }
    async getActiveSession(userId) {
        const row = this.db
            .prepare(`
      SELECT * FROM shopping_sessions 
      WHERE user_id = ? AND status = 'active' 
      ORDER BY started_at DESC 
      LIMIT 1
    `)
            .get(userId);
        return row || null;
    }
    async updateSession(id, updates) {
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
        stmt.run(...values);
        return this.getSession(id);
    }
    async completeSession(id, orderNumber) {
        const session = await this.getSession(id);
        const duration = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 60000);
        const updates = {
            status: "completed",
            completed_at: new Date().toISOString(),
            duration_minutes: duration,
            order_number: orderNumber,
        };
        return this.updateSession(id, updates);
    }
    async updateProgress(id, progress) {
        const updates = {};
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
