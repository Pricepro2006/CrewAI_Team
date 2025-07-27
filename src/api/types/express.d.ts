/**
 * Re-export Express types to fix TypeScript portability issues with pnpm
 */

export type {
  Request,
  Response,
  NextFunction,
  RequestHandler,
  ErrorRequestHandler,
  Express,
  Router,
  IRouter,
  RouterOptions,
  Application,
} from "express";

export type { ParamsDictionary, Query } from "express-serve-static-core";

export type { ParsedQs } from "qs";
