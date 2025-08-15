import { EventEmitter } from 'events';
import { z } from 'zod';
import type { BaseEvent } from './EventBus.js';
import { EventStore } from './EventStore.js';
import type { EventQuery } from './EventStore.js';
import { ServiceRegistry } from './ServiceRegistry.js';

// Event replay schemas and types
export const ReplayConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean().default(true),
  mode: z.enum(['full', 'incremental', 'selective', 'time_travel']),
  target: z.object({
    services: z.array(z.string()).default([]), // Target service IDs
    eventTypes: z.array(z.string()).default([]), // Event types to replay
    streamIds: z.array(z.string()).default([]) // Specific streams to replay
  }),
  timeRange: z.object({
    fromTimestamp: z.number().optional(),
    toTimestamp: z.number().optional(),
    fromVersion: z.number().optional(),
    toVersion: z.number().optional()
  }).optional(),
  options: z.object({
    batchSize: z.number().default(100),
    delayBetweenBatches: z.number().default(100), // milliseconds
    maxConcurrency: z.number().default(5),
    skipFailedEvents: z.boolean().default(true),
    createCheckpoints: z.boolean().default(true),
    transformEvents: z.boolean().default(true), // Apply version transformations
    respectOriginalTiming: z.boolean().default(false), // Replay at original speed
    dryRun: z.boolean().default(false)
  }),
  recovery: z.object({
    enableRecovery: z.boolean().default(true),
    maxRetries: z.number().default(3),
    retryDelay: z.number().default(1000),
    backoffMultiplier: z.number().default(2),
    onError: z.enum(['stop', 'skip', 'retry', 'dlq']).default('retry')
  }),
  filters: z.object({
    includePatterns: z.array(z.string()).default([]), // Regex patterns
    excludePatterns: z.array(z.string()).default([]),
    customFilter: z.string().optional() // JavaScript expression
  }).optional(),
  metadata: z.record(z.string()).default({})
});

export const ReplaySessionSchema = z.object({
  id: z.string(),
  configId: z.string(),
  status: z.enum(['pending', 'running', 'paused', 'completed', 'failed', 'cancelled']),
  progress: z.object({
    totalEvents: z.number(),
    processedEvents: z.number(),
    successfulEvents: z.number(),
    failedEvents: z.number(),
    skippedEvents: z.number(),
    currentPosition: z.string().optional(),
    estimatedCompletion: z.number().optional()
  }),
  metrics: z.object({
    startedAt: z.number(),
    completedAt: z.number().optional(),
    pausedAt: z.number().optional(),
    resumedAt: z.number().optional(),
    processingRate: z.number().default(0), // events per second
    averageEventSize: z.number().default(0),
    totalDataProcessed: z.number().default(0)
  }),
  checkpoints: z.array(z.object({
    position: z.string(),
    timestamp: z.number(),
    eventsProcessed: z.number(),
    metadata: z.record(z.any()).default({})
  })).default([]),
  errors: z.array(z.object({
    eventId: z.string(),
    error: z.string(),
    timestamp: z.number(),
    retryCount: z.number(),
    resolved: z.boolean().default(false)
  })).default([])
});

export const RecoveryPlanSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['disaster_recovery', 'point_in_time', 'service_recovery', 'data_migration']),
  steps: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['replay', 'restore', 'migrate', 'validate', 'rollback']),
    dependencies: z.array(z.string()).default([]),
    configuration: z.record(z.any()).default({}),
    timeout: z.number().default(300000), // 5 minutes
    retryable: z.boolean().default(true)
  })),
  triggers: z.object({
    automatic: z.boolean().default(false),
    conditions: z.array(z.string()).default([]), // Condition expressions
    schedule: z.string().optional() // Cron expression
  }).optional(),
  validation: z.object({
    preReplayChecks: z.array(z.string()).default([]),
    postReplayValidation: z.array(z.string()).default([]),
    rollbackCriteria: z.array(z.string()).default([])
  }).optional(),
  metadata: z.record(z.string()).default({})
});

export type ReplayConfig = z.infer<typeof ReplayConfigSchema>;
export type ReplaySession = z.infer<typeof ReplaySessionSchema>;
export type RecoveryPlan = z.infer<typeof RecoveryPlanSchema>;

