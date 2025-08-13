# Email Ingestion Monitoring Dashboard

## Overview

The Email Ingestion Monitoring Dashboard provides real-time visibility into the email ingestion pipeline, offering comprehensive metrics, queue status monitoring, and system health tracking for production deployment.

## Architecture

```
React Dashboard ← WebSocket ← EmailIngestionService ← Redis Queue ← Email Sources
                    ↑                    ↑                ↑
                 tRPC API        Health Monitoring    Queue Processing
```

## Components

### Core Components

1. **EmailIngestionMonitoringDashboard.tsx**
   - Main dashboard component with comprehensive monitoring views
   - Real-time metrics display
   - Interactive charts and visualizations
   - Queue management controls

2. **EmailIngestionMonitoringErrorBoundary.tsx**
   - Error boundary for graceful error handling
   - Error reporting and diagnostics
   - Retry mechanisms and fallback UI

3. **EmailIngestionMonitoringWrapper.tsx**
   - Integration wrapper combining dashboard and error boundary
   - Network status monitoring
   - Loading states and suspense handling

### Supporting Files

4. **EmailIngestionMonitoring.css**
   - Comprehensive styling for monitoring interface
   - Responsive design and mobile optimization
   - Animation and transition effects

5. **emailIngestionMonitoring.router.ts**
   - tRPC router with monitoring endpoints
   - Real-time WebSocket subscriptions
   - Queue management mutations

## Features

### Real-time Monitoring

- **Live Metrics**: Processing throughput, queue size, success rates
- **WebSocket Integration**: Real-time updates without polling
- **Status Indicators**: Visual health status for all components
- **Connection Monitoring**: Network status and connectivity alerts

### Dashboard Views

#### Overview Tab
- Total emails ingested
- Current processing rate (emails/minute)
- Queue size and status
- Average processing time
- Real-time throughput chart

#### Queue Tab
- Queue status (waiting, active, completed, failed)
- Queue management controls (pause/resume)
- Failed job retry functionality
- Duplicate detection statistics

#### Throughput Tab
- Processing rate over different time windows
- Historical throughput visualization
- Performance trend analysis

#### Sources Tab
- Email source distribution (JSON, Database, APIs)
- Source-specific statistics
- Visual breakdown with pie charts

#### Errors Tab
- Failed ingestion count and rate
- Recent error log with details
- Error categorization by source
- Success rate calculations

### Interactive Controls

- **Auto-refresh Toggle**: Enable/disable automatic updates
- **Manual Refresh**: Force immediate data refresh
- **Queue Controls**: Pause/resume ingestion processing
- **Retry Management**: Retry failed jobs with configurable limits
- **Connection Status**: Real-time WebSocket connection indicator

## Integration Guide

### 1. Component Integration

```tsx
import { EmailIngestionMonitoringWrapper } from '@/components/Email';

// In your main application
<EmailIngestionMonitoringWrapper />
```

### 2. Router Integration

```typescript
import { emailIngestionMonitoringRouter } from '@/api/routes/emailIngestionMonitoring.router';

// Add to your main tRPC router
export const appRouter = router({
  // ... other routers
  emailIngestionMonitoring: emailIngestionMonitoringRouter,
});
```

### 3. Service Integration

```typescript
// In your server context
const emailIngestionService = new EmailIngestionServiceImpl(
  config,
  emailRepository,
  unifiedEmailService
);

await emailIngestionService.initialize();
```

## WebSocket Events

### Incoming Events (Dashboard Listens)

```typescript
interface WebSocketIngestionEvent {
  type: 'ingestion:progress' | 'ingestion:batch_progress' | 'ingestion:health' | 'email:ingested';
  data: any;
}
```

#### Event Types

- **`ingestion:health`**: System health status updates
- **`email:ingested`**: Individual email processing completion
- **`ingestion:batch_progress`**: Batch processing progress updates
- **`ingestion:progress`**: Real-time job progress tracking

### Outgoing Events (Dashboard Sends)

```typescript
// Subscribe to channels
{
  type: 'subscribe',
  channels: [
    'ingestion:progress',
    'ingestion:batch_progress', 
    'ingestion:health',
    'email:ingested'
  ]
}
```

## API Endpoints

### Health & Status

- `GET /health` - Overall pipeline health
- `GET /queueStatus` - Detailed queue status
- `GET /metrics` - Comprehensive metrics
- `GET /recentErrors` - Recent error log

### Queue Management

- `POST /pauseQueue` - Pause ingestion processing
- `POST /resumeQueue` - Resume ingestion processing
- `POST /retryFailedJobs` - Retry failed jobs

### Auto-Pull Management

