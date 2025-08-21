// Mock types for socket.io to resolve TypeScript errors
// CONFLICT: socket.io module is also declared in socket.io.d.ts with more complete definitions
// This file should be renamed to avoid conflicts

declare module 'socket.io-mock-alternative' {
  import { EventEmitter } from 'events';
  import { Server as HTTPServer } from 'http';
  
  export interface ServerOptions {
    path?: string;
    cors?: {
      origin: string | string[];
      credentials: boolean;
    };
    transports?: string[];
  }
  
  export interface Socket extends EventEmitter {
    id: string;
    handshake: {
      auth: {
        token?: string;
      };
    };
    rooms: Set<string>;
    join(room: string): void;
    leave(room: string): void;
    emit(event: string, ...args: any[]): boolean;
    on(event: string, listener: (...args: any[]) => void): this;
    disconnect(close?: boolean): void;
  }
  
  export interface Namespace {
    emit(event: string, ...args: any[]): boolean;
    to(room: string): Namespace;
  }
  
  export class Server extends EventEmitter {
    constructor(httpServer: HTTPServer, options?: ServerOptions);
    
    on(event: 'connection', listener: (socket: Socket) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
    
    use(fn: (socket: Socket, next: (err?: Error) => void) => void): void;
    
    to(room: string): Namespace;
    emit(event: string, ...args: any[]): boolean;
    
    close(callback?: () => void): void;
    disconnectSockets(close?: boolean): void;
    
    engine: {
      clientsCount: number;
    };
    
    sockets: {
      adapter: {
        rooms: Map<string, Set<string>>;
      };
    };
  }
  
  export default Server;
}