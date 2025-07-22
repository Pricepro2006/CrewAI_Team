declare module "@microsoft/microsoft-graph-client" {
  export class Client {
    static init(config: any): Client;
    api(path: string): any;
  }
}

declare module "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials" {
  export class TokenCredentialAuthenticationProvider {
    constructor(credentials: any, options: any);
  }
}

declare module "@azure/identity" {
  export class ClientSecretCredential {
    constructor(tenantId: string, clientId: string, clientSecret: string);
  }
}

declare module "cron" {
  export class CronJob {
    constructor(
      pattern: string,
      callback: () => void,
      onComplete?: null,
      start?: boolean,
      timezone?: string,
    );
    start(): void;
    stop(): void;
  }
}