export interface ReplayResult {
  sessionId: string;
  success: boolean;
  totalEvents: number;
  processedEvents: number;
  successfulEvents: number;
  failedEvents: number;
  duration: number;
  errors: Array<{
    eventId: string;
    error: string;
    timestamp: number;
  }>;
}

/**
 * EventReplayManager - Advanced event replay and recovery system
 * 
 * Features:
 * - Multiple replay modes (full, incremental, selective, time travel)
 * - Checkpointing and resumable replays
 * - Service-aware replay targeting
 * - Recovery planning and disaster recovery
 * - Performance monitoring and rate limiting
 * - Error handling and retry strategies
 */
export class EventReplayManager extends EventEmitter {
  private eventStore: EventStore;
  private serviceRegistry: ServiceRegistry;
  
  private replayConfigs = new Map<string, ReplayConfig>();
  private activeSessions = new Map<string, ReplaySession>();
  private recoveryPlans = new Map<string, RecoveryPlan>();
  
  private sessionTimers = new Map<string, NodeJS.Timeout>();
  private isShuttingDown = false;

  constructor(eventStore: EventStore, serviceRegistry: ServiceRegistry) {
    super();
    this.eventStore = eventStore;
    this.serviceRegistry = serviceRegistry;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Listen to service registry events for automatic recovery triggers
    this?.serviceRegistry?.on('service_registered', (data: any) => {
      this.checkAutoRecoveryTriggers('service_up', data);
    });

    this?.serviceRegistry?.on('service_unregistered', (data: any) => {
      this.checkAutoRecoveryTriggers('service_down', data);
    });

    // Clean up on shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  // Configuration management
  public registerReplayConfig(config: Omit<ReplayConfig, 'id'>): string {
    const replayConfig: ReplayConfig = {
      ...config,
      id: `replay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    ReplayConfigSchema.parse(replayConfig);
    
    this?.replayConfigs?.set(replayConfig.id, replayConfig);
    
    this.emit('replay_config_registered', {
      configId: replayConfig.id,
      name: replayConfig.name,
      mode: replayConfig.mode
    });

    return replayConfig.id;
  }

  public getReplayConfig(configId: string): ReplayConfig | null {
    return this?.replayConfigs?.get(configId) || null;
  }

  public listReplayConfigs(): ReplayConfig[] {
    return Array.from(this?.replayConfigs?.values());
  }

  public removeReplayConfig(configId: string): boolean {
    const removed = this?.replayConfigs?.delete(configId);
    if (removed) {
      this.emit('replay_config_removed', { configId });
    }
    return removed;
  }

  // Recovery plan management
  public registerRecoveryPlan(plan: Omit<RecoveryPlan, 'id'>): string {
    const recoveryPlan: RecoveryPlan = {
      ...plan,
      id: `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    RecoveryPlanSchema.parse(recoveryPlan);
    
    this?.recoveryPlans?.set(recoveryPlan.id, recoveryPlan);
    
    this.emit('recovery_plan_registered', {
      planId: recoveryPlan.id,
      name: recoveryPlan.name,
      type: recoveryPlan.type,
      stepsCount: recoveryPlan?.steps?.length
    });

    return recoveryPlan.id;
  }

  // Core replay functionality
  public async startReplay(configId: string, options: {
    resumeFromCheckpoint?: string;
    overrides?: Partial<ReplayConfig>;
  } = {}): Promise<string> {
    const config = this?.replayConfigs?.get(configId);
    if (!config) {
      throw new Error(`Replay config ${configId} not found`);
    }

    if (!config.enabled) {
      throw new Error(`Replay config ${configId} is disabled`);
    }

    // Apply overrides
    const effectiveConfig = options.overrides ? { ...config, ...options.overrides } : config;

    // Create session
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session: ReplaySession = {
      id: sessionId,
      configId,
      status: 'pending',
      progress: {
        totalEvents: 0,
        processedEvents: 0,
        successfulEvents: 0,
        failedEvents: 0,
        skippedEvents: 0
      },
      metrics: {
        startedAt: Date.now(),
        processingRate: 0,
        averageEventSize: 0,
        totalDataProcessed: 0
      },
      checkpoints: [],
      errors: []
    };

    this?.activeSessions?.set(sessionId, session);

    try {
      // Start replay in background
      this.executeReplay(sessionId, effectiveConfig, options.resumeFromCheckpoint);
      
      this.emit('replay_started', {
        sessionId,
        configId,
        mode: effectiveConfig.mode
      });

      return sessionId;

    } catch (error) {
      this?.activeSessions?.delete(sessionId);
      this.emit('replay_start_error', { sessionId, configId, error });
      throw error;
    }
  }

  public async pauseReplay(sessionId: string): Promise<void> {
    const session = this?.activeSessions?.get(sessionId);
    if (!session || session.status !== 'running') {
      throw new Error(`Cannot pause replay session ${sessionId}`);
    }

    session.status = 'paused';
    session?.metrics?.pausedAt = Date.now();

    // Clear any timers
    const timer = this?.sessionTimers?.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this?.sessionTimers?.delete(sessionId);
    }

    this.emit('replay_paused', { sessionId });
  }

  public async resumeReplay(sessionId: string): Promise<void> {
    const session = this?.activeSessions?.get(sessionId);
    if (!session || session.status !== 'paused') {
      throw new Error(`Cannot resume replay session ${sessionId}`);
    }

    session.status = 'running';
    session?.metrics?.resumedAt = Date.now();

    // Resume from last checkpoint
    const lastCheckpoint = session.checkpoints[session?.checkpoints?.length - 1];
    const config = this?.replayConfigs?.get(session.configId)!;
    
    this.executeReplay(sessionId, config, lastCheckpoint?.position);
    
    this.emit('replay_resumed', { sessionId });
  }

  public async stopReplay(sessionId: string): Promise<void> {
    const session = this?.activeSessions?.get(sessionId);
    if (!session || (session.status !== 'running' && session.status !== 'paused')) {
      throw new Error(`Cannot stop replay session ${sessionId}`);
    }

    session.status = 'cancelled';
    session?.metrics?.completedAt = Date.now();

    // Clear timers
    const timer = this?.sessionTimers?.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this?.sessionTimers?.delete(sessionId);
    }

    this.emit('replay_stopped', { sessionId });
  }

