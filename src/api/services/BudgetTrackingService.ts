/**
 * Budget Tracking Service
 * Manages budget tracking and spending analysis
 */

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

export class BudgetTrackingService {
  private static instance: BudgetTrackingService;

  static getInstance(): BudgetTrackingService {
    if (!BudgetTrackingService.instance) {
      BudgetTrackingService.instance = new BudgetTrackingService();
    }
    return BudgetTrackingService.instance;
  }

  async getBudgetSummary(): Promise<BudgetSummary> {
    try {
      // Mock implementation - replace with actual database logic
      return {
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
}

// Export convenience function for singleton access
export function getBudgetTrackingService(): BudgetTrackingService {
  return BudgetTrackingService.getInstance();
}