- `POST /startAutoPull` - Start auto-pull process
- `POST /stopAutoPull` - Stop auto-pull process
- `GET /autoPullStatus` - Get auto-pull status

### Diagnostics

- `GET /diagnostics` - System diagnostic information
- `POST /clearDeduplicationCache` - Clear duplicate cache

## Configuration

### Environment Variables

```env
# WebSocket Configuration
WEBSOCKET_PORT=3001
WEBSOCKET_PATH=/ws
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# Redis Configuration (for EmailIngestionService)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password

# Monitoring Configuration
MONITORING_REFRESH_INTERVAL=30000
MONITORING_MAX_HISTORY=100
MONITORING_ERROR_RETENTION=1000
```

### Dashboard Configuration

```typescript
const MONITORING_CONFIG = {
  refreshInterval: 30000, // 30 seconds
  maxBatchHistory: 10,
  throughputHistorySize: 20,
  autoRefresh: true,
};
```

## Performance Considerations

### Optimization Features

1. **React.memo()**: Prevents unnecessary re-renders
2. **useMemo()**: Memoizes expensive calculations
3. **useCallback()**: Optimizes event handlers
4. **Lazy Loading**: Components loaded on demand
5. **Error Boundaries**: Graceful error handling

### WebSocket Optimization

- Connection pooling and reuse
- Automatic reconnection with exponential backoff
- Message queuing during disconnections
- Efficient event filtering and routing

### Chart Performance

- Data point limiting for large datasets
- Efficient re-rendering with animation
- Memory management for historical data
- Responsive design for mobile devices

## Mobile Responsiveness

### Breakpoints

- **Desktop**: `> 1024px` - Full dashboard layout
- **Tablet**: `768px - 1024px` - Compact layout
- **Mobile**: `< 768px` - Stacked cards and simplified charts

### Mobile Optimizations

- Touch-friendly controls
- Simplified navigation
- Reduced data density  
- Optimized chart sizing
- Efficient loading states

## Error Handling

### Error Boundary Features

- Automatic error reporting
- Retry mechanisms (up to 3 attempts)
- Fallback UI with helpful messaging
- Error detail copying for support
- Development vs production error display

### Error Categories

1. **Network Errors**: Connection timeouts, offline status
2. **Service Errors**: Backend service unavailability
3. **Data Errors**: Invalid response formats
4. **Rendering Errors**: Component rendering failures

## Security Considerations

### Authentication

- WebSocket authentication via JWT tokens
- Role-based access control for sensitive operations
- Session management and timeout handling

### Data Security

- Sensitive data filtering in error reports
- Secure WebSocket connections (WSS in production)
- CORS configuration for allowed origins

## Monitoring and Alerting

### Built-in Monitoring

- Component error tracking
- Performance metric collection
- User interaction analytics
- Network connectivity monitoring

### Integration Options

- Google Analytics event tracking
- Sentry error reporting
- Custom metrics collection
- Prometheus metric export

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failures**
   - Check CORS configuration
   - Verify authentication tokens
   - Confirm server WebSocket setup

2. **Data Not Updating**
   - Check EmailIngestionService initialization
   - Verify Redis connectivity
   - Confirm event emission in service

3. **Performance Issues**
   - Monitor memory usage in browser dev tools
   - Check for event listener leaks
   - Verify chart data point limits

### Debug Tools

- Browser DevTools WebSocket inspector
- React Developer Tools profiler
- Network tab for HTTP requests
- Console error logging

## Deployment

### Production Checklist

- [ ] Environment variables configured
- [ ] WebSocket server running
- [ ] HTTPS/WSS enabled
- [ ] Error reporting configured
- [ ] Performance monitoring enabled
- [ ] Mobile testing completed

### Docker Configuration

```dockerfile
# Add to your existing Dockerfile
EXPOSE 3001
ENV WEBSOCKET_PORT=3001
ENV NODE_ENV=production
```

### Nginx Configuration

```nginx
# WebSocket proxy configuration
location /ws {
    proxy_pass http://backend:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

## Future Enhancements

### Planned Features

1. **Advanced Analytics**
   - Predictive failure detection
   - Performance trend analysis
   - Capacity planning insights

2. **Enhanced Visualizations**
   - Custom dashboard layouts
   - Advanced chart types
   - Interactive data exploration

3. **Alerting System**
   - Configurable alert thresholds
   - Multi-channel notifications
   - Alert acknowledgment workflow

4. **Export Functionality**
   - CSV/JSON data export
   - Report generation
   - Historical data analysis

## Support

For technical support or feature requests:

1. Check the troubleshooting section
2. Review error logs and diagnostics
3. Contact the development team with error details
4. Include browser console logs and network traces

---

*Last Updated: August 2, 2025*
*Version: 2.2.0*