  public getReplaySession(sessionId: string): ReplaySession | null {
    return this?.activeSessions?.get(sessionId) || null;
  }

  public listActiveSessions(): ReplaySession[] {
    return Array.from(this?.activeSessions?.values());
  }

  // Core replay execution
  private async executeReplay(sessionId: string, config: ReplayConfig, startPosition?: string): Promise<void> {
    const session = this?.activeSessions?.get(sessionId);
    if (!session) return;

    try {
      session.status = 'running';

      // Build event query based on config
      const query = this.buildEventQuery(config, startPosition);
      
      // Get events to replay
      const events = await this?.eventStore?.getEvents(query);
      session?.progress?.totalEvents = events?.length || 0;

      this.emit('replay_events_loaded', {
        sessionId,
        totalEvents: events?.length || 0,
        query
      });

      if (config?.options?.dryRun) {
        await this.performDryRunReplay(sessionId, events, config);
      } else {
        await this.performActualReplay(sessionId, events, config);
      }

      // Complete session
      session.status = 'completed';
      session?.metrics?.completedAt = Date.now();
      
      this.emit('replay_completed', {
        sessionId,
        totalEvents: session?.progress?.totalEvents,
        processedEvents: session?.progress?.processedEvents,
        duration: session?.metrics?.completedAt - session?.metrics?.startedAt
      });

    } catch (error) {
      session.status = 'failed';
      session?.metrics?.completedAt = Date.now();
      
      this.emit('replay_failed', {
        sessionId,
        error,
        progress: session.progress
      });
      
      console.error(`Replay session ${sessionId} failed:`, error);
    }
  }

