import { BaseRepository } from './BaseRepository.js';
import { IEmailChainRepository } from './interfaces/IEmailChainRepository.js';
import { EmailChain, ChainType, ChainCompleteness } from '../../types/ChainTypes.js';
import { executeQuery, executeTransaction } from '../ConnectionPool.js';
import { logger } from '../../utils/logger.js';

/**
 * Email chain repository implementation
 */
export class EmailChainRepositoryImpl extends BaseRepository<EmailChain> implements IEmailChainRepository {
  constructor() {
    super(null as any, 'email_chains');
    this.tableName = 'email_chains';
    this.primaryKey = 'id';
  }

  /**
   * Map database row to EmailChain entity
   */
  protected mapRowToEntity(row: any): EmailChain {
    return {
      id: row.id,
      chain_id: row.chain_id,
      conversation_id: row.conversation_id,
      email_ids: row.email_ids ? JSON.parse(row.email_ids) : [],
      email_count: row.email_count,
      chain_type: row.chain_type as ChainType,
      completeness_score: row.completeness_score,
      is_complete: Boolean(row.is_complete),
      missing_stages: row.missing_stages ? JSON.parse(row.missing_stages) : [],
      start_time: new Date(row.start_time),
      end_time: new Date(row.end_time),
      duration_hours: row.duration_hours,
      participants: row.participants ? JSON.parse(row.participants) : [],
      key_entities: row.key_entities ? JSON.parse(row.key_entities) : [],
      workflow_state: row.workflow_state,
      created_at: new Date(row.created_at),
      updated_at: row.updated_at ? new Date(row.updated_at) : undefined,
      last_analyzed: row.last_analyzed ? new Date(row.last_analyzed) : undefined
    };
  }

  /**
   * Map EmailChain entity to database row
   */
  protected mapEntityToRow(entity: Partial<EmailChain>): any {
    const row: any = {};
    
    if (entity.chain_id !== undefined) row.chain_id = entity.chain_id;
    if (entity.conversation_id !== undefined) row.conversation_id = entity.conversation_id;
    if (entity.email_ids !== undefined) row.email_ids = JSON.stringify(entity.email_ids);
    if (entity.email_count !== undefined) row.email_count = entity.email_count;
    if (entity.chain_type !== undefined) row.chain_type = entity.chain_type;
    if (entity.completeness_score !== undefined) row.completeness_score = entity.completeness_score;
    if (entity.is_complete !== undefined) row.is_complete = entity.is_complete ? 1 : 0;
    if (entity.missing_stages !== undefined) row.missing_stages = JSON.stringify(entity.missing_stages);
    if (entity.start_time !== undefined) row.start_time = entity.start_time.toISOString();
    if (entity.end_time !== undefined) row.end_time = entity.end_time.toISOString();
    if (entity.duration_hours !== undefined) row.duration_hours = entity.duration_hours;
    if (entity.participants !== undefined) row.participants = JSON.stringify(entity.participants);
    if (entity.key_entities !== undefined) row.key_entities = JSON.stringify(entity.key_entities);
    if (entity.workflow_state !== undefined) row.workflow_state = entity.workflow_state;
    if (entity.last_analyzed !== undefined) row.last_analyzed = entity.last_analyzed?.toISOString();
    
    return row;
  }

  /**
   * Find complete chains
   */
  async findCompleteChains(limit?: number): Promise<EmailChain[]> {
    return executeQuery((db) => {
      let query = `
        SELECT * FROM ${this.tableName}
        WHERE is_complete = 1
        ORDER BY completeness_score DESC, email_count DESC
      `;
      const params: any[] = [];
      
      if (limit !== undefined) {
        query += ' LIMIT ?';
        params.push(limit);
      }
      
      const stmt = db.prepare(query);
      const rows = stmt.all(...params);
      return rows.map(row => this.mapRowToEntity(row));
    });
  }

  /**
   * Find incomplete chains
   */
  async findIncompleteChains(limit?: number): Promise<EmailChain[]> {
    return executeQuery((db) => {
      let query = `
        SELECT * FROM ${this.tableName}
        WHERE is_complete = 0
        ORDER BY completeness_score DESC, end_time DESC
      `;
      const params: any[] = [];
      
      if (limit !== undefined) {
        query += ' LIMIT ?';
        params.push(limit);
      }
      
      const stmt = db.prepare(query);
      const rows = stmt.all(...params);
      return rows.map(row => this.mapRowToEntity(row));
    });
  }

