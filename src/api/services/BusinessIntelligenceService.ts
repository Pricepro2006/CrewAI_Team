import { getDatabase, OptimizedQueryExecutor } from "../../database/index.js";
import Database from 'better-sqlite3';
import { logger } from '../../utils/logger.js';
import type { EmailRow, EmailWithAnalysis } from '../../types/unified-email.types.js';
import type { 
  DatabaseRow, 
  DatabaseStatement,
  EmailDatabaseRow
} from '../../shared/types/api.types.js';

export interface BusinessIntelligenceSummary {
  totalEmailsAnalyzed: number;
  totalBusinessValue: number;
  uniquePOCount: number;
  uniqueQuoteCount: number;
  uniqueCustomerCount: number;
  highPriorityRate: number;
  avgConfidenceScore: number;
  processingTimeRange: {
    start: string;
    end: string;
  };
}

export interface WorkflowDistribution {
  type: string;
  count: number;
  percentage: number;
  avgValue: number;
  totalValue: number;
}

export interface PriorityDistribution {
  level: 'Critical' | 'High' | 'Medium' | 'Low' | 'Unknown';
  count: number;
  percentage: number;
}

export interface CustomerInsight {
  name: string;
  emailCount: number;
  totalValue: number;
  avgResponseTime: number;
  workflowTypes: string[];
  lastInteraction: string;
}

export interface HighValueItem {
  type: string;
  value: number;
  customer: string;
  date: string;
  emailId: string;
}

export interface EntityExtracts {
  poNumbers: string[];
  quoteNumbers: string[];
  recentHighValueItems: HighValueItem[];
}

export interface ProcessingMetrics {
  avgConfidence: number;
  avgProcessingTime: number;
  successRate: number;
  totalProcessed: number;
  timeRange: {
    start: string;
    end: string;
  };
}

export interface BusinessIntelligenceData {
  summary: BusinessIntelligenceSummary;
  workflowDistribution: WorkflowDistribution[];
  priorityDistribution: PriorityDistribution[];
  topCustomers: CustomerInsight[];
  entityExtracts: EntityExtracts;
  processingMetrics: ProcessingMetrics;
  generatedAt: string;
}

// Query Options for BI data retrieval
export interface BusinessIntelligenceOptions {
  timeRange?: {
    start: Date;
    end: Date;
  };
  customerFilter?: string[];
  workflowFilter?: string[];
  useCache?: boolean;
  limit?: number;
}

// Cache entry structure
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Database query result rows
interface SummaryRow extends DatabaseRow {
  totalEmails: number;
  emailsWithPO: number;
  emailsWithQuotes: number;
  avgConfidence: number;
  firstProcessed: string;
  lastProcessed: string;
}

interface MetricsRow extends DatabaseRow {
  totalProcessed: number;
  avgConfidence: number;
  avgProcessingTime: number;
  successCount: number;
  firstProcessed: string;
  lastProcessed: string;
}

interface WorkflowRow extends DatabaseRow {
  workflow_state: string;
  count: number;
}

interface EmailEnhancedRow extends EmailDatabaseRow {
  extracted_entities: string;
  workflow_state: string;
  phase2_result: string;
  analyzed_at: string;
}

// Parsed JSON structures from database
interface ParsedEntities {
  po_numbers?: string[];
  quote_numbers?: string[];
  customers?: CustomerData[] | CustomerInfo | undefined;
}

interface CustomerData {
  name?: string;
  [key: string]: unknown;
}

interface CustomerInfo {
  name?: string;
  [key: string]: unknown;
}

interface ParsedWorkflow {
  type?: string;
  priority?: string;
  business_intelligence?: {
    estimated_value?: number;
  };
  [key: string]: unknown;
}

interface ParsedPhase2Result {
  confidence?: number;
  processing_time?: number;
  business_intelligence?: {
    estimated_value?: number;
  };
  [key: string]: unknown;
}

