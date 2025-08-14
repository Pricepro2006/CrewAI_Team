# 🔍 Monitoring System Setup Guide

## Overview

This comprehensive monitoring system provides real-time insights into your Walmart Grocery Agent local development environment, including:

- **WebSocket Health Monitoring**: Real-time connection tracking and health status
- **API Performance Monitoring**: Response times, error rates, and throughput
- **Database Query Monitoring**: Execution times, slow query detection, and optimization insights
- **System Health Dashboard**: Memory, CPU, connections, and alerts
- **Real-time Alerts**: Development-friendly notifications for performance issues

## Quick Start

### 1. Start the Monitoring System

```bash
# Make sure you're in the project root
cd /home/pricepro2006/CrewAI_Team

# Start monitoring (includes API server + WebSocket server)
./scripts/start-monitoring.sh
```

### 2. Access the Dashboard

- **Dashboard**: http://localhost:3010/monitoring
- **API Endpoints**: http://localhost:3010/api/monitoring
- **WebSocket**: ws://localhost:8080/monitoring

## Integration with Existing Services

### API Integration

Add monitoring middleware to your existing Express application:

```typescript
import { 
  performanceMonitoringMiddleware,
  errorMonitoringMiddleware,
  healthCheckMiddleware 
} from './src/api/middleware/monitoring/monitoring';

// Add to your Express app
app.use(healthCheckMiddleware);
app.use(performanceMonitoringMiddleware);
app.use(errorMonitoringMiddleware); // Should be last
```

### Database Integration

Integrate with your SQLite databases:

```typescript
import { databaseMonitor } from './src/database/monitoring/DatabaseMonitor';

// Register your databases for monitoring
const db = databaseMonitor.registerDatabase({
  name: 'walmart_grocery',
  path: './walmart_grocery.db',
  slowQueryThreshold: 50 // 50ms
});

// Use the returned db instance as normal
const products = db.prepare('SELECT * FROM products WHERE price < ?').all(100);
```

### WebSocket Integration

Add connection tracking to your WebSocket servers:

```typescript
import { monitoringService } from './src/services/MonitoringService';

wss.on('connection', (ws) => {
  const connectionId = generateId();
  
  // Track the connection
  monitoringService.trackConnection(connectionId, 'websocket', {
    path: '/ws/walmart',
    protocol: ws.protocol
  });
  
  ws.on('close', () => {
    monitoringService.disconnectConnection(connectionId);
  });
});
```

## Dashboard Features

### 📊 Overview Panel
- System health at a glance
- Key performance metrics
- Connection status
- Recent activity charts

### 🔌 Connections Monitor
- Real-time WebSocket connections
- HTTP request tracking
- Database connection status
- Connection filtering and search

### ⚡ Performance Panel
- API response time trends
- Endpoint-specific statistics
- Error rate monitoring
- Request throughput analysis

### 💾 Database Panel
- Query execution time tracking
- Slow query identification
- Database-specific metrics
- SQL query inspector

### 🚨 Alerts Panel
- Real-time alert notifications
- Alert acknowledgment system
- Severity-based filtering
- Alert history tracking

## Configuration

### Environment Variables

```bash
# API server port
MONITORING_API_PORT=3010

# WebSocket server port
MONITORING_WS_PORT=3003

# Environment (development/production)
NODE_ENV=development
```

### Monitoring Configuration

Edit `src/config/monitoring.config.ts` to customize:

- Alert thresholds
- Data retention periods
- Dashboard settings
- Database configurations

### Alert Thresholds

Default development thresholds:

```typescript
thresholds: {
  api: {
    responseTime: 1000, // 1 second
    errorRate: 5, // 5%
    requestSize: 10 * 1024 * 1024 // 10MB
  },
  database: {
    queryTime: 100, // 100ms
    errorRate: 1 // 1%
  },
  system: {
    memory: 500 * 1024 * 1024, // 500MB
    cpu: 0.8, // 80%
    connections: 100
  }
}
```

## API Endpoints

### Dashboard Data
- `GET /api/monitoring/dashboard` - Complete dashboard data
- `GET /api/monitoring/health-status` - System health status

### Metrics
- `GET /api/monitoring/metrics` - Get metrics data
- `GET /api/monitoring/performance` - API performance data
- `GET /api/monitoring/database/queries` - Recent database queries
- `GET /api/monitoring/database/stats/:database?` - Database statistics

