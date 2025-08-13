// Socket.IO Type Declarations
// This file provides type definitions for socket.io until proper installation

declare module "socket.io" {
  import { Server as HTTPServer } from "http";
  import { EventEmitter } from "events";

  export interface ServerOptions {
    path?: string;
    serveClient?: boolean;
    adapter?: any;
    parser?: any;
    connectTimeout?: number;
    transports?: string[];
    allowUpgrades?: boolean;
    perMessageDeflate?: any;
    httpCompression?: any;
    cors?: {
      origin?: string | string[] | boolean;
      methods?: string[];
      allowedHeaders?: string[];
      exposedHeaders?: string[];
      credentials?: boolean;
      maxAge?: number;
    };
    cookie?: any;
    wsEngine?: string;
    pingTimeout?: number;
    pingInterval?: number;
    upgradeTimeout?: number;
    maxHttpBufferSize?: number;
    allowRequest?: (
      req: any,
      fn: (err: string | null | undefined, success: boolean) => void,
    ) => void;
    initialPacket?: any;
    allowEIO3?: boolean;
  }

  export interface Handshake {
    headers: any;
    time: string;
    address: string;
    xdomain: boolean;
    secure: boolean;
    issued: number;
    url: string;
    query: any;
    auth: any;
  }

  export interface Socket extends EventEmitter {
    id: string;
    handshake: Handshake;
    rooms: Set<string>;
    data: any;
    connected: boolean;
    disconnected: boolean;

    emit(event: string, ...args: any[]): boolean;
    on(event: string, listener: (...args: any[]) => void): this;
    once(event: string, listener: (...args: any[]) => void): this;
    removeListener(event: string, listener: (...args: any[]) => void): this;
    removeAllListeners(event?: string): this;
    join(room: string | string[]): void;
    leave(room: string): void;
    to(room: string): BroadcastOperator;
    in(room: string): BroadcastOperator;
    except(rooms: string | string[]): BroadcastOperator;
    disconnect(close?: boolean): this;
    send(...args: any[]): this;
    compress(compress: boolean): this;
    volatile: this;
    broadcast: BroadcastOperator;
    local: BroadcastOperator;
    timeout(value: number): this;
  }

  export interface BroadcastOperator {
    emit(event: string, ...args: any[]): boolean;
    to(room: string): BroadcastOperator;
    in(room: string): BroadcastOperator;
    except(rooms: string | string[]): BroadcastOperator;
    compress(compress: boolean): BroadcastOperator;
    volatile: BroadcastOperator;
    local: BroadcastOperator;
    timeout(value: number): BroadcastOperator;
  }

  export interface Namespace extends EventEmitter {
    name: string;
    connected: Map<string, Socket>;
    adapter: any;

    use(fn: (socket: Socket, next: (err?: Error) => void) => void): this;
    to(room: string): BroadcastOperator;
    in(room: string): BroadcastOperator;
    except(rooms: string | string[]): BroadcastOperator;
    emit(event: string, ...args: any[]): boolean;
    send(...args: any[]): this;
    write(...args: any[]): this;
    local: BroadcastOperator;
    compress(compress: boolean): BroadcastOperator;
    volatile: BroadcastOperator;
    timeout(value: number): BroadcastOperator;
    disconnectSockets(close?: boolean): void;
    fetchSockets(): Promise<Socket[]>;
  }

  export class Server extends EventEmitter {
    constructor(srv?: HTTPServer | number, opts?: ServerOptions);
    constructor(opts?: ServerOptions);

    engine: any;
    nsps: Map<string, Namespace>;
    sockets: Namespace;
    opts: ServerOptions;

    serveClient(v?: boolean): this;
    path(v?: string): this;
    adapter(v: any): this;
    origins(v: string | string[]): this;
    attach(srv: HTTPServer, opts?: ServerOptions): this;
    listen(srv: HTTPServer, opts?: ServerOptions): this;
    bind(srv: HTTPServer): this;
    of(nsp: string): Namespace;
    close(fn?: () => void): void;
    use(fn: (socket: Socket, next: (err?: Error) => void) => void): this;
    emit(event: string, ...args: any[]): boolean;
    to(room: string): BroadcastOperator;
    in(room: string): BroadcastOperator;
    except(rooms: string | string[]): BroadcastOperator;
    send(...args: any[]): this;
    write(...args: any[]): this;
    compress(compress: boolean): BroadcastOperator;
    volatile: BroadcastOperator;
    local: BroadcastOperator;
    timeout(value: number): BroadcastOperator;
    disconnectSockets(close?: boolean): void;
    fetchSockets(): Promise<Socket[]>;
  }

  export { Server as default };
}