interface CustomerMapData {
  emailCount: number;
  totalValue: number;
  workflowTypes: Set<string>;
  processingTimes: number[];
  lastInteraction: string;
}

export class BusinessIntelligenceService {
  private db: OptimizedQueryExecutor | Database.Database;
  private cache: Map<string, CacheEntry<BusinessIntelligenceData>> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(dbPath: string = './data/crewai_enhanced.db') {
    this.db = getDatabase(dbPath) as OptimizedQueryExecutor | Database.Database;
    logger.info('BusinessIntelligenceService initialized with OptimizedQueryExecutor', 'BI_SERVICE');
  }

  /**
   * Get comprehensive business intelligence data
   */
  async getBusinessIntelligence(
    options: BusinessIntelligenceOptions = {}
  ): Promise<BusinessIntelligenceData> {
    const cacheKey = JSON.stringify(options);
    
    // Check cache
    if (options.useCache !== false) {
      const cached = this.getCached(cacheKey);
      if (cached) return cached;
    }

    try {
      const [
        summary,
        workflowDistribution,
        priorityDistribution,
        topCustomers,
        entityExtracts,
        processingMetrics,
      ] = await Promise.all([
        this.getBusinessSummary(options),
        this.getWorkflowDistribution(options),
        this.getPriorityDistribution(options),
        this.getTopCustomers(options),
        this.getEntityExtracts(options),
        this.getProcessingMetrics(options),
      ]);

      const biData: BusinessIntelligenceData = {
        summary,
        workflowDistribution,
        priorityDistribution,
        topCustomers,
        entityExtracts,
        processingMetrics,
        generatedAt: new Date().toISOString(),
      };

      // Cache the result
      this.setCache(cacheKey, biData);

      return biData;
    } catch (error) {
      logger.error('Failed to generate business intelligence', 'BI_SERVICE', { error });
      throw error;
    }
  }

