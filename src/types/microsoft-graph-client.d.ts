// Type definitions for @microsoft/microsoft-graph-client
// Stub file to resolve TypeScript errors until package can be installed

declare module "@microsoft/microsoft-graph-client" {
  export interface ClientOptions {
    authProvider: any;
    defaultVersion?: string;
  }

  export class Client {
    static initWithMiddleware(options: ClientOptions): Client;
    api(path: string): {
      get(): Promise<any>;
      post(body: any): Promise<any>;
      patch(body: any): Promise<any>;
      delete(): Promise<any>;
    };
  }
}

declare module "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials" {
  export class TokenCredentialAuthenticationProvider {
    constructor(credential: any, options: { scopes: string[] });
  }
}
