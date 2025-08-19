import { EventEmitter } from 'events';
import { z } from 'zod';
import type { BaseEvent } from './EventBus.js';

// Event versioning schemas and types
export const EventSchemaSchema = z.object({
  eventType: z.string(),
  version: z.number().int().min(1),
  schema: z.object({
    payload: z.record(z.any()),
    metadata: z.record(z.any()).optional(),
    required: z.array(z.string()).default([]),
    deprecated: z.array(z.string()).default([])
  }),
  compatibility: z.enum(['forward', 'backward', 'full', 'none']).default('backward'),
  description: z.string().optional(),
  examples: z.array(z.record(z.any())).default([]),
  changelog: z.string().optional(),
  createdAt: z.number(),
  createdBy: z.string()
});

export const SchemaEvolutionRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean().default(true),
  fromVersion: z.number().int().min(1),
  toVersion: z.number().int().min(1),
  eventType: z.string(),
  transformType: z.enum(['upgrade', 'downgrade', 'migrate']),
  transformation: z.object({
    fieldMappings: z.record(z.string()).default({}), // old_field -> new_field
    defaultValues: z.record(z.any()).default({}), // field -> default_value
    removedFields: z.array(z.string()).default([]),
    addedFields: z.array(z.string()).default([]),
    customTransform: z.string().optional() // JavaScript function
  }),
  metadata: z.record(z.string()).default({})
});

export const VersioningConfigSchema = z.object({
  enableVersioning: z.boolean().default(true),
  enableAutoUpgrade: z.boolean().default(true),
  enableAutoDowngrade: z.boolean().default(false),
  maxVersionsSupported: z.number().default(5),
  defaultCompatibilityMode: z.enum(['forward', 'backward', 'full', 'none']).default('backward'),
  strictValidation: z.boolean().default(true),
  cacheTransformations: z.boolean().default(true),
  enableMetrics: z.boolean().default(true)
});

export type EventSchema = z.infer<typeof EventSchemaSchema>;
export type SchemaEvolutionRule = z.infer<typeof SchemaEvolutionRuleSchema>;
export type VersioningConfig = z.infer<typeof VersioningConfigSchema>;

export interface VersionedEvent extends BaseEvent {
  schemaVersion: number;
  originalVersion?: number;
  transformationHistory?: Array<{
    fromVersion: number;
    toVersion: number;
    transformedAt: number;
    rule: string;
  }>;
}

export interface TransformationResult {
  success: boolean;
  transformedEvent?: VersionedEvent;
  errors?: string[];
  warnings?: string[];
  metadata: {
    fromVersion: number;
    toVersion: number;
    transformationType: 'upgrade' | 'downgrade' | 'migrate';
    processingTime: number;
  };
}

export interface VersionCompatibility {
  eventType: string;
  fromVersion: number;
  toVersion: number;
  compatible: boolean;
  compatibilityType: 'forward' | 'backward' | 'full' | 'none';
  requiresTransformation: boolean;
  transformationRules: string[];
}

/**
 * EventVersionManager - Advanced event versioning and schema evolution
 * 
 * Features:
 * - Event schema management and validation
 * - Automatic event transformation (upgrade/downgrade)
 * - Schema evolution with compatibility checking
 * - Version migration strategies
 * - Validation and error handling
 * - Performance monitoring and caching
 */
export class EventVersionManager extends EventEmitter {
  private config: VersioningConfig;
  private schemas = new Map<string, Map<number, EventSchema>>(); // eventType -> version -> schema
  private evolutionRules = new Map<string, SchemaEvolutionRule[]>(); // eventType -> rules
  private transformationCache = new Map<string, TransformationResult>();
  
  private metrics = {
    transformations: {
      successful: 0,
      failed: 0,
      cached: 0
    },
    versions: {
      upgrades: 0,
      downgrades: 0,
      migrations: 0
    },
    validations: {
      passed: 0,
      failed: 0
    }
  };

  constructor(config: Partial<VersioningConfig> = {}) {
    super();
    this.config = VersioningConfigSchema.parse(config);
    this.startMetricsCollection();
  }

