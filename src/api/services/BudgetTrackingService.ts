/**
 * Budget Tracking Service
 * Manages budget tracking and spending analysis
 */

import { EventEmitter } from 'node:events';
import Database from 'better-sqlite3';
import { Logger } from "../../utils/logger.js";
const logger = Logger.getInstance();

export interface BudgetCategory {
  id: string;
  name: string;
  allocation: number;
  spent: number;
  remaining: number;
  percentage: number;
}

export interface BudgetSummary {
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  categories: BudgetCategory[];
  trends: {
    monthlySpending: number[];
    categorySpending: Record<string, number>;
  };
}

export class BudgetTrackingService extends EventEmitter {
  private static instance: BudgetTrackingService | null = null;
  private db: Database.Database | null = null;

  static getInstance(): BudgetTrackingService {
    if (!BudgetTrackingService.instance) {
      BudgetTrackingService.instance = new BudgetTrackingService();
    }
    return BudgetTrackingService.instance;
  }

  private constructor() {
    super();
  }

  /**
   * Initialize the service with a database connection
   */
  initialize(db: Database.Database): void {
    this.db = db;
    logger.info('BudgetTrackingService initialized with database');
  }

  /**
   * Shutdown the service and clean up resources
   */
  shutdown(): void {
    this.removeAllListeners();
    this.db = null;
    BudgetTrackingService.instance = null;
    logger.info('BudgetTrackingService shutdown complete');
  }

  async getBudgetSummary(userId?: string): Promise<BudgetSummary> {
    try {
      // Mock implementation - replace with actual database logic
      const summary = {
        totalBudget: 10000,
        totalSpent: 6500,
        totalRemaining: 3500,
        categories: [
          {
            id: '1',
            name: 'Groceries',
            allocation: 5000,
            spent: 3200,
            remaining: 1800,
            percentage: 64
          },
          {
            id: '2',
            name: 'Utilities',
            allocation: 3000,
            spent: 2100,
            remaining: 900,
            percentage: 70
          },
          {
            id: '3',
            name: 'Entertainment',
            allocation: 2000,
            spent: 1200,
            remaining: 800,
            percentage: 60
          }
        ],
        trends: {
          monthlySpending: [2000, 2200, 2300, 2100, 2400, 2200],
          categorySpending: {
            'Groceries': 3200,
            'Utilities': 2100,
            'Entertainment': 1200
          }
        }
      };

      // Check for budget exceeded
      if (summary.totalSpent > summary.totalBudget) {
        this.emit('budget:exceeded', {
          userId: userId || 'default',
          summary
        });
      }

      // Check for budget warning (80% threshold)
      const percentage = (summary.totalSpent / summary.totalBudget) * 100;
      if (percentage >= 80 && percentage < 100) {
        this.emit('budget:warning', {
          userId: userId || 'default',
          summary
        });
      }

      // Check threshold exceeded
      if (percentage >= 90) {
        this.emit('budget:threshold_exceeded', {
          userId: userId || 'default',
          percentage,
          threshold: 90
        });
      }

      return summary;
    } catch (error) {
      logger.error('Error getting budget summary:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async updateBudgetCategory(categoryId: string, allocation: number): Promise<BudgetCategory> {
    try {
      // Mock implementation
      return {
        id: categoryId,
        name: 'Updated Category',
        allocation,
        spent: 0,
        remaining: allocation,
        percentage: 0
      };
    } catch (error) {
      logger.error('Error updating budget category:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async addExpense(categoryId: string, amount: number, description: string): Promise<void> {
    try {
      logger.info(`Added expense: ${amount} to category ${categoryId} - ${description}`);
    } catch (error) {
      logger.error('Error adding expense:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Update budget preferences
   */
  updatePreferences(userId: string, preferences: any): void {
    this.emit('budget:preferences_updated', {
      userId,
      ...preferences
    });
  }
}

// Export singleton instance getter
export function getBudgetTrackingService(): BudgetTrackingService {
  return BudgetTrackingService.getInstance();
}

// Export initialization function
export function initializeBudgetTrackingService(db: Database.Database): BudgetTrackingService {
  const service = BudgetTrackingService.getInstance();
  service.initialize(db);
  return service;
}