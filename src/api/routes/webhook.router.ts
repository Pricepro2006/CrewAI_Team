import { Router } from 'express';
import { graphWebhookHandler } from '../webhooks/microsoft-graph';

const webhookRouter = Router();

// Microsoft Graph webhook endpoint
// This endpoint handles notifications from Microsoft Graph subscriptions
webhookRouter.post('/microsoft-graph', graphWebhookHandler);

// Health check for webhook endpoints
webhookRouter.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    endpoints: {
      'microsoft-graph': 'POST /api/webhooks/microsoft-graph'
    }
  });
});

export { webhookRouter };