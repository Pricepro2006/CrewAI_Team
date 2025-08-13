import { v4 as uuidv4 } from "uuid";
import { logger } from "../../utils/logger.js";

/**
 * Mock EmailStorageService to temporarily restore API functionality
 * while database schema issues are resolved
 */
export class MockEmailStorageService {
  private mockEmails: any[] = [];
  private mockStats: any = {
    totalEmails: 150,
    criticalCount: 12,
    inProgressCount: 45,
    completedCount: 93,
  };

  constructor() {
    this.initializeMockData();
  }

  private initializeMockData() {
    // Generate sample email data for testing
    const workflows = ["Order Management", "Quote Processing", "Shipping and Logistics", "Vendor Pricing Updates", "Returns and RMA"];
    const statuses = ["red", "yellow", "green"];
    const priorities = ["critical", "high", "medium", "low"];
    const emailAliases = ["orders@tdsynnex.com", "quotes@tdsynnex.com", "support@tdsynnex.com"];

    for (let i = 0; i < 50; i++) {
      this.mockEmails.push({
        id: uuidv4(),
        messageId: `mock-message-${i}`,
        emailAlias: emailAliases[i % emailAliases.length],
        requestedBy: `user${i}@company.com`,
        subject: `Sample Email ${i + 1}`,
        summary: `This is a mock email summary for testing purposes. Email ${i + 1} contains important information.`,
        status: statuses[i % statuses.length],
        statusText: `Status message for email ${i + 1}`,
        workflowState: i % 3 === 0 ? "START_POINT" : i % 3 === 1 ? "IN_PROGRESS" : "COMPLETION",
        workflowType: workflows[i % workflows.length],
        priority: priorities[i % priorities.length],
        receivedDate: new Date(Date.now() - (i * 3600000)).toISOString(), // Spread over hours
        entities: [
          { type: "PO_NUMBER", value: `PO-${1000 + i}` },
          { type: "CUSTOMER", value: `Customer ${i + 1}` }
        ],
        analysis: {
          workflow_state: i % 3 === 0 ? "START_POINT" : i % 3 === 1 ? "IN_PROGRESS" : "COMPLETION",
          quick_priority: priorities[i % priorities.length],
          action_sla_status: i % 4 === 0 ? "overdue" : i % 4 === 1 ? "at-risk" : "on-track"
        }
      });
    }
  }

  // Core email operations
  async getEmail(id: string): Promise<any> {
    logger.info("Mock: Getting email by ID", "MOCK_EMAIL_STORAGE", { id });
    const email = this.mockEmails.find(e => e.id === id);
    if (!email) {
      throw new Error(`Email with ID ${id} not found`);
    }
    return email;
  }

  async getEmailWithAnalysis(id: string): Promise<any> {
    logger.info("Mock: Getting email with analysis", "MOCK_EMAIL_STORAGE", { id });
    const email = await this.getEmail(id);
    return {
      ...email,
      analysis: {
        ...email.analysis,
        confidence: 0.85,
        processingTime: 1200,
        lastAnalyzed: new Date().toISOString()
      }
    };
  }