  private startMetricsCollection(): void {
    if (!this.config.enableMetrics) return;

    setInterval(() => {
      this.emit('version_metrics', {
        ...this.metrics,
        timestamp: Date.now(),
        cacheSize: this.transformationCache.size,
        schemaCount: Array.from(this.schemas.values()).reduce((sum: any, versions: any) => sum + versions.size, 0),
        ruleCount: Array.from(this.evolutionRules.values()).reduce((sum: any, rules: any) => sum + (rules?.length || 0), 0)
      });
    }, 60000); // Every minute
  }

  // Schema management
  public registerSchema(schema: Omit<EventSchema, 'createdAt'>): void {
    const now = Date.now();
    const eventSchema: EventSchema = {
      ...schema,
      createdAt: now
    };

    // Validate schema
    EventSchemaSchema.parse(eventSchema);

    const { eventType, version } = eventSchema;

    // Initialize event type map if needed
    if (!this.schemas.has(eventType)) {
      this.schemas.set(eventType, new Map());
    }

    const eventVersions = this.schemas.get(eventType)!;
    
    // Check for version conflicts
    if (eventVersions.has(version)) {
      throw new Error(`Schema for ${eventType} version ${version} already exists`);
    }

    // Validate compatibility with existing versions
    this.validateSchemaCompatibility(eventType, eventSchema);

    eventVersions.set(version, eventSchema);
    
    // Clean up old versions if limit exceeded
    if (eventVersions.size > this.config.maxVersionsSupported) {
      const versions = Array.from(eventVersions.keys()).sort((a, b) => a - b);
      const versionsToRemove = versions.slice(0, versions.length - this.config.maxVersionsSupported);
      
      for (const oldVersion of versionsToRemove) {
        eventVersions.delete(oldVersion);
        this.emit('schema_removed', { eventType, version: oldVersion });
      }
    }

    // Clear transformation cache for this event type
    this.clearCacheForEventType(eventType);

    this.emit('schema_registered', {
      eventType,
      version,
      compatibility: eventSchema.compatibility
    });

    console.log(`Registered schema: ${eventType} v${version}`);
  }

  public getSchema(eventType: string, version: number): EventSchema | null {
    const eventVersions = this.schemas.get(eventType);
    return eventVersions?.get(version) || null;
  }

  public getLatestSchema(eventType: string): EventSchema | null {
    const eventVersions = this.schemas.get(eventType);
    if (!eventVersions || eventVersions.size === 0) return null;

    const latestVersion = Math.max(...Array.from(eventVersions.keys()));
    return eventVersions.get(latestVersion) || null;
  }

  public listSchemas(eventType?: string): EventSchema[] {
    if (eventType) {
      const eventVersions = this.schemas.get(eventType);
      return eventVersions ? Array.from(eventVersions.values()) : [];
    }

    const allSchemas: EventSchema[] = [];
    for (const eventVersions of Array.from(this.schemas.values())) {
      allSchemas.push(...Array.from(eventVersions.values()));
    }

    return allSchemas.sort((a, b) => {
      if (a.eventType !== b.eventType) {
        return a.eventType.localeCompare(b.eventType);
      }
      return a.version - b.version;
    });
  }

  // Evolution rule management
  public registerEvolutionRule(rule: SchemaEvolutionRule): void {
    SchemaEvolutionRuleSchema.parse(rule);

    const { eventType } = rule;

    // Validate rule makes sense
    this.validateEvolutionRule(rule);

    if (!this.evolutionRules.has(eventType)) {
      this.evolutionRules.set(eventType, []);
    }

    const rules = this.evolutionRules.get(eventType)!;
    
    // Remove existing rule with same ID
    const existingIndex = rules.findIndex(r => r.id === rule.id);
    if (existingIndex >= 0) {
      rules.splice(existingIndex, 1);
    }

    rules.push(rule);
    
    // Sort rules by version order
    rules.sort((a, b) => a.fromVersion - b.fromVersion || a.toVersion - b.toVersion);

    // Clear transformation cache for this event type
    this.clearCacheForEventType(eventType);

    this.emit('evolution_rule_registered', {
      ruleId: rule.id,
      eventType,
      fromVersion: rule.fromVersion,
      toVersion: rule.toVersion,
      transformType: rule.transformType
    });
  }

