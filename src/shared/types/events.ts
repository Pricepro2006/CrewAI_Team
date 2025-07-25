export interface SystemEvent {
  id: string;
  type: string;
  timestamp: Date;
  data: unknown;
  source: string;
}

export interface EventSubscription {
  id: string;
  eventType: string;
  handler: string;
  filter?: Record<string, unknown>;
}
