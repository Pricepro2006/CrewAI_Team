/// <reference types="node" />
/// <reference types="vitest/globals" />
/// <reference path="./environment.d.ts" />
/// <reference path="./modules.d.ts" />
/// <reference path="./bull.d.ts" />
/// <reference path="./cron.d.ts" />
/// <reference path="./glob.d.ts" />
/// <reference path="./ms.d.ts" />
/// <reference path="./socket.io.d.ts" />
/// <reference path="./socket.io-mock.d.ts" />
/// <reference path="./supertest.d.ts" />
/// <reference path="./microsoft-graph.d.ts" />
/// <reference path="./microsoft-graph-client.d.ts" />
/// <reference path="./websocket-globals.d.ts" />

// Re-export all type modules
export * from './AnalysisTypes';
export * from './ChainTypes';
export * from './EmailTypes';
export * from './analysis-results';
export * from './business-analysis.types';
export * from './common.types';
export * from './email-dashboard.interfaces';
export * from './email-pipeline-health.types';
export * from './email-storage.types';
export * from './email';
export * from './iems-email.types';
export * from './pipeline-analysis';
export * from './price-alerts';
export * from './unified-email.types';
export * from './walmart-grocery';
export * from './walmart-search-extended';
export * from './walmart-ui-extensions';
export * from './walmart-websocket-events';
export * from './database/email.entity';
export * from './ui/walmart-ui-types';

// Global type augmentations
declare global {
  // Extend Window interface for browser globals
  interface Window {
    __REDUX_DEVTOOLS_EXTENSION__?: any;
    __REDUX_DEVTOOLS_EXTENSION_COMPOSE__?: any;
  }

  // Extend NodeJS global
  namespace NodeJS {
    interface Global {
      __rootdir__: string;
    }
  }

  // Common utility types
  type Nullable<T> = T | null;
  type Optional<T> = T | undefined;
  type Maybe<T> = T | null | undefined;
  
  // Deep partial type
  type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
  };
  
  // Deep readonly type
  type DeepReadonly<T> = {
    readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
  };
  
  // Extract promise type
  type Awaited<T> = T extends Promise<infer U> ? U : T;
  
  // Constructor type
  type Constructor<T = {}> = new (...args: any[]) => T;
  
  // Function types
  type AnyFunction = (...args: any[]) => any;
  type AsyncFunction<T = any> = (...args: any[]) => Promise<T>;
  
  // Record types
  type StringRecord<T = any> = Record<string, T>;
  type NumberRecord<T = any> = Record<number, T>;
}

export {};