  public removeEvolutionRule(eventType: string, ruleId: string): boolean {
    const rules = this.evolutionRules.get(eventType);
    if (!rules) return false;

    const index = rules.findIndex(r => r.id === ruleId);
    if (index === -1) return false;

    rules.splice(index, 1);
    this.clearCacheForEventType(eventType);

    this.emit('evolution_rule_removed', { eventType, ruleId });
    return true;
  }

  public getEvolutionRules(eventType: string, fromVersion?: number, toVersion?: number): SchemaEvolutionRule[] {
    const rules = this.evolutionRules.get(eventType) || [];
    
    if (fromVersion === undefined && toVersion === undefined) {
      return rules.filter(r => r.enabled);
    }

    return rules.filter(r => 
      r.enabled &&
      (fromVersion === undefined || r.fromVersion === fromVersion) &&
      (toVersion === undefined || r.toVersion === toVersion)
    );
  }

  // Event transformation
  public async transformEvent(
    event: BaseEvent,
    targetVersion: number,
    transformationType: 'upgrade' | 'downgrade' | 'migrate' = 'upgrade'
  ): Promise<TransformationResult> {
    const startTime = Date.now();

    try {
      const versionedEvent = event as VersionedEvent;
      const currentVersion = versionedEvent.schemaVersion || 1;
      const eventType = event?.type;

      // Check if transformation is needed
      if (currentVersion === targetVersion) {
        return {
          success: true,
          transformedEvent: versionedEvent,
          metadata: {
            fromVersion: currentVersion,
            toVersion: targetVersion,
            transformationType,
            processingTime: Date.now() - startTime
          }
        };
      }

      // Check cache first
      if (this.config.cacheTransformations) {
        const cacheKey = this.getCacheKey(eventType, currentVersion, targetVersion);
        if (this.transformationCache.has(cacheKey)) {
          const cached = this.transformationCache.get(cacheKey)!;
          this.metrics.transformations.cached++;
          return {
            ...cached,
            metadata: {
              ...cached.metadata,
              processingTime: Date.now() - startTime
            }
          };
        }
      }

      // Find transformation path
      const transformationPath = this.findTransformationPath(eventType, currentVersion, targetVersion);
      
      if (transformationPath.length === 0) {
        const error = `No transformation path found from version ${currentVersion} to ${targetVersion} for ${eventType}`;
        this.metrics.transformations.failed++;
        
        return {
          success: false,
          errors: [error],
          metadata: {
            fromVersion: currentVersion,
            toVersion: targetVersion,
            transformationType,
            processingTime: Date.now() - startTime
          }
        };
      }

      // Apply transformations sequentially
      let currentEvent = versionedEvent;
      const transformationHistory = currentEvent.transformationHistory || [];
      const errors: string[] = [];
      const warnings: string[] = [];

      for (const rule of transformationPath) {
        try {
          const transformResult = await this.applyTransformationRule(currentEvent, rule);
          
          if (!transformResult.success) {
            if (transformResult.errors) {
            errors.push(...transformResult.errors);
            }
            if (transformResult.warnings) {
            warnings.push(...transformResult.warnings);
            }
            break;
          }

          currentEvent = transformResult.transformedEvent!;
          
          // Add to transformation history
          transformationHistory.push({
            fromVersion: rule.fromVersion,
            toVersion: rule.toVersion,
            transformedAt: Date.now(),
            rule: rule.id
          });

        } catch (error) {
          errors.push(`Transformation failed with rule ${rule.id}: ${error}`);
          break;
        }
      }

      const result: TransformationResult = {
        success: errors.length === 0,
        transformedEvent: errors.length === 0 ? {
          ...currentEvent,
          schemaVersion: targetVersion,
          originalVersion: versionedEvent.originalVersion || versionedEvent.schemaVersion || 1,
          transformationHistory
        } : undefined,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
        metadata: {
          fromVersion: currentVersion,
          toVersion: targetVersion,
          transformationType,
          processingTime: Date.now() - startTime
        }
      };

      // Update metrics
      if (result.success) {
        this.metrics.transformations.successful++;
        if (transformationType === 'upgrade') {
          this.metrics.versions.upgrades++;
        } else if (transformationType === 'downgrade') {
          this.metrics.versions.downgrades++;
        } else if (transformationType === 'migrate') {
          this.metrics.versions.migrations++;
        }
      } else {
        this.metrics.transformations.failed++;
      }

      // Cache successful transformations
      if (result.success && this.config.cacheTransformations) {
        const cacheKey = this.getCacheKey(eventType, currentVersion, targetVersion);
        this.transformationCache.set(cacheKey, result);
      }

      this.emit('event_transformed', {
        eventId: event.id,
        eventType,
        fromVersion: currentVersion,
        toVersion: targetVersion,
        success: result.success,
        transformationType,
        processingTime: result.metadata?.processingTime || 0
      });

      return result;

    } catch (error) {
      this.metrics.transformations.failed++;
      
      this.emit('transformation_error', {
        eventId: event.id,
        eventType: event.type,
        targetVersion,
        error
      });

      return {
        success: false,
        errors: [`Transformation failed: ${error}`],
        metadata: {
          fromVersion: (event as VersionedEvent).schemaVersion || 1,
          toVersion: targetVersion,
          transformationType,
          processingTime: Date.now() - startTime
        }
      };
    }
  }

