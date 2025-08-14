/**
 * Budget Tracking Service
 * Manages user budgets, spending analytics, and budget alerts
 */

import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../../utils/logger.js";
import { EventEmitter } from "events";

export interface CategoryBudget {
  category: string;
  allocated: number;
  spent: number;
  percentage: number;
  transactions?: number;
}

export interface BudgetSummary {
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  percentage: number;
  categories: CategoryBudget[];
  period: string;
  startDate: string;
  endDate: string;
}

export interface SpendingAnalytics {
  totalSpent: number;
  averagePerTransaction: number;
  transactionCount: number;
  categoryBreakdown: Record<string, number>;
  dailySpending: Array<{ date: string; amount: number }>;
  topProducts: Array<{ name: string; count: number; total: number }>;
  savingsOpportunities: Array<{ category: string; potential: number; suggestion: string }>;
}

export interface UserBudgetPreferences {
  userId: string;
  monthlyBudget: number;
  categoryBudgets: Record<string, number>;
  alertThreshold: number; // Percentage at which to alert (e.g., 80%)
  rolloverEnabled: boolean;
  autoAdjust: boolean; // Auto-adjust budgets based on spending patterns
  createdAt: string;
  updatedAt: string;
}

// Default category budget percentages
const DEFAULT_CATEGORY_BUDGETS = {
  "Fresh Produce": 0.25,
  "Dairy & Eggs": 0.15,
  "Meat & Seafood": 0.20,
  "Pantry": 0.20,
  "Snacks & Beverages": 0.10,
  "Frozen Foods": 0.05,
  "Other": 0.05
};

export class BudgetTrackingService extends EventEmitter {
  private db: Database.Database;
  private checkInterval: NodeJS.Timeout | null = null;
  
  constructor(db: Database.Database) {
    super();
    this.db = db;
    this.ensureTablesExist();
  }

  /**
   * Initialize the service
   */
  async initialize() {
    logger.info("Initializing Budget Tracking Service", "BUDGET");
    
    // Start budget monitoring
    this.startBudgetMonitoring();
    
    logger.info("Budget Tracking Service initialized", "BUDGET");
  }

