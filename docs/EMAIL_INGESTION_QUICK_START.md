# Email Ingestion Quick Start Guide

Get the CrewAI Email Ingestion system running in 5 minutes!

## 🚀 Quick Installation

```bash
# 1. Clone and setup
git clone https://github.com/your-org/crewai-team.git
cd crewai-team
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your Redis password

# 3. Start Redis (Docker)
docker run -d -p 6379:6379 redis:7-alpine redis-server --requirepass yourpassword

# 4. Initialize database
pnpm db:init

# 5. Start the system
pnpm start:dev
```

## 🎯 Basic Usage

### Manual Email Loading

```typescript
// Load emails from JSON files
import { initializeEmailIngestionIntegration } from './services/EmailIngestionIntegrationService';

async function loadEmails() {
  // Initialize service
  const service = await initializeEmailIngestionIntegration({
    mode: 'MANUAL_LOAD'
  });

  // Load email files
  const result = await service.data.loadBatch([
    './data/emails/batch1.json',
    './data/emails/batch2.json'
  ]);

  console.log(`Loaded ${result.data.processed} emails`);
}

loadEmails();
```

### Auto-Pull from Email Providers

```typescript
// Set up automatic email pulling
async function setupAutoPull() {
  const service = await initializeEmailIngestionIntegration({
    mode: 'AUTO_PULL',
    schedulerIntervalMinutes: 5
  });

  // Emails will be pulled every 5 minutes
  console.log('Auto-pull started');
}
```

### Monitor Progress

```typescript
// Real-time monitoring via WebSocket
import { io } from 'socket.io-client';

const socket = io('http://localhost:3002');

socket.on('email:ingestion:progress', (data) => {
  console.log(`Progress: ${data.processed}/${data.total}`);
});
```

## 📊 Dashboard

Access the monitoring dashboard at: http://localhost:3001/dashboard

Features:
- Real-time processing metrics
- Queue status
- Error logs
- Performance charts

## 🔧 Configuration Options

### Minimal Configuration (.env)

```env
# Required
REDIS_PASSWORD=yourpassword
JWT_SECRET=your32charactersecrethereatleast
ENCRYPTION_KEY=exactly32charactersecretkeyhere!

# Optional (defaults shown)
EMAIL_PROCESSING_BATCH_SIZE=50
EMAIL_PROCESSING_CONCURRENCY=10
PORT=3001
```

### Processing Modes

1. **Manual Load** - Process files on demand
2. **Auto-Pull** - Schedule email retrieval  
3. **Hybrid** - Both manual and auto

```typescript
// Switch modes
const config = {
  mode: 'HYBRID', // or 'MANUAL_LOAD' or 'AUTO_PULL'
  enableWebSocketUpdates: true,
  enableAnalysisIntegration: true
};
```

## 📝 Common Commands

```bash
# Development
pnpm start:dev          # Start in development mode
pnpm test              # Run tests
pnpm lint              # Check code quality

# Production
pnpm build             # Build for production
pnpm start:production  # Start production server

# Maintenance
pnpm db:migrate        # Run database migrations
pnpm queue:status      # Check queue status
pnpm logs:tail         # View real-time logs
```

## 🐛 Troubleshooting

### Redis Connection Error
```bash
# Check Redis is running
redis-cli -a yourpassword ping
# Should return: PONG
```

### Low Processing Speed
```env
# Increase workers
EMAIL_PROCESSING_CONCURRENCY=20
EMAIL_PROCESSING_BATCH_SIZE=100
```

### Memory Issues
```bash
# Increase Node.js memory
NODE_OPTIONS="--max-old-space-size=4096" pnpm start:dev
```

## 📚 Next Steps

1. Read the [Production Guide](./EMAIL_INGESTION_PRODUCTION_GUIDE.md)
2. Configure [email provider credentials](./EMAIL_INGESTION_PRODUCTION_GUIDE.md#configuration)
3. Set up [monitoring alerts](./EMAIL_INGESTION_PRODUCTION_GUIDE.md#monitoring--maintenance)
4. Review [security settings](./EMAIL_INGESTION_PRODUCTION_GUIDE.md#security-considerations)

## 💡 Pro Tips

- Start with Manual Load mode for testing
- Use batch sizes of 50-100 for optimal performance
- Monitor the dashboard during initial runs
- Enable debug logging for troubleshooting: `LOG_LEVEL=debug`

---

Need help? Check the [full documentation](./EMAIL_INGESTION_PRODUCTION_GUIDE.md) or create an issue on GitHub.