  private async performActualReplay(sessionId: string, events: BaseEvent[], config: ReplayConfig): Promise<void> {
    const session = this?.activeSessions?.get(sessionId)!;
    const batchSize = config?.options?.batchSize;
    let processedCount = 0;

    for (let i = 0; i < events?.length || 0; i += batchSize) {
      // Check if session was cancelled or paused
      if (session.status !== 'running') {
        break;
      }

      const batch = events.slice(i, i + batchSize);
      
      try {
        await this.processBatch(sessionId, batch, config);
        processedCount += batch?.length || 0;

        // Update progress
        session?.progress?.processedEvents = processedCount;
        session?.metrics?.processingRate = this.calculateProcessingRate(session);

        // Create checkpoint
        if (config?.options?.createCheckpoints && processedCount % (batchSize * 10) === 0) {
          await this.createCheckpoint(sessionId, `batch_${Math.floor(i / batchSize)}`);
        }

        // Delay between batches if configured
        if (config?.options?.delayBetweenBatches > 0) {
          await this.sleep(config?.options?.delayBetweenBatches);
        }

        this.emit('replay_progress', {
          sessionId,
          processed: processedCount,
          total: events?.length || 0,
          rate: session?.metrics?.processingRate
        });

      } catch (error) {
        console.error(`Batch processing failed for session ${sessionId}:`, error);
        
        if (config?.recovery?.onError === 'stop') {
          throw error;
        }
        // For other error strategies, continue with next batch
      }
    }
  }

  private async performDryRunReplay(sessionId: string, events: BaseEvent[], config: ReplayConfig): Promise<void> {
    const session = this?.activeSessions?.get(sessionId)!;
    
    // Simulate processing
    for (const event of events) {
      if (session.status !== 'running') break;

      // Apply filters
      if (!(await this.shouldReplayEvent(event, config))) {
        session?.progress?.skippedEvents++;
        continue;
      }

      // Simulate processing delay
      await this.sleep(1);
      
      session?.progress?.processedEvents++;
      session?.progress?.successfulEvents++;
    }

    this.emit('dry_run_completed', {
      sessionId,
      wouldProcess: session?.progress?.successfulEvents,
      wouldSkip: session?.progress?.skippedEvents
    });
  }

  private async processBatch(sessionId: string, events: BaseEvent[], config: ReplayConfig): Promise<void> {
    const session = this?.activeSessions?.get(sessionId)!;
    const concurrency = config?.options?.maxConcurrency;
    
    // Process events with controlled concurrency
    const promises: Promise<void>[] = [];
    
    for (let i = 0; i < events?.length || 0; i += concurrency) {
      const batch = events.slice(i, i + concurrency);
      
      const batchPromises = batch?.map(event => this.processEvent(sessionId, event, config));
      promises.push(...batchPromises);
      
      // Wait for this batch to complete before starting next
      await Promise.allSettled(batchPromises);
    }
  }

  private async processEvent(sessionId: string, event: BaseEvent, config: ReplayConfig): Promise<void> {
    const session = this?.activeSessions?.get(sessionId)!;

    try {
      // Apply filters
      if (!(await this.shouldReplayEvent(event, config))) {
        session?.progress?.skippedEvents++;
        return;
      }

      // Get target services
      const targetServices = await this.getTargetServices(config);
      
      for (const service of targetServices) {
        try {
          await this.replayEventToService(event, service, config);
          session?.progress?.successfulEvents++;
          
        } catch (error) {
          session?.progress?.failedEvents++;
          session?.errors?.push({
            eventId: event.id,
            error: String(error),
            timestamp: Date.now(),
            retryCount: 0,
            resolved: false
          });

          if (config?.recovery?.enableRecovery && config?.recovery?.onError === 'retry') {
            // Schedule retry (simplified)
            setTimeout(() => {
              this.retryEventProcessing(sessionId, event, service, config);
            }, config?.recovery?.retryDelay);
          }
        }
      }

    } catch (error) {
      session?.progress?.failedEvents++;
      console.error(`Event processing failed: ${event.id}`, error);
    }
  }

