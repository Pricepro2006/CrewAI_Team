# tRPC Knowledge Base

## Overview

tRPC (TypeScript Remote Procedure Call) is a library that enables you to build end-to-end typesafe APIs without schemas or code generation. It's designed specifically for full-stack TypeScript applications.

## Key Features

- ✅ **Full static typesafety** - Complete autocompletion on the client for inputs, outputs, and errors
- 🐎 **Snappy DX** - No code generation, runtime bloat, or build pipeline
- 🍃 **Light** - Zero dependencies and tiny client-side footprint  
- 🐻 **Easy adoption** - Works with new and existing projects
- 🔋 **Framework agnostic** - Community adapters for all popular frameworks
- 🥃 **Subscriptions support** - Add typesafe observability
- ⚡️ **Request batching** - Automatically combine requests
- 👀 **Well-tested** - Production ready

## Core Concepts

### 1. Type Safety Without Code Generation
Unlike GraphQL, tRPC leverages TypeScript's type system to directly share types between client and server without additional code generation steps.

### 2. Procedures
tRPC uses procedures (similar to REST endpoints or GraphQL resolvers):
- **Query procedures** - For fetching data
- **Mutation procedures** - For modifying data
- **Subscription procedures** - For real-time updates

### 3. Routers
Routers group related procedures together and can be nested for organization.

## Quick Start Guide

### Installation

```bash
npm install @trpc/server @trpc/client
```

Requirements:
- TypeScript >= 5.7.2
- `"strict": true` in tsconfig.json (recommended)

### Backend Setup

1. **Initialize tRPC**
```typescript
// server/trpc.ts
import { initTRPC } from '@trpc/server';

const t = initTRPC.create();

export const router = t.router;
export const publicProcedure = t.procedure;
```

2. **Create Router with Procedures**
```typescript
// server/index.ts
import { z } from 'zod';
import { router, publicProcedure } from './trpc';

const appRouter = router({
  // Query procedure
  userList: publicProcedure
    .query(async () => {
      return await db.user.findMany();
    }),
    
  // Query with input validation
  userById: publicProcedure
    .input(z.string())
    .query(async (opts) => {
      const { input } = opts;
      return await db.user.findById(input);
    }),
    
  // Mutation procedure
  userCreate: publicProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async (opts) => {
      const { input } = opts;
      return await db.user.create(input);
    }),
});

export type AppRouter = typeof appRouter;
```

3. **Serve the API**
```typescript
import { createHTTPServer } from '@trpc/server/adapters/standalone';

const server = createHTTPServer({
  router: appRouter,
});

server.listen(3000);
```

### Client Setup

```typescript
// client/index.ts
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from './server';

const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000',
    }),
  ],
});

// Type-safe API calls
const user = await trpc.userById.query('1');
const createdUser = await trpc.userCreate.mutate({ name: 'John' });
const users = await trpc.userList.query();
```

## Advanced Features

### Input Validation
tRPC supports various validation libraries:
- Zod (recommended)
- Yup
- Superstruct
- Custom validators

### Middlewares
Add authentication, logging, or other cross-cutting concerns:
```typescript
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      user: ctx.user,
    },
  });
});

const protectedProcedure = t.procedure.use(isAuthed);
```

### Error Handling
Built-in error handling with typed errors:
```typescript
import { TRPCError } from '@trpc/server';

throw new TRPCError({
  code: 'NOT_FOUND',
  message: 'User not found',
});
```

### Data Transformers
Support for complex types like Date:
```typescript
import superjson from 'superjson';

const t = initTRPC.create({
  transformer: superjson,
});
```

### Subscriptions
Real-time updates using WebSockets:
```typescript
subscription: publicProcedure
  .subscription(async function* (opts) {
    for await (const event of eventEmitter) {
      yield event;
    }
  }),
```

## Best Practices

1. **Use strict TypeScript** - Enable strict mode in tsconfig.json
2. **Organize with routers** - Group related procedures
3. **Validate inputs** - Always validate procedure inputs
4. **Handle errors properly** - Use TRPCError for consistent error handling
5. **Use data transformers** - For Date and other complex types
6. **Batch requests** - Use httpBatchLink for performance
7. **Type-only imports** - Import types separately to avoid circular dependencies

## Common Patterns

### Authentication
```typescript
const t = initTRPC.context<Context>().create();

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.session.user,
    },
  });
});

export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthed);
```

### File Uploads
Use FormData with non-JSON content types:
```typescript
fileUpload: publicProcedure
  .input(z.instanceof(FormData))
  .mutation(async ({ input }) => {
    const file = input.get('file') as File;
    // Process file
  }),
```

### Pagination
```typescript
posts: publicProcedure
  .input(
    z.object({
      limit: z.number().min(1).max(100).default(10),
      cursor: z.number().optional(),
    })
  )
  .query(async ({ input }) => {
    const { limit, cursor } = input;
    // Implement pagination logic
  }),
```

## Framework Adapters

tRPC supports many backend frameworks:
- Express
- Fastify
- Next.js
- AWS Lambda
- Cloudflare Workers
- Standalone HTTP server
- And more...

## Comparison with Alternatives

### vs GraphQL
- No schema definition language needed
- No code generation required
- Simpler setup and learning curve
- TypeScript-first design
- Less flexible for non-TypeScript clients

### vs REST
- End-to-end type safety
- No manual API contract maintenance
- Automatic client generation
- Request batching out of the box
- Less standard/universal than REST

## Migration Guide

### From v10 to v11
Key changes in v11:
- Updated TypeScript requirement (>= 5.7.2)
- Improved type inference
- Better error messages
- Performance improvements

## Resources

- [Official Documentation](https://trpc.io/docs)
- [GitHub Repository](https://github.com/trpc/trpc)
- [Discord Community](https://trpc.io/discord)
- [Example Applications](https://trpc.io/docs/example-apps)
- [Awesome tRPC Collection](https://trpc.io/docs/community/awesome-trpc)

## Summary

tRPC is the ideal choice for full-stack TypeScript applications where you want:
- Complete type safety without code generation
- Rapid development with excellent DX
- Minimal boilerplate
- Framework flexibility
- Production-ready performance

It excels in monorepo setups and projects where both frontend and backend use TypeScript.