  /**
   * Get user's budget preferences
   */
  getUserBudgetPreferences(userId: string): UserBudgetPreferences | null {
    const stmt = this.db.prepare(`
      SELECT * FROM user_budget_preferences 
      WHERE user_id = ?
    `);
    
    const row = stmt.get(userId) as any;
    
    if (!row) {
      // Return default preferences if none exist
      return this.createDefaultPreferences(userId);
    }
    
    return {
      userId: row.user_id,
      monthlyBudget: row.monthly_budget,
      categoryBudgets: JSON.parse(row.category_budgets || '{}'),
      alertThreshold: row.alert_threshold,
      rolloverEnabled: row.rollover_enabled,
      autoAdjust: row.auto_adjust,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Create default preferences for a user
   */
  private createDefaultPreferences(userId: string): UserBudgetPreferences {
    const defaultBudget = 500; // Default $500 monthly budget
    const categoryBudgets: Record<string, number> = {};
    
    // Calculate category budgets based on default percentages
    Object.entries(DEFAULT_CATEGORY_BUDGETS).forEach(([category, percentage]) => {
      categoryBudgets[category] = defaultBudget * percentage;
    });
    
    const preferences: UserBudgetPreferences = {
      userId,
      monthlyBudget: defaultBudget,
      categoryBudgets,
      alertThreshold: 80,
      rolloverEnabled: false,
      autoAdjust: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Save to database
    this.saveUserBudgetPreferences(preferences);
    
    return preferences;
  }

  /**
   * Save user budget preferences
   */
  saveUserBudgetPreferences(preferences: UserBudgetPreferences): boolean {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO user_budget_preferences (
        user_id, monthly_budget, category_budgets, alert_threshold,
        rollover_enabled, auto_adjust, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    try {
      stmt.run(
        preferences.userId,
        preferences.monthlyBudget,
        JSON.stringify(preferences.categoryBudgets),
        preferences.alertThreshold,
        preferences.rolloverEnabled ? 1 : 0,
        preferences.autoAdjust ? 1 : 0,
        preferences.createdAt,
        new Date().toISOString()
      );
      
      logger.info(`Saved budget preferences for user ${preferences.userId}`, "BUDGET");
      
      // Emit event
      this.emit("budget:preferences_updated", preferences);
      
      return true;
    } catch (error) {
      logger.error(`Failed to save budget preferences: ${error}`, "BUDGET");
      return false;
    }
  }

  /**
   * Get budget summary for a user
   */
  getBudgetSummary(userId: string, period: "month" | "week" | "custom" = "month", startDate?: string, endDate?: string): BudgetSummary {
    const preferences = this.getUserBudgetPreferences(userId);
    
    if (!preferences) {
      throw new Error("User preferences not found");
    }
    
    // Calculate date range
    const now = new Date();
    let start: Date, end: Date;
    
    if (period === "month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (period === "week") {
      const dayOfWeek = now.getDay();
      start = new Date(now);
      start.setDate(now.getDate() - dayOfWeek);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
    } else {
      start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
      end = endDate ? new Date(endDate) : new Date();
    }
    
    // Get spending data
    const spending = this.calculateSpending(userId, start, end);
    
    // Build category breakdown
    const categories: CategoryBudget[] = [];
    const allCategories = new Set([
      ...Object.keys(preferences.categoryBudgets),
      ...Object.keys(spending.categoryBreakdown)
    ]);
    
    let totalAllocated = 0;
    let totalSpent = 0;
    
    allCategories.forEach(category => {
      const allocated = preferences.categoryBudgets[category] || 0;
      const spent = spending.categoryBreakdown[category] || 0;
      const percentage = allocated > 0 ? (spent / allocated) * 100 : 0;
      
      totalAllocated += allocated;
      totalSpent += spent;
      
      categories.push({
        category,
        allocated,
        spent,
        percentage,
        transactions: spending.categoryTransactions?.[category] || 0
      });
    });
    
    // Sort categories by spending
    categories.sort((a, b) => b.spent - a.spent);
    
    const summary: BudgetSummary = {
      totalBudget: preferences.monthlyBudget,
      totalSpent: spending.totalSpent,
      remaining: preferences.monthlyBudget - spending.totalSpent,
      percentage: (spending.totalSpent / preferences.monthlyBudget) * 100,
      categories,
      period,
      startDate: start.toISOString(),
      endDate: end.toISOString()
    };
    
    // Check if alert should be triggered
    if (summary.percentage >= preferences.alertThreshold) {
      this.emit("budget:threshold_exceeded", {
        userId,
        percentage: summary.percentage,
        threshold: preferences.alertThreshold
      });
    }
    
    return summary;
  }

  /**
   * Calculate spending for a period
   */
  private calculateSpending(userId: string, startDate: Date, endDate: Date) {
    // Query purchase history
    const stmt = this.db.prepare(`
      SELECT 
        p.category_path as category,
        SUM(oi.quantity * oi.price) as total,
        COUNT(DISTINCT oi.order_id) as transaction_count
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN products p ON oi.product_id = p.id
      WHERE o.user_id = ?
        AND o.created_at >= ?
        AND o.created_at <= ?
      GROUP BY p.category_path
    `);
    
    const rows = stmt.all(
      userId,
      startDate.toISOString(),
      endDate.toISOString()
    ) as any[];
    
    const categoryBreakdown: Record<string, number> = {};
    const categoryTransactions: Record<string, number> = {};
    let totalSpent = 0;
    
    rows.forEach(row => {
      const category = this.normalizeCategory(row.category);
      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + row.total;
      categoryTransactions[category] = row.transaction_count;
      totalSpent += row.total;
    });
    
    return {
      totalSpent,
      categoryBreakdown,
      categoryTransactions
    };
  }

  /**
   * Get spending analytics
   */
  getSpendingAnalytics(userId: string, timeRange: "week" | "month" | "quarter" = "month"): SpendingAnalytics {
    const now = new Date();
    let startDate: Date;
    
    switch (timeRange) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "quarter":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default: // month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    
    // Get all purchases in the period
    const purchasesStmt = this.db.prepare(`
      SELECT 
        o.created_at as date,
        p.name as product_name,
        p.category_path as category,
        oi.quantity,
        oi.price,
        (oi.quantity * oi.price) as total
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN products p ON oi.product_id = p.id
      WHERE o.user_id = ?
        AND o.created_at >= ?
      ORDER BY o.created_at DESC
    `);
    
    const purchases = purchasesStmt.all(userId, startDate.toISOString()) as any[];
    
    // Calculate analytics
    let totalSpent = 0;
    const categoryBreakdown: Record<string, number> = {};
    const dailySpending: Record<string, number> = {};
    const productStats: Record<string, { count: number; total: number }> = {};
    
    purchases.forEach(purchase => {
      const date = purchase.date.split('T')[0];
      const category = this.normalizeCategory(purchase.category);
      
      totalSpent += purchase.total;
      
      // Category breakdown
      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + purchase.total;
      
      // Daily spending
      dailySpending[date] = (dailySpending[date] || 0) + purchase.total;
      
      // Product stats
      if (!productStats[purchase.product_name]) {
        productStats[purchase.product_name] = { count: 0, total: 0 };
      }
      productStats[purchase.product_name].count += purchase.quantity;
      productStats[purchase.product_name].total += purchase.total;
    });
    
    // Convert daily spending to array
    const dailySpendingArray = Object.entries(dailySpending)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    // Get top products
    const topProducts = Object.entries(productStats)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
    
    // Generate savings opportunities
    const savingsOpportunities = this.generateSavingsOpportunities(categoryBreakdown, purchases);
    
    return {
      totalSpent,
      averagePerTransaction: purchases.length > 0 ? totalSpent / purchases.length : 0,
      transactionCount: purchases.length,
      categoryBreakdown,
      dailySpending: dailySpendingArray,
      topProducts,
      savingsOpportunities
    };
  }

  /**
   * Generate savings opportunities based on spending patterns
   */
  private generateSavingsOpportunities(categoryBreakdown: Record<string, number>, purchases: any[]): Array<{ category: string; potential: number; suggestion: string }> {
    const opportunities = [];
    
    // Check for high spending categories
    Object.entries(categoryBreakdown).forEach(([category, amount]) => {
      if (amount > 100) { // If spending over $100 in a category
        opportunities.push({
          category,
          potential: amount * 0.15, // Potential 15% savings
          suggestion: `Consider buying generic brands in ${category} to save up to 15%`
        });
      }
    });
    
    // Check for frequent small purchases
    const dailyPurchases: Record<string, number> = {};
    purchases.forEach(p => {
      const date = p.date.split('T')[0];
      dailyPurchases[date] = (dailyPurchases[date] || 0) + 1;
    });
    
    const avgDailyPurchases = Object.values(dailyPurchases).reduce((a, b) => a + b, 0) / Object.keys(dailyPurchases).length;
    if (avgDailyPurchases > 2) {
      opportunities.push({
        category: "Shopping Frequency",
        potential: 50,
        suggestion: "Consolidate shopping trips to reduce impulse purchases"
      });
    }
    
    return opportunities.slice(0, 5); // Return top 5 opportunities
  }

  /**
   * Update category budget
   */
  updateCategoryBudget(userId: string, category: string, amount: number): boolean {
    const preferences = this.getUserBudgetPreferences(userId);
    
    if (!preferences) {
      return false;
    }
    
    preferences.categoryBudgets[category] = amount;
    
    return this.saveUserBudgetPreferences(preferences);
  }

  /**
   * Update monthly budget
   */
  updateMonthlyBudget(userId: string, amount: number): boolean {
    const preferences = this.getUserBudgetPreferences(userId);
    
    if (!preferences) {
      return false;
    }
    
    preferences.monthlyBudget = amount;
    
    // Optionally recalculate category budgets proportionally
    if (preferences.autoAdjust) {
      const ratio = amount / Object.values(preferences.categoryBudgets).reduce((a, b) => a + b, 0);
      Object.keys(preferences.categoryBudgets).forEach(category => {
        preferences.categoryBudgets[category] *= ratio;
      });
    }
    
    return this.saveUserBudgetPreferences(preferences);
  }

  /**
   * Normalize category names
   */
  private normalizeCategory(category: string): string {
    if (!category) return "Other";
    
    // Extract main category from path (e.g., "Dairy & Eggs/Milk" -> "Dairy & Eggs")
    const mainCategory = category.split('/')[0];
    
    // Map to standard categories
    const categoryMap: Record<string, string> = {
      "Dairy": "Dairy & Eggs",
      "Produce": "Fresh Produce",
      "Meat": "Meat & Seafood",
      "Frozen": "Frozen Foods",
      "Beverages": "Snacks & Beverages",
      "Snacks": "Snacks & Beverages"
    };
    
    // Check if main category matches any mapping
    for (const [key, value] of Object.entries(categoryMap)) {
      if (mainCategory.includes(key)) {
        return value;
      }
    }
    
    // Return as-is if it's already a standard category
    if (Object.keys(DEFAULT_CATEGORY_BUDGETS).includes(mainCategory)) {
      return mainCategory;
    }
    
    return "Other";
  }

  /**
   * Start budget monitoring
   */
  private startBudgetMonitoring() {
    // Check budgets every hour
    this.checkInterval = setInterval(() => {
      this.checkAllUserBudgets();
    }, 60 * 60 * 1000);
    
    logger.info("Started budget monitoring", "BUDGET");
  }

  /**
   * Check all user budgets
   */
  private async checkAllUserBudgets() {
    const stmt = this.db.prepare(`
      SELECT DISTINCT user_id FROM user_budget_preferences
    `);
    
    const users = stmt.all() as any[];
    
    for (const user of users) {
      try {
        const summary = this.getBudgetSummary(user.user_id);
        
        // Emit events for budget status
        if (summary.percentage >= 100) {
          this.emit("budget:exceeded", { userId: user.user_id, summary });
        } else if (summary.percentage >= 80) {
          this.emit("budget:warning", { userId: user.user_id, summary });
        }
      } catch (error) {
        logger.error(`Failed to check budget for user ${user.user_id}: ${error}`, "BUDGET");
      }
    }
  }

  /**
   * Ensure required tables exist
   */
  private ensureTablesExist() {
    // Create user budget preferences table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_budget_preferences (
        user_id TEXT PRIMARY KEY,
        monthly_budget REAL DEFAULT 500,
        category_budgets TEXT DEFAULT '{}',
        alert_threshold REAL DEFAULT 80,
        rollover_enabled INTEGER DEFAULT 0,
        auto_adjust INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      
      CREATE INDEX IF NOT EXISTS idx_budget_user ON user_budget_preferences(user_id);
    `);
  }

  /**
   * Shutdown the service
   */
  shutdown() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    logger.info("Budget Tracking Service shutdown", "BUDGET");
  }
}

// Export singleton instance management
let budgetTrackingService: BudgetTrackingService | null = null;

export function initializeBudgetTrackingService(db: Database.Database): BudgetTrackingService {
  if (!budgetTrackingService) {
    budgetTrackingService = new BudgetTrackingService(db);
    budgetTrackingService.initialize();
  }
  return budgetTrackingService;
}

export function getBudgetTrackingService(): BudgetTrackingService | null {
  return budgetTrackingService;
}

export default BudgetTrackingService;