  // Validation
  public validateEvent(event: BaseEvent, version?: number): { valid: boolean; errors: string[]; warnings: string[] } {
    try {
      const eventType = event?.type;
      if (!eventType) {
        this.metrics.validations.failed++;
        return {
          valid: false,
          errors: ['Event type is required'],
          warnings: []
        };
      }
      
      const schemaVersion = version || (event as VersionedEvent).schemaVersion || 1;
      const schema = this.getSchema(eventType, schemaVersion);
      if (!schema) {
        if (this.metrics.validations.failed) { this.metrics.validations.failed++ };
        return {
          valid: false,
          errors: [`No schema found for ${eventType} version ${schemaVersion}`],
          warnings: []
        };
      }

      const errors: string[] = [];
      const warnings: string[] = [];

      // Validate required fields
      for (const requiredField of schema.schema.required) {
        if (!(requiredField in event.payload)) {
          errors.push(`Missing required field: ${requiredField}`);
        }
      }

      // Check for deprecated fields
      for (const deprecatedField of schema.schema.deprecated) {
        if (deprecatedField in event.payload) {
          warnings.push(`Field '${deprecatedField}' is deprecated`);
        }
      }

      // Validate field types (simplified validation)
      if (this.config.strictValidation) {
        const validationResult = this.validateFieldTypes(event.payload, schema.schema.payload);
        if (validationResult.errors) {
        errors.push(...validationResult.errors);
        }
        if (validationResult.warnings) {
        warnings.push(...validationResult.warnings);
        }
      }

      const valid = errors.length === 0;

      // Update metrics
      if (valid) {
        this.metrics.validations.passed++;
      } else {
        this.metrics.validations.failed++;
      }

      this.emit('event_validated', {
        eventId: event.id,
        eventType,
        version: schemaVersion,
        valid,
        errorCount: errors.length,
        warningCount: warnings.length
      });

      return { valid, errors, warnings };

    } catch (error) {
      this.metrics.validations.failed++;
      return {
        valid: false,
        errors: [`Validation failed: ${error}`],
        warnings: []
      };
    }
  }