  /**
   * Get business intelligence summary
   */
  private async getBusinessSummary(options: BusinessIntelligenceOptions): Promise<BusinessIntelligenceSummary> {
    let query = `
      SELECT 
        COUNT(DISTINCT id) as totalEmails,
        COUNT(DISTINCT CASE WHEN extracted_entities LIKE '%po_numbers%' THEN id END) as emailsWithPO,
        COUNT(DISTINCT CASE WHEN extracted_entities LIKE '%quote_numbers%' THEN id END) as emailsWithQuotes,
        AVG(CASE 
          WHEN phase2_result LIKE '%confidence%' 
          THEN json_extract(phase2_result, '$.confidence')
          ELSE NULL 
        END) as avgConfidence,
        MIN(analyzed_at) as firstProcessed,
        MAX(analyzed_at) as lastProcessed
      FROM emails_enhanced
      WHERE phase2_result LIKE '%llama_3_2%'
    `;

    const params: (string | number | boolean | null)[] = [];

    if (options.timeRange) {
      query += ' AND analyzed_at BETWEEN ? AND ?';
      params.push(options?.timeRange?.start.toISOString(), options?.timeRange?.end.toISOString());
    }

    const stmt = (this.db as Database.Database).prepare(query);
    if (!stmt) {
      throw new Error('Failed to prepare summary query');
    }
    const summaryRow = stmt.get(...params) as SummaryRow;

    // Get unique entities
    const entitiesQuery = `
      SELECT 
        extracted_entities,
        workflow_state,
        phase2_result
      FROM emails_enhanced
      WHERE phase2_result LIKE '%llama_3_2%'
      ${options.timeRange ? 'AND analyzed_at BETWEEN ? AND ?' : ''}
    `;

    const entitiesStmt = (this.db as Database.Database).prepare(entitiesQuery);
    if (!entitiesStmt) {
      throw new Error('Failed to prepare entities query');
    }
    const emails = entitiesStmt.all(...params) as EmailEnhancedRow[];

    const uniquePOs = new Set<string>();
    const uniqueQuotes = new Set<string>();
    const uniqueCustomers = new Set<string>();
    let totalValue = 0;
    let highPriorityCount = 0;

    for (const email of emails) {
      try {
        // Extract entities
        const entities = JSON.parse(email.extracted_entities || '{}');
        
        // PO numbers
        if (entities.po_numbers?.length) {
          entities.po_numbers.forEach((po: string) => {
            if (po && po !== 'None') uniquePOs.add(po);
          });
        }

        // Quote numbers
        if (entities.quote_numbers?.length) {
          entities.quote_numbers.forEach((quote: string) => {
            if (quote && quote !== 'None') uniqueQuotes.add(quote);
          });
        }

        // Customers
        if (entities.customers) {
          if (Array.isArray(entities.customers)) {
            entities.customers.forEach((customer: CustomerData) => {
              const name = typeof customer === 'string' ? customer : customer?.name;
              if (name) uniqueCustomers.add(name);
            });
          } else if (entities.customers?.name) {
            uniqueCustomers.add(entities.customers.name);
          }
        }

        // Extract business value from workflow state
        const workflow = JSON.parse(email.workflow_state || '{}');
        if (workflow.priority === 'High' || workflow.priority === 'Critical') {
          highPriorityCount++;
        }

        // Try to extract value from phase2_result
        const phase2 = JSON.parse(email.phase2_result || '{}');
        if (phase2.business_intelligence?.estimated_value) {
          totalValue += phase2?.business_intelligence?.estimated_value;
        }

      } catch (e) {
        // Skip invalid JSON
      }
    }

    return {
      totalEmailsAnalyzed: summaryRow.totalEmails || 0,
      totalBusinessValue: totalValue,
      uniquePOCount: uniquePOs.size,
      uniqueQuoteCount: uniqueQuotes.size,
      uniqueCustomerCount: uniqueCustomers.size,
      highPriorityRate: emails?.length || 0 > 0 ? (highPriorityCount / emails?.length || 0) * 100 : 0,
      avgConfidenceScore: summaryRow.avgConfidence || 0,
      processingTimeRange: {
        start: summaryRow.firstProcessed || new Date().toISOString(),
        end: summaryRow.lastProcessed || new Date().toISOString(),
      },
    };
  }

