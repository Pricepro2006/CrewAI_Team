// Microsoft Graph Client types are declared in microsoft-graph-client.d.ts
// This file focuses on Azure Identity types

declare module "@azure/identity" {
  export class ClientSecretCredential {
    constructor(tenantId: string, clientId: string, clientSecret: string);
  }
}