  async createEmail(emailData: any): Promise<string> {
    logger.info("Mock: Creating email", "MOCK_EMAIL_STORAGE", { subject: emailData.subject });
    const newEmail = {
      id: uuidv4(),
      ...emailData,
      receivedDate: emailData.receivedDate || new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    this.mockEmails.unshift(newEmail);
    return newEmail.id;
  }

  async updateEmail(id: string, updateData: any): Promise<void> {
    logger.info("Mock: Updating email", "MOCK_EMAIL_STORAGE", { id });
    const index = this.mockEmails.findIndex(e => e.id === id);
    if (index === -1) {
      throw new Error(`Email with ID ${id} not found`);
    }
    this.mockEmails[index] = { ...this.mockEmails[index], ...updateData, lastUpdated: new Date().toISOString() };
  }

  async updateEmailStatus(id: string, status: string, statusText: string, changedBy?: string): Promise<void> {
    logger.info("Mock: Updating email status", "MOCK_EMAIL_STORAGE", { id, status });
    await this.updateEmail(id, { status, statusText, changedBy, lastStatusChange: new Date().toISOString() });
  }

  async updateWorkflowState(id: string, newState: string, changedBy?: string): Promise<void> {
    logger.info("Mock: Updating workflow state", "MOCK_EMAIL_STORAGE", { id, newState });
    await this.updateEmail(id, { workflowState: newState, changedBy, lastStateChange: new Date().toISOString() });
  }

  // Dashboard and analytics
  async getDashboardStats(): Promise<any> {
    logger.info("Mock: Getting dashboard stats", "MOCK_EMAIL_STORAGE");
    return {
      ...this.mockStats,
      lastUpdated: new Date().toISOString(),
      todaysCount: Math.floor(this.mockStats.totalEmails * 0.1),
      urgentCount: this.mockStats.criticalCount,
      pendingAssignmentCount: Math.floor(this.mockStats.inProgressCount * 0.3)
    };
  }

  async getWorkflowAnalytics(): Promise<any> {
    logger.info("Mock: Getting workflow analytics", "MOCK_EMAIL_STORAGE");
    return {
      totalEmails: this.mockStats.totalEmails,
      workflowDistribution: {
        "Order Management": 45,
        "Quote Processing": 32,
        "Shipping and Logistics": 28,
        "Vendor Pricing Updates": 25,
        "Returns and RMA": 20
      },
      slaCompliance: {
        "on-track": 80,
        "at-risk": 15,
        "overdue": 5
      },
      averageProcessingTime: 2.5 * 3600000, // 2.5 hours in milliseconds
      workflowCompletion: 8.2,
      avgResponseTime: 4.3,
      agentUtilization: 0.75,
      criticalAlerts: [
        "12 emails overdue for response",
        "High volume detected in Order Management queue"
      ]
    };
  }

  async getWorkflowPatterns(): Promise<any> {
    logger.info("Mock: Getting workflow patterns", "MOCK_EMAIL_STORAGE");
    return {
      patterns: [
        { type: "Order Management", frequency: 0.3, avgProcessingTime: 1800000 },
        { type: "Quote Processing", frequency: 0.25, avgProcessingTime: 3600000 },
        { type: "Shipping and Logistics", frequency: 0.2, avgProcessingTime: 1200000 }
      ]
    };
  }

  // Table view support
  async getEmailsForTableView(params: any): Promise<any> {
    logger.info("Mock: Getting emails for table view", "MOCK_EMAIL_STORAGE", { params });
    
    let filteredEmails = [...this.mockEmails];
    
    // Apply search filter
    if (params.search) {
      const searchLower = params.search.toLowerCase();
      filteredEmails = filteredEmails.filter(email => 
        email.subject.toLowerCase().includes(searchLower) ||
        email.summary.toLowerCase().includes(searchLower) ||
        email.requestedBy.toLowerCase().includes(searchLower)
      );
    }

    // Apply status filter
    if (params.filters?.status && params.filters.status.length > 0) {
      filteredEmails = filteredEmails.filter(email => 
        params.filters.status.includes(email.status)
      );
    }

    // Apply email alias filter
    if (params.filters?.emailAlias && params.filters.emailAlias.length > 0) {
      filteredEmails = filteredEmails.filter(email => 
        params.filters.emailAlias.includes(email.emailAlias)
      );
    }

    // Apply workflow state filter
    if (params.filters?.workflowState && params.filters.workflowState.length > 0) {
      filteredEmails = filteredEmails.filter(email => 
        params.filters.workflowState.includes(email.workflowState)
      );
    }

    // Apply priority filter
    if (params.filters?.priority && params.filters.priority.length > 0) {
      filteredEmails = filteredEmails.filter(email => 
        params.filters.priority.includes(email.priority)
      );
    }

    // Apply date range filter
    if (params.filters?.dateRange) {
      const startDate = new Date(params.filters.dateRange.start);
      const endDate = new Date(params.filters.dateRange.end);
      filteredEmails = filteredEmails.filter(email => {
        const emailDate = new Date(email.receivedDate);
        return emailDate >= startDate && emailDate <= endDate;
      });
    }

    // Apply sorting
    if (params.sortBy) {
      filteredEmails.sort((a, b) => {
        let aVal = a[params.sortBy];
        let bVal = b[params.sortBy];
        
        if (params.sortBy === 'received_date' || params.sortBy === 'receivedDate') {
          aVal = new Date(a.receivedDate);
          bVal = new Date(b.receivedDate);
        }
        
        if (params.sortOrder === 'desc') {
          return bVal > aVal ? 1 : -1;
        } else {
          return aVal > bVal ? 1 : -1;
        }
      });
    }

    // Apply pagination
    const totalCount = filteredEmails.length;
    const page = params.page || 1;
    const pageSize = params.pageSize || 50;
    const offset = (page - 1) * pageSize;
    const paginatedEmails = filteredEmails.slice(offset, offset + pageSize);

    return {
      emails: paginatedEmails,
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize)
    };
  }

  // Workflow specific methods
  async getEmailsByWorkflow(workflow: string, limit: number = 50, offset: number = 0): Promise<any[]> {
    logger.info("Mock: Getting emails by workflow", "MOCK_EMAIL_STORAGE", { workflow, limit, offset });
    const filtered = this.mockEmails.filter(email => email.workflowType === workflow);
    return filtered.slice(offset, offset + limit);
  }

  // Lifecycle methods
  startSLAMonitoring(): void {
    logger.info("Mock: Starting SLA monitoring", "MOCK_EMAIL_STORAGE");
    // Mock implementation - in real service this would start monitoring timers
  }

  stopSLAMonitoring(): void {
    logger.info("Mock: Stopping SLA monitoring", "MOCK_EMAIL_STORAGE");
  }

  // Health check
  async healthCheck(): Promise<{ status: string; details?: any }> {
    return {
      status: "healthy",
      details: {
        service: "MockEmailStorageService",
        emailCount: this.mockEmails.length,
        lastUpdate: new Date().toISOString()
      }
    };
  }
}

// Export singleton instance
export const mockEmailStorageService = new MockEmailStorageService();