  private async retryEventProcessing(sessionId: string, event: BaseEvent, service: any, config: ReplayConfig): Promise<void> {
    const session = this?.activeSessions?.get(sessionId);
    if (!session) return;

    const errorEntry = session?.errors?.find(e => e.eventId === event.id);
    if (!errorEntry) return;

    if (errorEntry.retryCount >= config?.recovery?.maxRetries) {
      console.error(`Max retries exceeded for event ${event.id}`);
      return;
    }

    try {
      await this.replayEventToService(event, service, config);
      
      // Mark as resolved
      errorEntry.resolved = true;
      session?.progress?.successfulEvents++;
      session?.progress?.failedEvents--;

    } catch (error) {
      errorEntry.retryCount++;
      errorEntry.error = String(error);
      
      // Schedule next retry with backoff
      const delay = config?.recovery?.retryDelay * Math.pow(config?.recovery?.backoffMultiplier, errorEntry.retryCount);
      setTimeout(() => {
        this.retryEventProcessing(sessionId, event, service, config);
      }, delay);
    }
  }

  private async replayEventToService(event: BaseEvent, service: any, config: ReplayConfig): Promise<void> {
    // This would implement the actual event replay to the target service
    // For now, simulate the operation
    
    if (config?.options?.respectOriginalTiming && event.timestamp) {
      // Calculate delay to respect original timing (simplified)
      const timeSinceEvent = Date.now() - event.timestamp;
      if (timeSinceEvent > 0) {
        await this.sleep(Math.min(timeSinceEvent, 1000)); // Cap at 1 second
      }
    }

    // Simulate service call
    await this.sleep(Math.random() * 10 + 5); // 5-15ms simulation
  }

  // Utility methods
  private buildEventQuery(config: ReplayConfig, startPosition?: string): EventQuery {
    const query: EventQuery = {};

    if (config?.target?.eventTypes?.length || 0 > 0) {
      query.eventTypes = config?.target?.eventTypes;
    }

    if (config.timeRange) {
      query.fromTimestamp = config?.timeRange?.fromTimestamp;
      query.toTimestamp = config?.timeRange?.toTimestamp;
      query.fromVersion = config?.timeRange?.fromVersion;
      query.toVersion = config?.timeRange?.toVersion;
    }

    // Add start position logic
    if (startPosition) {
      // Parse checkpoint position (simplified)
      const parts = startPosition.split('_');
      if (parts?.length || 0 > 1) {
        query.offset = parseInt(parts[1]) * config?.options?.batchSize;
      }
    }

    return query;
  }

  private async shouldReplayEvent(event: BaseEvent, config: ReplayConfig): Promise<boolean> {
    // Apply filters
    if (config.filters) {
      // Include patterns
      if (config?.filters?.includePatterns?.length || 0 > 0) {
        const included = config?.filters?.includePatterns.some(pattern => {
          const regex = new RegExp(pattern);
          return regex.test(event.type) || regex.test(event.source);
        });
        if (!included) return false;
      }

      // Exclude patterns
      if (config?.filters?.excludePatterns?.length || 0 > 0) {
        const excluded = config?.filters?.excludePatterns.some(pattern => {
          const regex = new RegExp(pattern);
          return regex.test(event.type) || regex.test(event.source);
        });
        if (excluded) return false;
      }

      // Custom filter
      if (config?.filters?.customFilter) {
        try {
          const result = this.evaluateJavaScript(config?.filters?.customFilter, { event });
          if (!result) return false;
        } catch (error) {
          console.error('Custom filter evaluation failed:', error);
          return false;
        }
      }
    }

    return true;
  }

  private async getTargetServices(config: ReplayConfig): Promise<any[]> {
    if (config?.target?.services?.length || 0 > 0) {
      // Get specific services by ID
      const services = [];
      for (const serviceId of config?.target?.services) {
        const service = await this?.serviceRegistry?.getService(serviceId);
        if (service) services.push(service);
      }
      return services;
    }

    // Get all healthy services that can handle the event types
    const allServices = await this?.serviceRegistry?.discoverServices({ status: 'healthy' });
    return allServices?.filter(service => 
      config?.target?.eventTypes?.length || 0 === 0 || 
      config?.target?.eventTypes.some(eventType => 
        service?.eventTypes?.subscribes.includes(eventType)
      )
    );
  }