  /**
   * Get workflow distribution analysis
   */
  private async getWorkflowDistribution(options: BusinessIntelligenceOptions): Promise<WorkflowDistribution[]> {
    let query = `
      SELECT 
        workflow_state,
        COUNT(*) as count
      FROM emails_enhanced
      WHERE phase2_result LIKE '%llama_3_2%'
    `;

    const params: (string | number | boolean | null)[] = [];

    if (options.timeRange) {
      query += ' AND analyzed_at BETWEEN ? AND ?';
      params.push(options?.timeRange?.start.toISOString(), options?.timeRange?.end.toISOString());
    }

    query += ' GROUP BY workflow_state';

    const stmt = (this.db as Database.Database).prepare(query);
    if (!stmt) {
      return [];
    }
    const rows = stmt.all(...params) as WorkflowRow[];
    
    const workflowMap = new Map<string, { count: number; totalValue: number }>();
    let totalCount = 0;

    for (const row of rows) {
      try {
        const workflow = JSON.parse(row.workflow_state || '{}');
        const type = workflow.type || 'Unknown';
        
        if (!workflowMap.has(type)) {
          workflowMap.set(type, { count: 0, totalValue: 0 });
        }
        
        const data = workflowMap.get(type)!;
        data.count += row.count;
        totalCount += row.count;
        
        // Extract value if available
        if (workflow.business_intelligence?.estimated_value) {
          data.totalValue += workflow?.business_intelligence?.estimated_value * row.count;
        }
      } catch (e) {
        // Handle invalid JSON
        const type = 'Unknown';
        if (!workflowMap.has(type)) {
          workflowMap.set(type, { count: 0, totalValue: 0 });
        }
        workflowMap.get(type)!.count += row.count;
        totalCount += row.count;
      }
    }

    return Array.from(workflowMap.entries())
      .map(([type, data]) => ({
        type,
        count: data.count,
        percentage: totalCount > 0 ? (data.count / totalCount) * 100 : 0,
        avgValue: data.count > 0 ? data.totalValue / data.count : 0,
        totalValue: data.totalValue,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get priority distribution
   */
  private async getPriorityDistribution(options: BusinessIntelligenceOptions): Promise<PriorityDistribution[]> {
    let query = `
      SELECT 
        workflow_state,
        COUNT(*) as count
      FROM emails_enhanced
      WHERE phase2_result LIKE '%llama_3_2%'
    `;

    const params: (string | number | boolean | null)[] = [];

    if (options.timeRange) {
      query += ' AND analyzed_at BETWEEN ? AND ?';
      params.push(options?.timeRange?.start.toISOString(), options?.timeRange?.end.toISOString());
    }

    const stmt = (this.db as Database.Database).prepare(query);
    if (!stmt) {
      return [];
    }
    const rows = stmt.all(...params) as WorkflowRow[];
    
    const priorityMap = new Map<string, number>([
      ['Critical', 0],
      ['High', 0],
      ['Medium', 0],
      ['Low', 0],
      ['Unknown', 0],
    ]);
    
    let totalCount = 0;

    for (const row of rows) {
      try {
        const workflow = JSON.parse(row.workflow_state || '{}');
        const priority = workflow.priority || 'Unknown';
        
        if (priorityMap.has(priority)) {
          priorityMap.set(priority, priorityMap.get(priority)! + 1);
        } else {
          priorityMap.set('Unknown', priorityMap.get('Unknown')! + 1);
        }
        totalCount++;
      } catch (e) {
        priorityMap.set('Unknown', priorityMap.get('Unknown')! + 1);
        totalCount++;
      }
    }

    const priorityOrder = ['Critical', 'High', 'Medium', 'Low', 'Unknown'];
    return priorityOrder?.map(level => ({
      level: level as PriorityDistribution['level'],
      count: priorityMap.get(level) || 0,
      percentage: totalCount > 0 ? ((priorityMap.get(level) || 0) / totalCount) * 100 : 0,
    }));
  }

  /**
   * Get top customers by email volume and value
   */
  private async getTopCustomers(options: BusinessIntelligenceOptions): Promise<CustomerInsight[]> {
    let query = `
      SELECT 
        id,
        sender_email,
        extracted_entities,
        workflow_state,
        phase2_result,
        analyzed_at
      FROM emails_enhanced
      WHERE phase2_result LIKE '%llama_3_2%'
    `;

    const params: (string | number | boolean | null)[] = [];

    if (options.timeRange) {
      query += ' AND analyzed_at BETWEEN ? AND ?';
      params.push(options?.timeRange?.start.toISOString(), options?.timeRange?.end.toISOString());
    }

    const stmt = (this.db as Database.Database).prepare(query);
    if (!stmt) {
      return [];
    }
    const emails = stmt.all(...params) as EmailEnhancedRow[];
    
    const customerMap = new Map<string, {
      emailCount: number;
      totalValue: number;
      workflowTypes: Set<string>;
      processingTimes: number[];
      lastInteraction: string;
    }>();

    for (const email of emails) {
      try {
        const entities = JSON.parse(email.extracted_entities || '{}');
        const workflow = JSON.parse(email.workflow_state || '{}');
        const phase2 = JSON.parse(email.phase2_result || '{}');
        
        // Extract customer names
        const customers: string[] = [];
        if (entities.customers) {
          if (Array.isArray(entities.customers)) {
            entities?.customers?.forEach((c: CustomerData) => {
              const name = typeof c === 'string' ? c : c?.name;
              if (name) customers.push(name);
            });
          } else if (entities.customers?.name) {
            customers.push(entities.customers.name);
          }
        }

        // Process each customer
        for (const customer of customers) {
          if (!customerMap.has(customer)) {
            customerMap.set(customer, {
              emailCount: 0,
              totalValue: 0,
              workflowTypes: new Set(),
              processingTimes: [],
              lastInteraction: email.analyzed_at,
            });
          }
          
          const data = customerMap.get(customer)!;
          data.emailCount++;
          
          if (workflow.type) {
            data?.workflowTypes?.add(workflow.type);
          }
          
          if (phase2.business_intelligence?.estimated_value) {
            data.totalValue += phase2?.business_intelligence?.estimated_value;
          }
          
          if (phase2.processing_time) {
            data?.processingTimes?.push(phase2.processing_time);
          }
          
          if (email.analyzed_at > data.lastInteraction) {
            data.lastInteraction = email.analyzed_at;
          }
        }
      } catch (e) {
        // Skip invalid data
      }
    }

    // Convert to array and sort by email count
    return Array.from(customerMap.entries())
      .map(([name, data]) => ({
        name,
        emailCount: data.emailCount,
        totalValue: data.totalValue,
        avgResponseTime: data?.processingTimes?.length > 0
          ? data?.processingTimes?.reduce((a: number, b: number) => a + b, 0) / data?.processingTimes?.length
          : 0,
        workflowTypes: Array.from(data.workflowTypes),
        lastInteraction: data.lastInteraction,
      }))
      .sort((a, b) => b.emailCount - a.emailCount)
      .slice(0, options.limit || 20);
  }

  /**
   * Get extracted entities summary
   */
  private async getEntityExtracts(options: BusinessIntelligenceOptions): Promise<EntityExtracts> {
    let query = `
      SELECT 
        id,
        subject,
        extracted_entities,
        workflow_state,
        phase2_result,
        analyzed_at
      FROM emails_enhanced
      WHERE phase2_result LIKE '%llama_3_2%'
    `;

    const params: (string | number | boolean | null)[] = [];

    if (options.timeRange) {
      query += ' AND analyzed_at BETWEEN ? AND ?';
      params.push(options?.timeRange?.start.toISOString(), options?.timeRange?.end.toISOString());
    }

    query += ' ORDER BY analyzed_at DESC LIMIT 500';

    const stmt = (this.db as Database.Database).prepare(query);
    if (!stmt) {
      return {
        poNumbers: [],
        quoteNumbers: [],
        recentHighValueItems: []
      };
    }
    const emails = stmt.all(...params) as EmailEnhancedRow[];
    
    const poNumbers = new Set<string>();
    const quoteNumbers = new Set<string>();
    const highValueItems: HighValueItem[] = [];

    for (const email of emails) {
      try {
        const entities = JSON.parse(email.extracted_entities || '{}');
        const workflow = JSON.parse(email.workflow_state || '{}');
        const phase2 = JSON.parse(email.phase2_result || '{}');
        
        // Extract PO numbers
        if (entities.po_numbers?.length) {
          entities.po_numbers.forEach((po: string) => {
            if (po && po !== 'None' && po?.length || 0 > 3) {
              poNumbers.add(po);
            }
          });
        }

        // Extract quote numbers
        if (entities.quote_numbers?.length) {
          entities.quote_numbers.forEach((quote: string) => {
            if (quote && quote !== 'None' && quote?.length || 0 > 3) {
              quoteNumbers.add(quote);
            }
          });
        }

        // Extract high value items
        if (phase2.business_intelligence?.estimated_value > 100000) {
          const customer = Array.isArray(entities.customers) 
            ? entities.customers[0] 
            : entities.customers?.name || 'Unknown';
            
          highValueItems.push({
            type: workflow.type || 'Unknown',
            value: phase2?.business_intelligence?.estimated_value,
            customer: typeof customer === 'string' ? customer : (customer as CustomerData)?.name || 'Unknown',
            date: email.analyzed_at,
            emailId: email.id,
          });
        }
      } catch (e) {
        // Skip invalid data
      }
    }

    return {
      poNumbers: Array.from(poNumbers).slice(0, 100),
      quoteNumbers: Array.from(quoteNumbers).slice(0, 100),
      recentHighValueItems: highValueItems
        .sort((a, b) => b.value - a.value)
        .slice(0, 20),
    };
  }

  /**
   * Get processing metrics
   */
  private async getProcessingMetrics(options: BusinessIntelligenceOptions): Promise<ProcessingMetrics> {
    let query = `
      SELECT 
        COUNT(*) as totalProcessed,
        AVG(CASE 
          WHEN phase2_result LIKE '%confidence%' 
          THEN json_extract(phase2_result, '$.confidence')
          ELSE NULL 
        END) as avgConfidence,
        AVG(CASE 
          WHEN phase2_result LIKE '%processing_time%' 
          THEN json_extract(phase2_result, '$.processing_time')
          ELSE NULL 
        END) as avgProcessingTime,
        COUNT(CASE WHEN phase2_result LIKE '%success%' THEN 1 END) as successCount,
        MIN(analyzed_at) as firstProcessed,
        MAX(analyzed_at) as lastProcessed
      FROM emails_enhanced
      WHERE phase2_result LIKE '%llama_3_2%'
    `;

    const params: (string | number | boolean | null)[] = [];

    if (options.timeRange) {
      query += ' AND analyzed_at BETWEEN ? AND ?';
      params.push(options?.timeRange?.start.toISOString(), options?.timeRange?.end.toISOString());
    }

    const stmt = (this.db as Database.Database).prepare(query);
    if (!stmt) {
      return {
        avgConfidence: 0,
        avgProcessingTime: 0,
        successRate: 0,
        totalProcessed: 0,
        timeRange: {
          start: options.timeRange?.start?.toISOString() || new Date().toISOString(),
          end: options.timeRange?.end?.toISOString() || new Date().toISOString(),
        },
      };
    }
    const metrics = stmt.get(...params) as MetricsRow;

    return {
      avgConfidence: metrics.avgConfidence || 0,
      avgProcessingTime: metrics.avgProcessingTime || 0,
      successRate: metrics.totalProcessed > 0 
        ? (metrics.successCount / metrics.totalProcessed) * 100 
        : 0,
      totalProcessed: metrics.totalProcessed || 0,
      timeRange: {
        start: metrics.firstProcessed || new Date().toISOString(),
        end: metrics.lastProcessed || new Date().toISOString(),
      },
    };
  }

  /**
   * Get cached data if not expired
   */
  private getCached(key: string): BusinessIntelligenceData | null {
    const cached = this?.cache?.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      logger.debug('Returning cached BI data', 'BI_SERVICE', { key });
      return cached.data;
    }
    return null;
  }

  /**
   * Set cache data
   */
  private setCache(key: string, data: BusinessIntelligenceData): void {
    this.cache.set(key, { data, timestamp: Date.now() });
    
    // Clean old cache entries
    if (this.cache.size > 100) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      if (entries.length > 0 && entries[0]) {
        const oldestKey = entries[0][0];
        this.cache.delete(oldestKey);
      }
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('BI cache cleared', 'BI_SERVICE');
  }

  /**
   * Close database connection
   */
  close(): void {
    this?.db?.close();
    logger.info('BusinessIntelligenceService closed', 'BI_SERVICE');
  }
}

// Singleton instance
let biServiceInstance: BusinessIntelligenceService | null = null;

export function getBusinessIntelligenceService(): BusinessIntelligenceService {
  if (!biServiceInstance) {
    biServiceInstance = new BusinessIntelligenceService();
  }
  return biServiceInstance;
}