  // Compatibility checking
  public checkCompatibility(eventType: string, fromVersion: number, toVersion: number): VersionCompatibility {
    const fromSchema = this.getSchema(eventType, fromVersion);
    const toSchema = this.getSchema(eventType, toVersion);

    if (!fromSchema || !toSchema) {
      return {
        eventType,
        fromVersion,
        toVersion,
        compatible: false,
        compatibilityType: 'none',
        requiresTransformation: true,
        transformationRules: []
      };
    }

    // Check if transformation rules exist
    const transformationPath = this.findTransformationPath(eventType, fromVersion, toVersion);
    const requiresTransformation = transformationPath.length > 0;

    // Determine compatibility type based on schema compatibility settings
    let compatibilityType = fromSchema.compatibility;
    if (toSchema.compatibility !== fromSchema.compatibility) {
      // Use the more restrictive compatibility
      const compatibilityOrder = { 'none': 0, 'forward': 1, 'backward': 2, 'full': 3 };
      compatibilityType = compatibilityOrder[fromSchema.compatibility] < compatibilityOrder[toSchema.compatibility] 
        ? fromSchema.compatibility 
        : toSchema.compatibility;
    }

    const compatible = this.isVersionCompatible(fromSchema, toSchema, compatibilityType);

    return {
      eventType,
      fromVersion,
      toVersion,
      compatible,
      compatibilityType,
      requiresTransformation,
      transformationRules: transformationPath.map(rule => rule.id)
    };
  }

  // Private helper methods
  private validateSchemaCompatibility(eventType: string, newSchema: EventSchema): void {
    const existingVersions = this.schemas.get(eventType);
    if (!existingVersions) return;

    for (const [version, existingSchema] of existingVersions) {
      const compatibility = this.checkCompatibility(eventType, version, newSchema.version);
      
      if (!compatibility.compatible && !compatibility.requiresTransformation) {
        throw new Error(
          `Schema ${eventType} v${newSchema.version} is incompatible with existing v${version} ` +
          `(${compatibility.compatibilityType} compatibility)`
        );
      }
    }
  }

  private validateEvolutionRule(rule: SchemaEvolutionRule): void {
    const { eventType, fromVersion, toVersion } = rule;

    // Check if schemas exist
    if (!this.getSchema(eventType, fromVersion)) {
      throw new Error(`Source schema ${eventType} v${fromVersion} not found`);
    }

    if (!this.getSchema(eventType, toVersion)) {
      throw new Error(`Target schema ${eventType} v${toVersion} not found`);
    }

    // Check rule logic
    if (fromVersion === toVersion) {
      throw new Error(`Evolution rule cannot have same source and target version: ${fromVersion}`);
    }

    // Validate transformation type
    if (rule.transformType === 'upgrade' && toVersion <= fromVersion) {
      throw new Error(`Upgrade rule must have target version > source version`);
    }

    if (rule.transformType === 'downgrade' && toVersion >= fromVersion) {
      throw new Error(`Downgrade rule must have target version < source version`);
    }
  }

  private findTransformationPath(eventType: string, fromVersion: number, toVersion: number): SchemaEvolutionRule[] {
    const rules = this.evolutionRules.get(eventType) || [];
    
    // Simple direct transformation lookup
    const directRule = rules.find(r => 
      r.enabled && 
      r.fromVersion === fromVersion && 
      r.toVersion === toVersion
    );

    if (directRule) {
      return [directRule];
    }

    // For more complex scenarios, could implement pathfinding algorithm
    // For now, return empty array if no direct transformation
    return [];
  }

