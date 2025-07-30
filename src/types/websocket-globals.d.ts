// WebSocket type definitions for test environments
declare global {
  interface Event {
    bubbles: boolean;
    cancelBubble: boolean;
    cancelable: boolean;
    composed: boolean;
    currentTarget: EventTarget | null;
    defaultPrevented: boolean;
    eventPhase: number;
    isTrusted: boolean;
    returnValue: boolean;
    srcElement: EventTarget | null;
    target: EventTarget | null;
    timeStamp: number;
    type: string;
    composedPath(): EventTarget[];
    initEvent(type: string, bubbles?: boolean, cancelable?: boolean): void;
    preventDefault(): void;
    stopImmediatePropagation(): void;
    stopPropagation(): void;
    AT_TARGET: number;
    BUBBLING_PHASE: number;
    CAPTURING_PHASE: number;
    NONE: number;
  }

  interface ErrorEvent extends Event {
    colno: number;
    error: any;
    filename: string;
    lineno: number;
    message: string;
  }

  interface MessageEvent<T = any> extends Event {
    data: T;
    lastEventId: string;
    origin: string;
    ports: ReadonlyArray<MessagePort>;
    source: MessageEventSource | null;
    initMessageEvent(
      type: string,
      bubbles?: boolean,
      cancelable?: boolean,
      data?: any,
      origin?: string,
      lastEventId?: string,
      source?: MessageEventSource | null,
      ports?: MessagePort[]
    ): void;
  }

  interface CloseEvent extends Event {
    code: number;
    reason: string;
    wasClean: boolean;
  }

  type MessageEventSource = WindowProxy | MessagePort | ServiceWorker;

  interface MessagePort extends EventTarget {
    onmessage: ((this: MessagePort, ev: MessageEvent) => any) | null;
    onmessageerror: ((this: MessagePort, ev: MessageEvent) => any) | null;
    close(): void;
    postMessage(message: any, transfer: Transferable[]): void;
    postMessage(message: any, options?: StructuredSerializeOptions): void;
    start(): void;
  }

  interface WindowProxy {
    readonly closed: boolean;
    readonly length: number;
    readonly location: Location;
    readonly opener: WindowProxy | null;
    readonly parent: WindowProxy | null;
    readonly self: WindowProxy;
    readonly top: WindowProxy | null;
    readonly window: WindowProxy;
    focus(): void;
    postMessage(message: any, targetOrigin: string, transfer?: Transferable[]): void;
  }

  interface ServiceWorker extends EventTarget {
    readonly scriptURL: string;
    readonly state: ServiceWorkerState;
    postMessage(message: any, transfer: Transferable[]): void;
    postMessage(message: any, options?: StructuredSerializeOptions): void;
    onstatechange: ((this: ServiceWorker, ev: Event) => any) | null;
  }

  type ServiceWorkerState = "installing" | "installed" | "activating" | "activated" | "redundant";

  interface StructuredSerializeOptions {
    transfer?: Transferable[];
  }

  type Transferable = ArrayBuffer | MessagePort | ImageBitmap;

  interface EventTarget {
    addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void;
    dispatchEvent(event: Event): boolean;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void;
  }

  type EventListenerOrEventListenerObject = EventListener | EventListenerObject;

  interface EventListener {
    (evt: Event): void;
  }

  interface EventListenerObject {
    handleEvent(object: Event): void;
  }

  interface AddEventListenerOptions extends EventListenerOptions {
    once?: boolean;
    passive?: boolean;
    signal?: AbortSignal;
  }

  interface EventListenerOptions {
    capture?: boolean;
  }

  interface AbortSignal extends EventTarget {
    readonly aborted: boolean;
    onabort: ((this: AbortSignal, ev: Event) => any) | null;
  }

  // ImageBitmap placeholder for Node environment
  interface ImageBitmap {
    readonly height: number;
    readonly width: number;
    close(): void;
  }

  // Location interface for WindowProxy
  interface Location {
    readonly ancestorOrigins: DOMStringList;
    hash: string;
    host: string;
    hostname: string;
    href: string;
    readonly origin: string;
    pathname: string;
    port: string;
    protocol: string;
    search: string;
    assign(url: string): void;
    reload(): void;
    replace(url: string): void;
    toString(): string;
  }

  interface DOMStringList {
    readonly length: number;
    contains(string: string): boolean;
    item(index: number): string | null;
    [index: number]: string;
  }
}

export {};