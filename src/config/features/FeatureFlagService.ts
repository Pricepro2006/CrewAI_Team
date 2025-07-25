/**
 * Feature Flag Service for GROUP 2B WebSearch Enhancement
 * 
 * Provides:
 * - Environment-based configuration
 * - A/B testing with percentage rollout
 * - Dynamic toggling without restart
 * - Integration with existing config system
 */

import { EventEmitter } from 'events';
import { config } from 'dotenv';
import { logger } from '../../utils/logger';
import fs from 'fs';
import path from 'path';

config();

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  description: string;
  rolloutPercentage: number; // 0-100
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeatureFlagConfig {
  flags: FeatureFlag[];
  defaultRolloutPercentage: number;
  configFilePath?: string;
  refreshIntervalMs?: number;
}

export class FeatureFlagService extends EventEmitter {
  private static instance: FeatureFlagService;
  private flags: Map<string, FeatureFlag> = new Map();
  private config: FeatureFlagConfig;
  private refreshInterval?: NodeJS.Timeout;
  private userAssignments: Map<string, Map<string, boolean>> = new Map(); // userId -> flagName -> assignment

  private constructor() {
    super();
    
    this.config = {
      flags: [],
      defaultRolloutPercentage: 0,
      configFilePath: process.env.FEATURE_FLAGS_PATH || path.join(process.cwd(), 'feature-flags.json'),
      refreshIntervalMs: parseInt(process.env.FEATURE_FLAGS_REFRESH_MS || '60000') // 1 minute default
    };

    this.initialize();
  }

  public static getInstance(): FeatureFlagService {
    if (!FeatureFlagService.instance) {
      FeatureFlagService.instance = new FeatureFlagService();
    }
    return FeatureFlagService.instance;
  }

  private initialize(): void {
    // Load from environment variables first
    this.loadFromEnvironment();
    
    // Then load from config file if exists
    this.loadFromFile();
    
    // Start refresh interval if configured
    if (this.config.refreshIntervalMs && this.config.refreshIntervalMs > 0) {
      this.startRefreshInterval();
    }

    // Initialize business search enhancement flag
    this.ensureBusinessSearchFlag();
  }

  /**
   * Load feature flags from environment variables
   * Format: FEATURE_FLAG_<FLAG_NAME>=true|false|<percentage>
   */
  private loadFromEnvironment(): void {
    const envFlags = Object.entries(process.env)
      .filter(([key]) => key.startsWith('FEATURE_FLAG_'))
      .map(([key, value]) => {
        const flagName = key.replace('FEATURE_FLAG_', '').toLowerCase().replace(/_/g, '-');
        
        let enabled = false;
        let rolloutPercentage = 0;
        
        if (value === 'true') {
          enabled = true;
          rolloutPercentage = 100;
        } else if (value === 'false') {
          enabled = false;
          rolloutPercentage = 0;
        } else {
          const percentage = parseInt(value || '0');
          if (!isNaN(percentage)) {
            enabled = percentage > 0;
            rolloutPercentage = Math.min(100, Math.max(0, percentage));
          }
        }

        return {
          name: flagName,
          enabled,
          description: `Loaded from environment variable ${key}`,
          rolloutPercentage,
          createdAt: new Date(),
          updatedAt: new Date()
        };
      });

    envFlags.forEach(flag => {
      this.flags.set(flag.name, flag);
      logger.info(`Loaded feature flag from env: ${flag.name} (${flag.rolloutPercentage}%)`);
    });
  }

