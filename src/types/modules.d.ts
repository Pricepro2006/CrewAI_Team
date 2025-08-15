/// <reference types="node" />
/// <reference types="vite/client" />

// Module declarations for packages without TypeScript definitions
declare module 'socket.io-mock' {
  export default class SocketMock {
    constructor();
    on(event: string, callback: (...args: any[]) => void): void;
    emit(event: string, ...args: any[]): void;
    disconnect(): void;
    connected: boolean;
  }
}

declare module 'ms' {
  function ms(value: string): number;
  function ms(value: number, options?: { long?: boolean }): string;
  export = ms;
}

declare module 'glob' {
  export interface GlobOptions {
    cwd?: string;
    root?: string;
    dot?: boolean;
    nomount?: boolean;
    mark?: boolean;
    nosort?: boolean;
    stat?: boolean;
    silent?: boolean;
    strict?: boolean;
    cache?: Record<string, any>;
    statCache?: Record<string, any>;
    symlinks?: Record<string, any>;
    nounique?: boolean;
    nonull?: boolean;
    debug?: boolean;
    nobrace?: boolean;
    noglobstar?: boolean;
    noext?: boolean;
    nocase?: boolean;
    matchBase?: boolean;
    nodir?: boolean;
    ignore?: string | string[];
    follow?: boolean;
    realpath?: boolean;
    nonegate?: boolean;
    nocomment?: boolean;
    absolute?: boolean;
  }

  export function glob(
    pattern: string,
    options: GlobOptions,
    callback: (err: Error | null, matches: string[]) => void
  ): void;
  
  export function glob(
    pattern: string,
    callback: (err: Error | null, matches: string[]) => void
  ): void;
  
  export function globSync(pattern: string, options?: GlobOptions): string[];
  
  export class Glob {
    constructor(pattern: string, options?: GlobOptions, callback?: (err: Error | null, matches: string[]) => void);
  }
}

declare module 'cron' {
  export class CronJob {
    constructor(
      cronTime: string | Date,
      onTick: () => void,
      onComplete?: () => void | null,
      start?: boolean,
      timezone?: string,
      context?: any,
      runOnInit?: boolean,
      utcOffset?: number
    );
    start(): void;
    stop(): void;
    setTime(time: Date | string): void;
    lastDate(): Date;
    nextDates(count?: number): Date[];
    fireOnTick(): void;
    addCallback(callback: () => void): void;
  }
  
  export class CronTime {
    constructor(time: string | Date, timezone?: string);
  }
}

declare module 'supertest' {
  import { Server } from 'http';
  import { Application } from 'express';
  
  export interface Test {
    expect(status: number): Test;
    expect(checker: (res: Response) => void): Test;
    expect(field: string, value: any): Test;
    send(data: any): Test;
    set(field: string, value: string): Test;
    set(fields: Record<string, string>): Test;
    query(query: Record<string, any>): Test;
    field(name: string, value: any): Test;
    attach(field: string, file: string | Buffer, filename?: string): Test;
    redirects(n: number): Test;
    timeout(ms: number | { response?: number; deadline?: number }): Test;
    end(callback?: (err: any, res: Response) => void): Test;
    then(onFulfilled?: (res: Response) => void, onRejected?: (err: any) => void): Promise<Response>;
    catch(onRejected?: (err: any) => void): Promise<Response>;
  }
  
  export interface Response {
    status: number;
    statusCode: number;
    text: string;
    body: any;
    headers: Record<string, string>;
    type: string;
    charset: string;
    error: Error | false;
  }
  
  export interface SuperTest<T> {
    get(url: string): Test;
    post(url: string): Test;
    put(url: string): Test;
    patch(url: string): Test;
    delete(url: string): Test;
    del(url: string): Test;
    head(url: string): Test;
    options(url: string): Test;
  }
  
  function supertest(app: Application | Server | string): SuperTest<any>;
  
  export = supertest;
}

// Vite client types extension
declare module 'vite/client' {
  interface ImportMetaEnv {
    readonly VITE_API_URL: string;
    readonly VITE_WEBSOCKET_URL: string;
    readonly VITE_PORT: string;
    readonly VITE_USE_POLLING: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

// Allow importing JSON files
declare module '*.json' {
  const value: any;
  export default value;
}

// Allow importing CSS modules
declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.module.scss' {
  const classes: { [key: string]: string };
  export default classes;
}

// Allow importing static assets
declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.gif' {
  const content: string;
  export default content;
}

declare module '*.webp' {
  const content: string;
  export default content;
}

// Microsoft Graph types (if @types/microsoft-graph is not installed)
declare module '@microsoft/microsoft-graph-client' {
  export class Client {
    static init(options: any): Client;
    api(path: string): any;
  }
  
  export class ClientOptions {
    authProvider?: any;
  }
}

// Bull queue types extension
declare module 'bull' {
  export interface JobOptions {
    priority?: number;
    delay?: number;
    attempts?: number;
    backoff?: {
      type: 'fixed' | 'exponential';
      delay: number;
    };
    removeOnComplete?: boolean | number;
    removeOnFail?: boolean | number;
    stackTraceLimit?: number;
  }
  
  export interface Queue<T = any> {
    add(name: string, data: T, opts?: JobOptions): Promise<Job<T>>;
    add(data: T, opts?: JobOptions): Promise<Job<T>>;
    process(concurrency: number, processor: (job: Job<T>) => Promise<any>): void;
    process(processor: (job: Job<T>) => Promise<any>): void;
    process(name: string, concurrency: number, processor: (job: Job<T>) => Promise<any>): void;
    process(name: string, processor: (job: Job<T>) => Promise<any>): void;
    on(event: string, callback: (...args: any[]) => void): void;
    close(): Promise<void>;
    clean(grace: number, type?: string, limit?: number): Promise<Job<T>[]>;
    empty(): Promise<void>;
    pause(isLocal?: boolean): Promise<void>;
    resume(isLocal?: boolean): Promise<void>;
    isPaused(isLocal?: boolean): Promise<boolean>;
    getJob(jobId: string): Promise<Job<T> | null>;
    getJobs(types: string[], start?: number, end?: number, asc?: boolean): Promise<Job<T>[]>;
    getJobCounts(): Promise<Record<string, number>>;
  }
  
  export interface Job<T = any> {
    id: string;
    name: string;
    data: T;
    opts: JobOptions;
    timestamp: number;
    attemptsMade: number;
    processedOn?: number;
    finishedOn?: number;
    progress(value: number | object): Promise<void>;
    log(row: string): Promise<void>;
    update(data: T): Promise<void>;
    remove(): Promise<void>;
    retry(): Promise<void>;
    discard(): Promise<void>;
    promote(): Promise<void>;
    finished(): Promise<any>;
    moveToCompleted(returnValue: any, ignoreLock?: boolean): Promise<[any, string]>;
    moveToFailed(err: Error, ignoreLock?: boolean): Promise<[any, string]>;
  }
}

export {};