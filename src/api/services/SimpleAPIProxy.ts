/**
 * Simple API Proxy Service
 * Proxies requests to the simple API server running on port 3210
 * This bypasses all TypeScript compilation issues with the main services
 */

import fetch from 'node-fetch';
import { logger } from '../../utils/logger.js';

const SIMPLE_API_URL = process.env.SIMPLE_API_URL || 'http://localhost:3210';

export class SimpleAPIProxy {
  private static instance: SimpleAPIProxy;
  
  private constructor() {}
  
  public static getInstance(): SimpleAPIProxy {
    if (!SimpleAPIProxy.instance) {
      SimpleAPIProxy.instance = new SimpleAPIProxy();
    }
    return SimpleAPIProxy.instance;
  }
  
  /**
   * Get analyzed emails from the simple API server
   */
  async getAnalyzedEmails(params: {
    page?: number;
    limit?: number;
  } = {}) {
    try {
      const { page = 1, limit = 50 } = params;
      const offset = (page - 1) * limit;
      
      const response = await fetch(`${SIMPLE_API_URL}/api/analyzed-emails?offset=${offset}&limit=${limit}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json() as any;
      
      // Transform to match expected format
      return {
        emails: data.emails || [],
        total: data.count || 0,
        page,
        pageSize: limit,
        todaysCount: 0, // TODO: Add to simple API
        urgentCount: 0, // TODO: Add to simple API
        pendingAssignmentCount: 0, // TODO: Add to simple API
      };
      
    } catch (error) {
      logger.error('Failed to fetch from simple API', 'SIMPLE_API_PROXY', { error });
      throw error;
    }
  }
  
  /**
   * Get email statistics from the simple API server
   */
  async getEmailStats() {
    try {
      const response = await fetch(`${SIMPLE_API_URL}/api/email-stats`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json() as any;
      
      // Transform to match expected format
      return {
        totalEmails: data.stats?.total_emails || 0,
        criticalCount: data.stats?.phase3_count || 0,
        inProgressCount: data.stats?.phase2_count || 0,
        completedCount: data.stats?.analyzed_count || 0,
        pendingCount: data.stats?.pending_count || 0,
        averageResponseTime: 0,
        workflowCompletionRate: data.stats?.avg_chain_score || 0,
        agents: [],
        workflows: {
          'Quote Processing': { total: 0, completed: 0 },
          'Order Management': { total: 0, completed: 0 },
          'Support Request': { total: 0, completed: 0 },
          'Licensing': { total: 0, completed: 0 },
          'Escalation': { total: 0, completed: 0 },
        },
        recentActivity: [],
      };
      
    } catch (error) {
      logger.error('Failed to fetch stats from simple API', 'SIMPLE_API_PROXY', { error });
      throw error;
    }
  }
  
  /**
   * Get analytics data from simple API
   */
  async getAnalytics() {
    try {
      // For now, return mock analytics data
      // TODO: Add analytics endpoint to simple API
      const stats = await this.getEmailStats();
      
      return {
        workflowCompletion: stats.workflowCompletionRate * 100,
        avgResponseTime: 4.3,
        criticalAlerts: [],
        agentUtilization: 75,
        statusCounts: {
          critical: stats.criticalCount,
          inProgress: stats.inProgressCount,
          completed: stats.completedCount,
        },
        workflowData: {
          completeChains: Math.floor(stats.totalEmails * 0.035),
          partialChains: Math.floor(stats.totalEmails * 0.4),
          brokenChains: Math.floor(stats.totalEmails * 0.565),
          totalChains: stats.totalEmails,
          workflowTypes: [
            {
              type: 'Quote Processing',
              count: Math.floor(stats.totalEmails * 0.4),
              completePercentage: 45,
              avgCompletionTime: 24,
            },
            {
              type: 'Order Management',
              count: Math.floor(stats.totalEmails * 0.35),
              completePercentage: 35,
              avgCompletionTime: 48,
            },
            {
              type: 'Support Request',
              count: Math.floor(stats.totalEmails * 0.25),
              completePercentage: 50,
              avgCompletionTime: 12,
            },
          ],
          bottlenecks: [],
          recommendations: [],
        },
      };
      
    } catch (error) {
      logger.error('Failed to get analytics from simple API', 'SIMPLE_API_PROXY', { error });
      throw error;
    }
  }
}

export const simpleAPIProxy = SimpleAPIProxy.getInstance();