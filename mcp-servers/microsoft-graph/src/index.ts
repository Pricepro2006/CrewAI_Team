#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import 'isomorphic-fetch';

// Initialize Microsoft Graph client
const credential = new ClientSecretCredential(
  process.env.MSGRAPH_TENANT_ID!,
  process.env.MSGRAPH_CLIENT_ID!,
  process.env.MSGRAPH_CLIENT_SECRET!
);

const graphClient = Client.initWithMiddleware({
  authProvider: {
    getAccessToken: async () => {
      const tokenResponse = await credential.getToken('https://graph.microsoft.com/.default');
      return tokenResponse.token;
    }
  }
});

// MCP Server setup
const server = new Server(
  {
    name: 'microsoft-graph',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Email interface
interface Email {
  id: string;
  subject: string;
  bodyPreview: string;
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  receivedDateTime: string;
  isRead: boolean;
  categories: string[];
}

// Subscription interface
interface Subscription {
  id: string;
  resource: string;
  changeType: string;
  notificationUrl: string;
  expirationDateTime: string;
  clientState: string;
}

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_emails',
        description: 'Get emails from a mailbox with optional filters',
        inputSchema: {
          type: 'object',
          properties: {
            mailbox: {
              type: 'string',
              description: 'Email address of the mailbox to query',
            },
            folder: {
              type: 'string',
              description: 'Folder name (default: inbox)',
              default: 'inbox',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of emails to retrieve',
              default: 10,
            },
            filter: {
              type: 'string',
              description: 'OData filter query (e.g., "isRead eq false")',
            },
          },
          required: ['mailbox'],
        },
      },
      {
        name: 'get_email_by_id',
        description: 'Get a specific email by its ID',
        inputSchema: {
          type: 'object',
          properties: {
            mailbox: {
              type: 'string',
              description: 'Email address of the mailbox',
            },
            emailId: {
              type: 'string',
              description: 'ID of the email to retrieve',
            },
          },
          required: ['mailbox', 'emailId'],
        },
      },
      {
        name: 'mark_email_read',
        description: 'Mark an email as read',
        inputSchema: {
          type: 'object',
          properties: {
            mailbox: {
              type: 'string',
              description: 'Email address of the mailbox',
            },
            emailId: {
              type: 'string',
              description: 'ID of the email to mark as read',
            },
          },
          required: ['mailbox', 'emailId'],
        },
      },
      {
        name: 'create_subscription',
        description: 'Create a subscription for email notifications',
        inputSchema: {
          type: 'object',
          properties: {
            mailbox: {
              type: 'string',
              description: 'Email address to monitor',
            },
            notificationUrl: {
              type: 'string',
              description: 'Webhook URL for notifications',
            },
            clientState: {
              type: 'string',
              description: 'Secret client state for validation',
            },
          },
          required: ['mailbox', 'notificationUrl', 'clientState'],
        },
      },
      {
        name: 'delete_subscription',
        description: 'Delete an email subscription',
        inputSchema: {
          type: 'object',
          properties: {
            subscriptionId: {
              type: 'string',
              description: 'ID of the subscription to delete',
            },
          },
          required: ['subscriptionId'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'get_emails': {
        const { mailbox, folder = 'inbox', limit = 10, filter } = args as {
          mailbox: string;
          folder?: string;
          limit?: number;
          filter?: string;
        };
        
        let query = graphClient
          .api(`/users/${mailbox}/mailFolders/${folder}/messages`)
          .select('id,subject,bodyPreview,from,receivedDateTime,isRead,categories')
          .top(limit)
          .orderby('receivedDateTime desc');
        
        if (filter) {
          query = query.filter(filter);
        }
        
        const result = await query.get();
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.value, null, 2),
            },
          ],
        };
      }

      case 'get_email_by_id': {
        const { mailbox, emailId } = args as {
          mailbox: string;
          emailId: string;
        };
        
        const email = await graphClient
          .api(`/users/${mailbox}/messages/${emailId}`)
          .select('id,subject,body,from,to,cc,receivedDateTime,isRead,categories,importance')
          .get();
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(email, null, 2),
            },
          ],
        };
      }

      case 'mark_email_read': {
        const { mailbox, emailId } = args as {
          mailbox: string;
          emailId: string;
        };
        
        await graphClient
          .api(`/users/${mailbox}/messages/${emailId}`)
          .patch({ isRead: true });
        
        return {
          content: [
            {
              type: 'text',
              text: `Email ${emailId} marked as read`,
            },
          ],
        };
      }

      case 'create_subscription': {
        const { mailbox, notificationUrl, clientState } = args as {
          mailbox: string;
          notificationUrl: string;
          clientState: string;
        };
        
        const subscription = await graphClient
          .api('/subscriptions')
          .post({
            changeType: 'created,updated',
            notificationUrl: notificationUrl,
            resource: `/users/${mailbox}/mailFolders/inbox/messages`,
            expirationDateTime: new Date(Date.now() + 3600 * 1000).toISOString(),
            clientState: clientState,
          });
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(subscription, null, 2),
            },
          ],
        };
      }

      case 'delete_subscription': {
        const { subscriptionId } = args as {
          subscriptionId: string;
        };
        
        await graphClient
          .api(`/subscriptions/${subscriptionId}`)
          .delete();
        
        return {
          content: [
            {
              type: 'text',
              text: `Subscription ${subscriptionId} deleted successfully`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Microsoft Graph MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});