  private async applyTransformationRule(event: VersionedEvent, rule: SchemaEvolutionRule): Promise<TransformationResult> {
    const startTime = Date.now();
    
    try {
      let transformedEvent = { ...event };
      const errors: string[] = [];
      const warnings: string[] = [];

      // Apply field mappings
      for (const [oldField, newField] of Object.entries(rule.transformation.fieldMappings)) {
        if (oldField in transformedEvent.payload) {
          transformedEvent.payload[newField] = transformedEvent.payload[oldField];
          delete transformedEvent.payload[oldField];
        }
      }

      // Apply default values for new fields
      for (const [field, defaultValue] of Object.entries(rule.transformation.defaultValues)) {
        if (!(field in transformedEvent.payload)) {
          transformedEvent.payload[field] = defaultValue;
        }
      }

      // Remove deprecated fields
      for (const field of rule.transformation.removedFields) {
        if (field in transformedEvent.payload) {
          delete transformedEvent.payload[field];
          warnings.push(`Removed deprecated field: ${field}`);
        }
      }

      // Apply custom transformation if provided
      if (rule.transformation.customTransform) {
        try {
          transformedEvent = this.applyCustomTransformation(transformedEvent, rule.transformation.customTransform);
        } catch (error) {
          errors.push(`Custom transformation failed: ${error}`);
        }
      }

      return {
        success: errors.length === 0,
        transformedEvent: errors.length === 0 ? transformedEvent : undefined,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
        metadata: {
          fromVersion: rule.fromVersion,
          toVersion: rule.toVersion,
          transformationType: rule.transformType,
          processingTime: Date.now() - startTime
        }
      };

    } catch (error) {
      return {
        success: false,
        errors: [`Rule application failed: ${error}`],
        metadata: {
          fromVersion: rule.fromVersion,
          toVersion: rule.toVersion,
          transformationType: rule.transformType,
          processingTime: Date.now() - startTime
        }
      };
    }
  }

  private applyCustomTransformation(event: VersionedEvent, transformation: string): VersionedEvent {
    // SECURITY WARNING: In production, use a sandboxed environment
    try {
      const func = new Function('event', `return (${transformation})(event)`);
      return func(event);
    } catch (error) {
      throw new Error(`Custom transformation execution failed: ${error}`);
    }
  }

  private validateFieldTypes(payload: Record<string, any>, schema: Record<string, any>): { errors: string[]; warnings: string[] } {
    // Simplified field type validation
    // In production, would use a proper JSON schema validator
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      // Basic validation - could be enhanced with proper schema validation
      for (const [key, expectedType] of Object.entries(schema)) {
        if (key in payload) {
          const actualValue = payload[key];
          if (actualValue === null || actualValue === undefined) {
            warnings.push(`Field '${key}' is null or undefined`);
          }
        }
      }
    } catch (error) {
      errors.push(`Field validation failed: ${error}`);
    }
    
    return { errors, warnings };
  }

  private isVersionCompatible(fromSchema: EventSchema, toSchema: EventSchema, compatibilityType: string): boolean {
    // Simplified compatibility check
    switch (compatibilityType) {
      case 'full':
        return true;
      case 'forward':
        return toSchema.version >= fromSchema.version;
      case 'backward':
        return fromSchema.version >= toSchema.version;
      case 'none':
        return fromSchema.version === toSchema.version;
      default:
        return false;
    }
  }

  private getCacheKey(eventType: string, fromVersion: number, toVersion: number): string {
    return `${eventType}:${fromVersion}->${toVersion}`;
  }

  private clearCacheForEventType(eventType: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.transformationCache.keys()) {
      if (key.startsWith(`${eventType}:`)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.transformationCache.delete(key));
  }

  // Public API methods
  public getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.transformationCache.size,
      schemaCount: Array.from(this.schemas.values()).reduce((sum: number, versions: Map<number, EventSchema>) => sum + versions.size, 0),
      ruleCount: Array.from(this.evolutionRules.values()).reduce((sum: number, rules: SchemaEvolutionRule[]) => sum + (rules?.length || 0), 0)
    };
  }

  public clearCache(): void {
    this.transformationCache.clear();
    this.emit('cache_cleared');
  }

  public getVersionSummary(eventType: string): {
    eventType: string;
    versions: number[];
    latestVersion: number;
    totalRules: number;
    compatibility: string;
  } | null {
    const eventVersions = this.schemas.get(eventType);
    if (!eventVersions || eventVersions.size === 0) return null;

    const versions = Array.from(eventVersions.keys()).sort((a, b) => a - b);
    const latestVersion = Math.max(...versions);
    const latestSchema = eventVersions.get(latestVersion)!;
    const rules = this.evolutionRules.get(eventType) || [];

    return {
      eventType,
      versions,
      latestVersion,
      totalRules: rules.length,
      compatibility: latestSchema.compatibility
    };
  }
}