  /**
   * Find chains by type
   */
  async findByType(type: ChainType): Promise<EmailChain[]> {
    return executeQuery((db) => {
      const stmt = db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE chain_type = ?
        ORDER BY created_at DESC
      `);
      const rows = stmt.all(type);
      return rows.map(row => this.mapRowToEntity(row));
    });
  }

  /**
   * Find chains by completeness score range
   */
  async findByCompletenessRange(minScore: number, maxScore: number): Promise<EmailChain[]> {
    return executeQuery((db) => {
      const stmt = db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE completeness_score BETWEEN ? AND ?
        ORDER BY completeness_score DESC
      `);
      const rows = stmt.all(minScore, maxScore);
      return rows.map(row => this.mapRowToEntity(row));
    });
  }

  /**
   * Update chain completeness
   */
  async updateCompleteness(chainId: string, completeness: ChainCompleteness): Promise<void> {
    await executeQuery((db) => {
      const stmt = db.prepare(`
        UPDATE ${this.tableName}
        SET completeness_score = ?,
            is_complete = ?,
            missing_stages = ?,
            updated_at = datetime('now')
        WHERE chain_id = ?
      `);
      stmt.run(
        completeness.score,
        completeness.is_complete ? 1 : 0,
        JSON.stringify(completeness.missing_stages),
        chainId
      );
    });
  }

  /**
   * Add email to chain
   */
  async addEmailToChain(chainId: string, emailId: string): Promise<void> {
    await executeTransaction((db) => {
      // Get current chain
      const getStmt = db.prepare(`SELECT * FROM ${this.tableName} WHERE chain_id = ?`);
      const chain = getStmt.get(chainId);
      
      if (!chain) {
        throw new Error(`Chain not found: ${chainId}`);
      }
      
      // Update email_ids and count
      const emailIds = chain.email_ids ? JSON.parse(chain.email_ids) : [];
      if (!emailIds.includes(emailId)) {
        emailIds.push(emailId);
        
        const updateStmt = db.prepare(`
          UPDATE ${this.tableName}
          SET email_ids = ?,
              email_count = ?,
              updated_at = datetime('now')
          WHERE chain_id = ?
        `);
        updateStmt.run(
          JSON.stringify(emailIds),
          emailIds.length,
          chainId
        );
      }
    });
  }

  /**
   * Remove email from chain
   */
  async removeEmailFromChain(chainId: string, emailId: string): Promise<void> {
    await executeTransaction((db) => {
      // Get current chain
      const getStmt = db.prepare(`SELECT * FROM ${this.tableName} WHERE chain_id = ?`);
      const chain = getStmt.get(chainId);
      
      if (!chain) {
        throw new Error(`Chain not found: ${chainId}`);
      }
      
      // Update email_ids and count
      const emailIds: string[] = chain.email_ids ? JSON.parse(chain.email_ids) : [];
      const filteredIds = emailIds.filter(id => id !== emailId);
      
      if (filteredIds.length !== emailIds.length) {
        const updateStmt = db.prepare(`
          UPDATE ${this.tableName}
          SET email_ids = ?,
              email_count = ?,
              updated_at = datetime('now')
          WHERE chain_id = ?
        `);
        updateStmt.run(
          JSON.stringify(filteredIds),
          filteredIds.length,
          chainId
        );
      }
    });
  }

  /**
   * Get chain statistics
   */
  async getChainStatistics(): Promise<{
    total: number;
    complete: number;
    incomplete: number;
    byType: Record<ChainType, number>;
    avgCompleteness: number;
    avgEmailCount: number;
  }> {
    return executeQuery((db) => {
      // Basic counts
      const statsStmt = db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN is_complete = 1 THEN 1 ELSE 0 END) as complete,
          SUM(CASE WHEN is_complete = 0 THEN 1 ELSE 0 END) as incomplete,
          AVG(completeness_score) as avg_completeness,
          AVG(email_count) as avg_email_count
        FROM ${this.tableName}
      `);
      const stats = statsStmt.get() as any;
      
      // By type counts
      const typeStmt = db.prepare(`
        SELECT chain_type, COUNT(*) as count
        FROM ${this.tableName}
        GROUP BY chain_type
      `);
      const typeCounts = typeStmt.all() as any[];
      
      const byType: Record<ChainType, number> = {
        [ChainType.QUOTE_REQUEST]: 0,
        [ChainType.ORDER_PROCESSING]: 0,
        [ChainType.SUPPORT_TICKET]: 0,
        [ChainType.PROJECT_DISCUSSION]: 0,
        [ChainType.GENERAL_INQUIRY]: 0,
        [ChainType.UNKNOWN]: 0
      };
      
      typeCounts.forEach(t => {
        if (t.chain_type in byType) {
          byType[t.chain_type as ChainType] = t.count;
        }
      });
      
      return {
        total: stats.total || 0,
        complete: stats.complete || 0,
        incomplete: stats.incomplete || 0,
        byType,
        avgCompleteness: stats.avg_completeness || 0,
        avgEmailCount: stats.avg_email_count || 0
      };
    });
  }

  /**
   * Find chains with minimum email count
   */
  async findByMinEmailCount(minCount: number): Promise<EmailChain[]> {
    return executeQuery((db) => {
      const stmt = db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE email_count >= ?
        ORDER BY email_count DESC, created_at DESC
      `);
      const rows = stmt.all(minCount);
      return rows.map(row => this.mapRowToEntity(row));
    });
  }

  /**
   * Find chains by duration range
   */
  async findByDurationRange(minHours: number, maxHours: number): Promise<EmailChain[]> {
    return executeQuery((db) => {
      const stmt = db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE duration_hours BETWEEN ? AND ?
        ORDER BY duration_hours DESC
      `);
      const rows = stmt.all(minHours, maxHours);
      return rows.map(row => this.mapRowToEntity(row));
    });
  }

  /**
   * Create or update chain
   */
  async upsert(chain: EmailChain): Promise<EmailChain> {
    return executeTransaction((db) => {
      // Check if chain exists
      const existsStmt = db.prepare(`
        SELECT 1 FROM ${this.tableName} WHERE chain_id = ?
      `);
      const exists = existsStmt.get(chain.chain_id);
      
      if (exists) {
        // Update existing
        const row = this.mapEntityToRow(chain);
        const columns = Object.keys(row).filter(col => col !== 'id' && col !== 'chain_id' && col !== 'created_at');
        const values = columns.map(col => row[col]);
        values.push(chain.chain_id);
        
        const setClause = columns.map(col => `${col} = ?`).join(', ');
        const updateStmt = db.prepare(`
          UPDATE ${this.tableName}
          SET ${setClause}, updated_at = datetime('now')
          WHERE chain_id = ?
        `);
        updateStmt.run(...values);
        
        logger.info('Chain updated', 'CHAIN_REPOSITORY', { chainId: chain.chain_id });
      } else {
        // Insert new
        const id = chain.id || this.generateId();
        const row = this.mapEntityToRow(chain);
        const columns = ['id', 'chain_id', ...Object.keys(row).filter(col => col !== 'id' && col !== 'chain_id')];
        const values = [id, chain.chain_id, ...columns.slice(2).map(col => row[col])];
        const placeholders = columns.map(() => '?').join(', ');
        
        const insertStmt = db.prepare(`
          INSERT INTO ${this.tableName} (${columns.join(', ')}, created_at)
          VALUES (${placeholders}, datetime('now'))
        `);
        insertStmt.run(...values);
        
        logger.info('Chain created', 'CHAIN_REPOSITORY', { chainId: chain.chain_id });
      }
      
      // Return the updated/created chain
      const getStmt = db.prepare(`SELECT * FROM ${this.tableName} WHERE chain_id = ?`);
      const result = getStmt.get(chain.chain_id);
      return this.mapRowToEntity(result);
    });
  }

  /**
   * Get chain email IDs
   */
  async getChainEmailIds(chainId: string): Promise<string[]> {
    return executeQuery((db) => {
      const stmt = db.prepare(`SELECT email_ids FROM ${this.tableName} WHERE chain_id = ?`);
      const result = stmt.get(chainId) as any;
      
      if (!result || !result.email_ids) {
        return [];
      }
      
      return JSON.parse(result.email_ids);
    });
  }

  /**
   * Find chains that need reanalysis
   */
  async findChainsNeedingReanalysis(lastAnalyzedBefore: Date): Promise<EmailChain[]> {
    return executeQuery((db) => {
      const stmt = db.prepare(`
        SELECT * FROM ${this.tableName}
        WHERE last_analyzed IS NULL OR last_analyzed < ?
        ORDER BY completeness_score ASC, created_at ASC
      `);
      const rows = stmt.all(lastAnalyzedBefore.toISOString());
      return rows.map(row => this.mapRowToEntity(row));
    });
  }

  /**
   * Override methods to use connection pool
   */
  async findById(id: string): Promise<EmailChain | null> {
    return executeQuery((db) => {
      const stmt = db.prepare(`SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = ?`);
      const row = stmt.get(id);
      return row ? this.mapRowToEntity(row) : null;
    });
  }

  async create(data: Omit<EmailChain, 'id'>): Promise<EmailChain> {
    return executeQuery((db) => {
      const id = this.generateId();
      const chainData: EmailChain = {
        ...data,
        id,
        created_at: new Date()
      };

      const row = this.mapEntityToRow(chainData);
      const columns = Object.keys(row);
      const values = columns.map(col => row[col]);
      const placeholders = columns.map(() => '?').join(', ');

      const query = `INSERT INTO ${this.tableName} (id, ${columns.join(', ')}, created_at) VALUES (?, ${placeholders}, datetime('now'))`;
      const stmt = db.prepare(query);
      stmt.run(id, ...values);

      logger.info('Chain created', 'CHAIN_REPOSITORY', { chainId: chainData.chain_id });
      return chainData;
    });
  }

  async update(id: string, data: Partial<Omit<EmailChain, 'id' | 'created_at'>>): Promise<EmailChain | null> {
    return executeQuery((db) => {
      const row = this.mapEntityToRow(data);
      const columns = Object.keys(row);
      
      if (columns.length === 0) {
        return this.findById(id);
      }

      const values = columns.map(col => row[col]);
      values.push(id);

      const setClause = columns.map(col => `${col} = ?`).join(', ');
      const query = `UPDATE ${this.tableName} SET ${setClause}, updated_at = datetime('now') WHERE ${this.primaryKey} = ?`;
      
      const stmt = db.prepare(query);
      const result = stmt.run(...values);

      if (result.changes === 0) {
        return null;
      }

      logger.info('Chain updated', 'CHAIN_REPOSITORY', { id });
      return this.findById(id);
    });
  }
}