### Alerts
- `GET /api/monitoring/alerts` - All alerts
- `GET /api/monitoring/alerts?active=true` - Active alerts only
- `POST /api/monitoring/alerts/:id/acknowledge` - Acknowledge alert

### System Info
- `GET /api/monitoring/connections` - Active connections
- `GET /api/monitoring/websocket/info` - WebSocket server info
- `GET /api/monitoring/system` - System information

## WebSocket API

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3003/monitoring');

ws.onopen = () => {
  // Subscribe to real-time updates
  ws.send(JSON.stringify({
    type: 'subscribe',
    data: { subscription: 'dashboard_data' }
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};
```

### Subscriptions

Available subscription types:
- `dashboard_data` - Complete dashboard updates
- `health_status` - System health changes
- `metrics` - New metrics data
- `alerts` - New alerts
- `performance` - API performance data
- `database_queries` - Database query events
- `connections` - Connection changes

## Development Tips

### 1. Monitor During Development

Keep the monitoring dashboard open while developing to:
- Track API response times in real-time
- Identify slow database queries
- Monitor WebSocket connection health
- Get immediate alerts for performance issues

### 2. Custom Metrics

Add custom metrics to your code:

```typescript
import { monitoringService } from './src/services/MonitoringService';

// Record custom metrics
monitoringService.gauge('walmart.products.count', productCount);
monitoringService.increment('walmart.orders.created');
monitoringService.timer('walmart.nlp.processing', async () => {
  return await processNLP(query);
});
```

### 3. Custom Alerts

Create custom alerts for specific conditions:

```typescript
monitoringService.createAlert('performance', 'high', 
  'High NLP processing time detected', {
  processingTime: 5000,
  threshold: 2000
});
```

### 4. Health Checks

Register custom health checks:

```typescript
monitoringService.registerHealthCheck('walmart_api', async () => {
  const response = await fetch('http://localhost:3005/health');
  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }
});
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Change ports in environment variables
   export MONITORING_API_PORT=3012
   export MONITORING_WS_PORT=3013
   ```

2. **Database Connection Errors**
   - Ensure database files exist
   - Check file permissions
   - Verify database paths in config

3. **WebSocket Connection Failed**
   - Check if WebSocket server is running
   - Verify port configuration
   - Check browser developer console for errors

### Logs

Monitor logs for detailed information:

```bash
# View monitoring logs
tail -f logs/monitoring/*.log

# Or check console output when running in development
```

### Performance

For better performance:
- Reduce retention periods in production
- Disable verbose logging
- Adjust update intervals based on needs

## Production Deployment

### 1. Build for Production

```bash
# Set production environment
export NODE_ENV=production

# Build TypeScript
npm run build

# Start monitoring
./scripts/start-monitoring.sh
```

### 2. Production Configuration

Production automatically uses:
- Longer retention periods
- Higher alert thresholds
- Less verbose logging
- Optimized update intervals

### 3. Security Considerations

- Restrict CORS origins
- Add authentication if needed
- Monitor resource usage
- Set up log rotation

## Integration Examples

### Example 1: Walmart Service Integration

```typescript
// In your Walmart service
import { monitoringService } from '../monitoring/MonitoringService';

export class WalmartService {
  async searchProducts(query: string) {
    return monitoringService.timer('walmart.search.duration', async () => {
      const results = await this.performSearch(query);
      monitoringService.gauge('walmart.search.results', results.length);
      return results;
    });
  }
}
```

### Example 2: NLP Processing Monitoring

```typescript
// In your NLP service
import { monitoringService } from '../monitoring/MonitoringService';

export class NLPService {
  async processIntent(text: string) {
    const startTime = Date.now();
    
    try {
      const intent = await this.analyzeText(text);
      const processingTime = Date.now() - startTime;
      
      monitoringService.recordMetric('nlp.processing.time', processingTime, 
        { intent: intent.type }, 'timer', 'ms');
      
      if (processingTime > 2000) {
        monitoringService.createAlert('performance', 'medium',
          `Slow NLP processing: ${processingTime}ms`, { text, intent });
      }
      
      return intent;
    } catch (error) {
      monitoringService.increment('nlp.processing.errors');
      throw error;
    }
  }
}
```

## Support

For issues or questions:

1. Check the console logs for error messages
2. Verify configuration in `monitoring.config.ts`
3. Test individual components (API, WebSocket, Database)
4. Check browser developer tools for frontend issues

The monitoring system is designed to be non-intrusive and provide valuable insights without impacting your development workflow. Happy monitoring! 🚀