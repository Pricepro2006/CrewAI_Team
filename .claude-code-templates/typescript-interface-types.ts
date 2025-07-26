/**
 * {{InterfaceName}} - {{InterfaceDescription}}
 * 
 * @module {{ModuleName}}
 */

// Base types
export type ID = string;
export type Timestamp = string; // ISO 8601
export type UUID = string;

// Utility types
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type AsyncResult<T> = Promise<T>;
export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

// Status enums
export enum {{EntityName}}Status {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED',
}

// Main interfaces
export interface {{InterfaceName}}Base {
  id: ID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
}

export interface {{InterfaceName}} extends {{InterfaceName}}Base {
  // Core properties
  name: string;
  description?: string;
  status: {{EntityName}}Status;
  
  // Relationships
  userId: ID;
  organizationId?: ID;
  
  // Data properties
  metadata: {{InterfaceName}}Metadata;
  settings: {{InterfaceName}}Settings;
  
  // Computed properties (readonly)
  readonly isActive: boolean;
  readonly displayName: string;
}

export interface {{InterfaceName}}Metadata {
  tags: string[];
  categories: string[];
  customFields: Record<string, unknown>;
}

export interface {{InterfaceName}}Settings {
  isPublic: boolean;
  allowComments: boolean;
  requiresApproval: boolean;
  notifications: NotificationSettings;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  inApp: boolean;
  frequency: 'immediate' | 'daily' | 'weekly' | 'never';
}

// Input types (for create/update operations)
export interface Create{{InterfaceName}}Input {
  name: string;
  description?: string;
  metadata?: Partial<{{InterfaceName}}Metadata>;
  settings?: Partial<{{InterfaceName}}Settings>;
}

export interface Update{{InterfaceName}}Input extends Partial<Create{{InterfaceName}}Input> {
  status?: {{EntityName}}Status;
}

// Query types
export interface {{InterfaceName}}Filter {
  status?: {{EntityName}}Status | {{EntityName}}Status[];
  userId?: ID;
  organizationId?: ID;
  tags?: string[];
  createdAfter?: Timestamp;
  createdBefore?: Timestamp;
  searchTerm?: string;
}

export interface {{InterfaceName}}Sort {
  field: keyof {{InterfaceName}};
  direction: 'asc' | 'desc';
}

export interface {{InterfaceName}}Pagination {
  page: number;
  limit: number;
  offset?: number;
}

export interface {{InterfaceName}}QueryOptions {
  filter?: {{InterfaceName}}Filter;
  sort?: {{InterfaceName}}Sort | {{InterfaceName}}Sort[];
  pagination?: {{InterfaceName}}Pagination;
  include?: {{InterfaceName}}Include[];
}

export type {{InterfaceName}}Include = 'user' | 'organization' | 'related';

// Response types
export interface {{InterfaceName}}Response {
  data: {{InterfaceName}};
  meta?: ResponseMeta;
}

export interface {{InterfaceName}}ListResponse {
  data: {{InterfaceName}}[];
  meta: ListResponseMeta;
}

export interface ResponseMeta {
  version: string;
  timestamp: Timestamp;
  requestId: string;
}

export interface ListResponseMeta extends ResponseMeta {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Event types
export interface {{InterfaceName}}Event {
  type: {{InterfaceName}}EventType;
  timestamp: Timestamp;
  data: {{InterfaceName}};
  metadata: {
    userId?: ID;
    source: string;
    version: string;
  };
}

export enum {{InterfaceName}}EventType {
  CREATED = '{{INTERFACE_NAME}}_CREATED',
  UPDATED = '{{INTERFACE_NAME}}_UPDATED',
  DELETED = '{{INTERFACE_NAME}}_DELETED',
  STATUS_CHANGED = '{{INTERFACE_NAME}}_STATUS_CHANGED',
}

// Type guards
export function is{{InterfaceName}}(obj: unknown): obj is {{InterfaceName}} {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj &&
    'status' in obj
  );
}

export function is{{InterfaceName}}Array(obj: unknown): obj is {{InterfaceName}}[] {
  return Array.isArray(obj) && obj.every(is{{InterfaceName}});
}

// Utility functions
export function create{{InterfaceName}}(input: Create{{InterfaceName}}Input): {{InterfaceName}} {
  const now = new Date().toISOString();
  
  return {
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    version: 1,
    name: input.name,
    description: input.description,
    status: {{EntityName}}Status.PENDING,
    userId: getCurrentUserId(),
    metadata: {
      tags: [],
      categories: [],
      customFields: {},
      ...input.metadata,
    },
    settings: {
      isPublic: false,
      allowComments: true,
      requiresApproval: false,
      notifications: {
        email: true,
        push: true,
        inApp: true,
        frequency: 'immediate',
      },
      ...input.settings,
    },
    get isActive() {
      return this.status === {{EntityName}}Status.ACTIVE;
    },
    get displayName() {
      return this.name || 'Unnamed {{InterfaceName}}';
    },
  };
}

// Mock helper functions (replace with actual implementations)
function generateId(): ID {
  return Math.random().toString(36).substring(2);
}

function getCurrentUserId(): ID {
  return 'current-user-id';
}