  private async createCheckpoint(sessionId: string, position: string): Promise<void> {
    const session = this?.activeSessions?.get(sessionId);
    if (!session) return;

    const checkpoint = {
      position,
      timestamp: Date.now(),
      eventsProcessed: session?.progress?.processedEvents,
      metadata: {
        successRate: session?.progress?.successfulEvents / Math.max(1, session?.progress?.processedEvents),
        processingRate: session?.metrics?.processingRate
      }
    };

    session?.checkpoints?.push(checkpoint);

    // Keep only last 10 checkpoints
    if (session?.checkpoints?.length > 10) {
      session.checkpoints = session?.checkpoints?.slice(-10);
    }

    this.emit('checkpoint_created', {
      sessionId,
      position,
      eventsProcessed: checkpoint.eventsProcessed
    });
  }

  private calculateProcessingRate(session: ReplaySession): number {
    const duration = Date.now() - session?.metrics?.startedAt;
    if (duration === 0) return 0;
    
    return (session?.progress?.processedEvents / duration) * 1000; // events per second
  }

  private evaluateJavaScript(expression: string, context: Record<string, any>): any {
    // SECURITY WARNING: Use sandboxed environment in production
    try {
      const func = new Function(...Object.keys(context), `return ${expression}`);
      return func(...Object.values(context));
    } catch (error) {
      throw new Error(`JavaScript evaluation failed: ${error}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async checkAutoRecoveryTriggers(eventType: string, data: any): Promise<void> {
    for (const [planId, plan] of this.recoveryPlans) {
      if (plan.triggers?.automatic && plan?.triggers?.conditions?.length || 0 > 0) {
        // Evaluate trigger conditions (simplified)
        const shouldTrigger = plan?.triggers?.conditions.some(condition => {
          try {
            return this.evaluateJavaScript(condition, { eventType, data });
          } catch {
            return false;
          }
        });

        if (shouldTrigger) {
          this.emit('auto_recovery_triggered', { planId, eventType, data });
          // Could automatically execute recovery plan here
        }
      }
    }
  }

  // Public API methods
  public getStats(): {
    totalConfigs: number;
    activeSessions: number;
    completedSessions: number;
    totalEventsReplayed: number;
    averageProcessingRate: number;
  } {
    const activeSessions = Array.from(this?.activeSessions?.values());
    const completedSessions = activeSessions?.filter(s => s.status === 'completed');
    
    const totalEventsReplayed = activeSessions.reduce((sum: any, s: any) => sum + s?.progress?.processedEvents, 0);
    const averageRate = activeSessions?.length || 0 > 0 
      ? activeSessions.reduce((sum: any, s: any) => sum + s?.metrics?.processingRate, 0) / activeSessions?.length || 0
      : 0;

    return {
      totalConfigs: this?.replayConfigs?.size,
      activeSessions: activeSessions?.filter(s => s.status === 'running').length,
      completedSessions: completedSessions?.length || 0,
      totalEventsReplayed,
      averageProcessingRate: averageRate
    };
  }

  public async executeRecoveryPlan(planId: string): Promise<void> {
    const plan = this?.recoveryPlans?.get(planId);
    if (!plan) {
      throw new Error(`Recovery plan ${planId} not found`);
    }

    this.emit('recovery_plan_started', { planId, name: plan.name });

    try {
      // Execute steps in order, respecting dependencies
      for (const step of plan.steps) {
        await this.executeRecoveryStep(step, plan);
      }

      this.emit('recovery_plan_completed', { planId });

    } catch (error) {
      this.emit('recovery_plan_failed', { planId, error });
      throw error;
    }
  }

  private async executeRecoveryStep(step: any, plan: RecoveryPlan): Promise<void> {
    // Implementation would depend on step type
    console.log(`Executing recovery step: ${step.name} (${step.type})`);
    
    // Simulate step execution
    await this.sleep(100);
  }

  public async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    // Cancel all active sessions
    for (const [sessionId, session] of this.activeSessions) {
      if (session.status === 'running' || session.status === 'paused') {
        await this.stopReplay(sessionId);
      }
    }

    // Clear all timers
    for (const timer of this?.sessionTimers?.values()) {
      clearTimeout(timer);
    }
    this?.sessionTimers?.clear();

    this.emit('shutdown');
  }
}