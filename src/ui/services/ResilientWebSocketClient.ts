/**
 * Resilient WebSocket Client with Automatic Reconnection
 * Implements exponential backoff, message queueing, and connection state management
 */

import { EventEmitter } from "events";
import { logger } from "../../utils/logger.js";

export interface WebSocketConfig {
  url: string;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  reconnectDelayMax?: number;
  reconnectBackoffMultiplier?: number;
  heartbeatInterval?: number;
  messageTimeout?: number;
  queueSize?: number;
}

export interface WebSocketMessage {
  id?: string;
  type: string;
  data: any;
  timestamp?: string;
  sequenceNumber?: number;
}

export enum ConnectionState {
  CONNECTING = "CONNECTING",
  CONNECTED = "CONNECTED",
  RECONNECTING = "RECONNECTING",
  DISCONNECTED = "DISCONNECTED",
  CLOSED = "CLOSED"
}

export class ResilientWebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private reconnectAttempt: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private messageTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private messageQueue: WebSocketMessage[] = [];
  private sequenceNumber: number = 0;
  private reconnectToken: string | null = null;
  private sessionId: string | null = null;
  private userId: string | null = null;
  private pendingMessages: Map<string, WebSocketMessage> = new Map();
  private messageCallbacks: Map<string, (response: any) => void> = new Map();

  constructor(config: WebSocketConfig) {
    super();
    
    this.config = {
      url: config.url,
      reconnectAttempts: config.reconnectAttempts ?? 5,
      reconnectDelay: config.reconnectDelay ?? 1000,
      reconnectDelayMax: config.reconnectDelayMax ?? 30000,
      reconnectBackoffMultiplier: config.reconnectBackoffMultiplier ?? 1.5,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
      messageTimeout: config.messageTimeout ?? 10000,
      queueSize: config.queueSize ?? 100
    };
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.state === ConnectionState.CONNECTED || 
        this.state === ConnectionState.CONNECTING) {
      return;
    }

    this.state = ConnectionState.CONNECTING;
    this.emit("stateChange", this.state);

    try {
      const url = this.buildConnectionUrl();
      this.ws = new WebSocket(url);
      this.setupEventHandlers();
    } catch (error) {
      logger.error("Failed to create WebSocket", "WEBSOCKET", {}, error as Error);
      this.handleConnectionError(error as Error);
    }
  }

  /**
   * Build connection URL with reconnect token if available
   */
  private buildConnectionUrl(): string {
    const url = new URL(this.config.url);
    
    if (this.reconnectToken) {
      url.searchParams.set("reconnectToken", this.reconnectToken);
    }
    
    return url.toString();
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = this.handleOpen.bind(this);
    this.ws.onmessage = this.handleMessage.bind(this);
    this.ws.onclose = this.handleClose.bind(this);
    this.ws.onerror = this.handleError.bind(this);
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(event: Event): void {
    logger.info("WebSocket connected", "WEBSOCKET");
    
    this.state = ConnectionState.CONNECTED;
    this.reconnectAttempt = 0;
    this.emit("stateChange", this.state);
    this.emit("connect", event);

    // Authenticate if we have credentials
    if (this.userId || this.sessionId) {
      this.authenticate();
    }

    // Flush message queue
    this.flushMessageQueue();

    // Start heartbeat
    this.startHeartbeat();
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      // Handle special message types
      switch (message.type) {
        case "auth":
          this.handleAuthResponse(message);
          break;
          
        case "reconnect":
          this.handleReconnectResponse(message);
          break;
          
        case "heartbeat":
          this.handleHeartbeat(message);
          break;
          
        case "ack":
          this.handleAcknowledgment(message);
          break;
          
        case "error":
          this.handleErrorMessage(message);
          break;
          
        default:
          // Emit message for application handling
          this.emit("message", message);
          
          // Handle callback if this is a response to a request
          if (message.id && this.messageCallbacks.has(message.id)) {
            const callback = this.messageCallbacks.get(message.id)!;
            this.messageCallbacks.delete(message.id);
            callback(message.data);
          }
      }
    } catch (error) {
      logger.error("Failed to parse WebSocket message", "WEBSOCKET", {}, error as Error);
      this.emit("error", error);
    }
  }

  /**
   * Handle authentication response
   */
  private handleAuthResponse(message: WebSocketMessage): void {
    const { reconnectToken, clientId } = message.data;
    
    if (reconnectToken) {
      this.reconnectToken = reconnectToken;
      // Store in localStorage for persistence
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem("ws_reconnect_token", reconnectToken);
      }
    }
    
    this.emit("authenticated", { clientId, reconnectToken });
  }

  /**
   * Handle reconnection response
   */
  private handleReconnectResponse(message: WebSocketMessage): void {
    const { success, reconnectCount, queuedMessages } = message.data;
    
    if (success) {
      logger.info(`Reconnected successfully. Count: ${reconnectCount}, Queued: ${queuedMessages}`, "WEBSOCKET");
      this.emit("reconnected", { reconnectCount, queuedMessages });
    }
  }

  /**
   * Handle heartbeat message
   */
  private handleHeartbeat(message: WebSocketMessage): void {
    // Reset heartbeat timer
    this.resetHeartbeat();
  }

  /**
   * Handle acknowledgment message
   */
  private handleAcknowledgment(message: WebSocketMessage): void {
    const { messageId } = message.data;
    
    // Clear timeout for acknowledged message
    if (this.messageTimeouts.has(messageId)) {
      clearTimeout(this.messageTimeouts.get(messageId)!);
      this.messageTimeouts.delete(messageId);
    }
    
    // Remove from pending messages
    this.pendingMessages.delete(messageId);
    
    this.emit("acknowledged", messageId);
  }

  /**
   * Handle error message from server
   */
  private handleErrorMessage(message: WebSocketMessage): void {
    const { error, reconnectable } = message.data;
    
    logger.error("Server error", "WEBSOCKET", { error });
    this.emit("serverError", { error, reconnectable });
    
    if (reconnectable === false) {
      // Server says we shouldn't reconnect
      this.close();
    }
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    logger.info(`WebSocket closed: ${event.code} - ${event.reason}`, "WEBSOCKET");
    
    this.ws = null;
    this.stopHeartbeat();
    
    // Check if we should attempt to reconnect
    if (this.state !== ConnectionState.CLOSED && 
        this.reconnectAttempt < this.config.reconnectAttempts) {
      this.state = ConnectionState.RECONNECTING;
      this.emit("stateChange", this.state);
      this.emit("disconnect", event);
      this.scheduleReconnect();
    } else {
      this.state = ConnectionState.DISCONNECTED;
      this.emit("stateChange", this.state);
      this.emit("close", event);
    }
  }

  /**
   * Handle WebSocket error event
   */
  private handleError(event: Event): void {
    logger.error("WebSocket error", "WEBSOCKET", { event });
    this.emit("error", event);
  }

  /**
   * Handle connection error
   */
  private handleConnectionError(error: Error): void {
    logger.error("Connection error", "WEBSOCKET", {}, error as Error);
    this.emit("error", error);
    
    if (this.reconnectAttempt < this.config.reconnectAttempts) {
      this.scheduleReconnect();
    } else {
      this.state = ConnectionState.DISCONNECTED;
      this.emit("stateChange", this.state);
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = this.calculateReconnectDelay();
    logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt + 1}/${this.config.reconnectAttempts})`, "WEBSOCKET");
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempt++;
      this.connect();
    }, delay);
  }

  /**
   * Calculate reconnect delay with exponential backoff
   */
  private calculateReconnectDelay(): number {
    const baseDelay = this.config.reconnectDelay;
    const multiplier = Math.pow(this.config.reconnectBackoffMultiplier, this.reconnectAttempt);
    const delay = Math.min(baseDelay * multiplier, this.config.reconnectDelayMax);
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * delay;
    
    return Math.floor(delay + jitter);
  }

  /**
   * Authenticate with the server
   */
  private authenticate(): void {
    this.send({
      type: "auth",
      data: {
        userId: this.userId,
        sessionId: this.sessionId
      }
    });
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.send({
          type: "heartbeat",
          data: { timestamp: Date.now() }
        });
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat mechanism
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Reset heartbeat timer
   */
  private resetHeartbeat(): void {
    this.startHeartbeat();
  }

  /**
   * Send message to server
   */
  send(message: WebSocketMessage, callback?: (response: any) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      // Add message ID and sequence number
      if (!message.id) {
        message.id = this.generateMessageId();
      }
      message.sequenceNumber = ++this.sequenceNumber;
      message.timestamp = new Date().toISOString();

      // Store callback if provided
      if (callback) {
        this.messageCallbacks.set(message.id, callback);
      }

      if (this.isConnected()) {
        try {
          this.ws!.send(JSON.stringify(message));
          
          // Set timeout for message acknowledgment
          const timeout = setTimeout(() => {
            this.handleMessageTimeout(message);
          }, this.config.messageTimeout);
          
          this.messageTimeouts.set(message.id, timeout);
          this.pendingMessages.set(message.id, message);
          
          resolve();
        } catch (error) {
          logger.error("Failed to send message", "WEBSOCKET", {}, error as Error);
          this.queueMessage(message);
          reject(error);
        }
      } else {
        // Queue message for later delivery
        this.queueMessage(message);
        resolve();
      }
    });
  }

  /**
   * Handle message timeout
   */
  private handleMessageTimeout(message: WebSocketMessage): void {
    logger.warn(`Message timeout: ${message.id}`, "WEBSOCKET");
    this.messageTimeouts.delete(message.id!);
    this.pendingMessages.delete(message.id!);
    
    // Retry or queue the message
    if (this.isConnected()) {
      // Retry once
      this.send(message);
    } else {
      this.queueMessage(message);
    }
    
    this.emit("messageTimeout", message);
  }

  /**
   * Queue message for later delivery
   */
  private queueMessage(message: WebSocketMessage): void {
    if (this.messageQueue.length >= this.config.queueSize) {
      // Remove oldest message if queue is full
      const removed = this.messageQueue.shift();
      this.emit("messageDropped", removed);
    }
    
    this.messageQueue.push(message);
    this.emit("messageQueued", message);
  }

  /**
   * Flush message queue
   */
  private flushMessageQueue(): void {
    const queue = [...this.messageQueue];
    this.messageQueue = [];
    
    queue.forEach(message => {
      this.send(message);
    });
  }

  /**
   * Subscribe to events
   */
  subscribe(events: string[]): void {
    this.send({
      type: "subscribe",
      data: { events }
    });
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(events: string[]): void {
    this.send({
      type: "unsubscribe",
      data: { events }
    });
  }

  /**
   * Set user ID for authentication
   */
  setUserId(userId: string): void {
    this.userId = userId;
    if (this.isConnected()) {
      this.authenticate();
    }
  }

  /**
   * Set session ID for authentication
   */
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
    if (this.isConnected()) {
      this.authenticate();
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.messageQueue.length;
  }

  /**
   * Get pending messages count
   */
  getPendingCount(): number {
    return this.pendingMessages.size;
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Close WebSocket connection
   */
  close(): void {
    this.state = ConnectionState.CLOSED;
    this.emit("stateChange", this.state);
    
    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    // Clear all timeouts
    this.messageTimeouts.forEach(timeout => clearTimeout(timeout));
    this.messageTimeouts.clear();
    
    // Stop heartbeat
    this.stopHeartbeat();
    
    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    // Clear queues
    this.messageQueue = [];
    this.pendingMessages.clear();
    this.messageCallbacks.clear();
  }

  /**
   * Destroy client and cleanup
   */
  destroy(): void {
    this.close();
    this.removeAllListeners();
  }
}

export default ResilientWebSocketClient;