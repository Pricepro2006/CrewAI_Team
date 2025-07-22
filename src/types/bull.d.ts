declare module "bull" {
  import { EventEmitter } from "events";

  export interface JobOptions {
    priority?: number;
    delay?: number;
    attempts?: number;
    backoff?: {
      type: string;
      delay: number;
    };
    removeOnComplete?: boolean | { age?: number; count?: number };
    removeOnFail?: boolean | { age?: number };
    timeout?: number;
  }

  export interface Job<T = any> {
    id: string | number;
    data: T;
    opts: JobOptions;
    timestamp: number;
    attemptsMade: number;
    progress(progress: number): Promise<void>;
  }

  export interface QueueOptions {
    redis?: any;
    defaultJobOptions?: JobOptions;
  }

  export default class Queue<T = any> extends EventEmitter {
    constructor(name: string, options?: QueueOptions);

    add(data: T, opts?: JobOptions): Promise<Job<T>>;
    add(name: string, data: T, opts?: JobOptions): Promise<Job<T>>;

    process(processor: (job: Job<T>) => Promise<any>): void;
    process(
      concurrency: number,
      processor: (job: Job<T>) => Promise<any>,
    ): void;

    on(event: "completed", listener: (job: Job<T>, result: any) => void): this;
    on(event: "failed", listener: (job: Job<T>, err: Error) => void): this;
    on(event: "stalled", listener: (job: Job<T>) => void): this;

    getWaitingCount(): Promise<number>;
    getActiveCount(): Promise<number>;
    getCompletedCount(): Promise<number>;
    getFailedCount(): Promise<number>;
    getDelayedCount(): Promise<number>;

    isPaused(): Promise<boolean>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    close(): Promise<void>;
  }
}
