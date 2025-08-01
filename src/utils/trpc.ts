import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../api/trpc/router.js';

export const trpc = createTRPCReact<AppRouter>();