  /**
   * Load feature flags from JSON file
   */
  private loadFromFile(): void {
    if (!this.config.configFilePath || !fs.existsSync(this.config.configFilePath)) {
      return;
    }

    try {
      const fileContent = fs.readFileSync(this.config.configFilePath, 'utf-8');
      const config = JSON.parse(fileContent) as FeatureFlagConfig;
      
      if (config.flags) {
        config.flags.forEach(flag => {
          // Don't override env-based flags
          if (!this.flags.has(flag.name)) {
            this.flags.set(flag.name, {
              ...flag,
              createdAt: new Date(flag.createdAt),
              updatedAt: new Date(flag.updatedAt)
            });
            logger.info(`Loaded feature flag from file: ${flag.name} (${flag.rolloutPercentage}%)`);
          }
        });
      }

      if (config.defaultRolloutPercentage !== undefined) {
        this.config.defaultRolloutPercentage = config.defaultRolloutPercentage;
      }
    } catch (error) {
      logger.error('Error loading feature flags from file', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Save current flags to file
   */
  private saveToFile(): void {
    if (!this.config.configFilePath) {
      return;
    }

    try {
      const config: FeatureFlagConfig = {
        flags: Array.from(this.flags.values()),
        defaultRolloutPercentage: this.config.defaultRolloutPercentage
      };

      fs.writeFileSync(
        this.config.configFilePath,
        JSON.stringify(config, null, 2),
        'utf-8'
      );
      
      logger.debug('Feature flags saved to file');
    } catch (error) {
      logger.error('Error saving feature flags to file', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Ensure business search enhancement flag exists
   */
  private ensureBusinessSearchFlag(): void {
    if (!this.flags.has('business-search-enhancement')) {
      const defaultPercentage = parseInt(
        process.env.BUSINESS_SEARCH_ROLLOUT_PERCENTAGE || 
        process.env.FEATURE_FLAG_BUSINESS_SEARCH_ENHANCEMENT || 
        '0'
      );

      this.flags.set('business-search-enhancement', {
        name: 'business-search-enhancement',
        enabled: defaultPercentage > 0,
        description: 'GROUP 2B WebSearch Enhancement - Enables business search capabilities in chat',
        rolloutPercentage: defaultPercentage,
        metadata: {
          group: '2B',
          component: 'WebSearch',
          impact: 'high',
          dependencies: ['BusinessSearchPromptEnhancer', 'BusinessQueryOptimizer', 'BusinessResponseValidator']
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });

      logger.info(`Initialized business-search-enhancement flag with ${defaultPercentage}% rollout`);
    }
  }

  /**
   * Start automatic refresh interval
   */
  private startRefreshInterval(): void {
    this.refreshInterval = setInterval(() => {
      this.refresh();
    }, this.config.refreshIntervalMs!);
  }

  /**
   * Refresh flags from sources
   */
  public refresh(): void {
    const previousFlags = new Map(this.flags);
    
    this.loadFromEnvironment();
    this.loadFromFile();
    
    // Check for changes and emit events
    this.flags.forEach((flag, name) => {
      const previousFlag = previousFlags.get(name);
      if (!previousFlag || 
          previousFlag.enabled !== flag.enabled || 
          previousFlag.rolloutPercentage !== flag.rolloutPercentage) {
        this.emit('flag_changed', {
          name,
          previous: previousFlag,
          current: flag
        });
      }
    });
  }

  /**
   * Check if a feature flag is enabled (simple check)
   */
  public isEnabled(flagName: string): boolean {
    const flag = this.flags.get(flagName);
    return flag?.enabled || false;
  }

  /**
   * Check if a feature is enabled for a specific user (A/B testing)
   */
  public isEnabledForUser(flagName: string, userId: string): boolean {
    const flag = this.flags.get(flagName);
    if (!flag || !flag.enabled) {
      return false;
    }

    // 100% rollout
    if (flag.rolloutPercentage >= 100) {
      return true;
    }

    // 0% rollout
    if (flag.rolloutPercentage <= 0) {
      return false;
    }

    // Check if we already have an assignment for this user
    if (!this.userAssignments.has(userId)) {
      this.userAssignments.set(userId, new Map());
    }

    const userFlags = this.userAssignments.get(userId)!;
    if (userFlags.has(flagName)) {
      return userFlags.get(flagName)!;
    }

    // Generate stable assignment based on userId hash
    const hash = this.hashUserId(userId);
    const assignment = (hash % 100) < flag.rolloutPercentage;
    
    // Store assignment for consistency
    userFlags.set(flagName, assignment);
    
    return assignment;
  }

  /**
   * Get user's percentage bucket (for A/B testing)
   */
  public getUserPercentage(flagName: string): number {
    const flag = this.flags.get(flagName);
    return flag?.rolloutPercentage || 0;
  }

  /**
   * Simple hash function for userId to ensure consistent assignment
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get a feature flag
   */
  public getFlag(flagName: string): FeatureFlag | undefined {
    return this.flags.get(flagName);
  }

  /**
   * Get all feature flags
   */
  public getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  /**
   * Update a feature flag
   */
  public updateFlag(flagName: string, updates: Partial<FeatureFlag>): void {
    const flag = this.flags.get(flagName);
    if (!flag) {
      logger.warn(`Feature flag ${flagName} not found`);
      return;
    }

    const updatedFlag = {
      ...flag,
      ...updates,
      name: flagName, // Prevent name change
      updatedAt: new Date()
    };

    this.flags.set(flagName, updatedFlag);
    this.saveToFile();

    logger.info(`Updated feature flag: ${flagName}`, 'FEATURE_FLAGS', updates);
    
    this.emit('flag_updated', {
      name: flagName,
      previous: flag,
      current: updatedFlag
    });
  }

  /**
   * Create a new feature flag
   */
  public createFlag(flag: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>): void {
    if (this.flags.has(flag.name)) {
      logger.warn(`Feature flag ${flag.name} already exists`);
      return;
    }

    const newFlag: FeatureFlag = {
      ...flag,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.flags.set(flag.name, newFlag);
    this.saveToFile();

    logger.info(`Created feature flag: ${flag.name}`);
    
    this.emit('flag_created', newFlag);
  }

  /**
   * Delete a feature flag
   */
  public deleteFlag(flagName: string): void {
    const flag = this.flags.get(flagName);
    if (!flag) {
      logger.warn(`Feature flag ${flagName} not found`);
      return;
    }

    this.flags.delete(flagName);
    this.saveToFile();

    logger.info(`Deleted feature flag: ${flagName}`);
    
    this.emit('flag_deleted', flag);
  }

  /**
   * Enable a feature flag
   */
  public enableFlag(flagName: string, rolloutPercentage: number = 100): void {
    this.updateFlag(flagName, {
      enabled: true,
      rolloutPercentage: Math.min(100, Math.max(0, rolloutPercentage))
    });
  }

  /**
   * Disable a feature flag
   */
  public disableFlag(flagName: string): void {
    this.updateFlag(flagName, {
      enabled: false,
      rolloutPercentage: 0
    });
  }

  /**
   * Set rollout percentage for a flag
   */
  public setRolloutPercentage(flagName: string, percentage: number): void {
    const validPercentage = Math.min(100, Math.max(0, percentage));
    this.updateFlag(flagName, {
      rolloutPercentage: validPercentage,
      enabled: validPercentage > 0
    });
  }

  /**
   * Clear user assignments (useful for testing)
   */
  public clearUserAssignments(): void {
    this.userAssignments.clear();
  }

  /**
   * Export current state (for debugging/monitoring)
   */
  public exportState(): {
    flags: FeatureFlag[];
    userAssignmentCount: number;
    config: FeatureFlagConfig;
  } {
    return {
      flags: this.getAllFlags(),
      userAssignmentCount: this.userAssignments.size,
      config: this.config
    };
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    this.removeAllListeners();
  }
}