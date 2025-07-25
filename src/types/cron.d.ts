// Type definitions for cron
// Stub file to resolve TypeScript errors until package can be installed

declare module "cron" {
  export class CronJob {
    constructor(
      cronTime: string | Date,
      onTick: () => void | Promise<void>,
      onComplete?: () => void,
      start?: boolean,
      timezone?: string,
      context?: any,
      runOnInit?: boolean,
    );
    start(): void;
    stop(): void;
  }
}
