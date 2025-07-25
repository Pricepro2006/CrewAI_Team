export interface MonitoringEvent {
  id: string;
  timestamp: Date;
  type: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  source: string;
  message: string;
  metadata?: Record<string, unknown>;
}
