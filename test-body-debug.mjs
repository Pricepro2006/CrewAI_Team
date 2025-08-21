#!/usr/bin/env node

// Quick test to debug Express body parsing issue
import express from 'express';

const app = express();

app.use(express.json({ limit: "10mb" }));

app.post('/test-body', (req, res) => {
  console.log('Request body:', req.body);
  console.log('Request headers:', req.headers);
  console.log('Body type:', typeof req.body);
  console.log('Body keys:', Object.keys(req.body || {}));
  
  res.json({
    received: req.body,
    type: typeof req.body,
    isArray: Array.isArray(req.body),
    keys: Object.keys(req.body || {})
  });
});

const port = 3002;
app.listen(port, () => {
  console.log(`Body debug server running on http://localhost:${port}`);
  console.log('Test with: curl -X POST http://localhost:3002/test-body -H "Content-Type: application/json" -d \'{"test": "data"}\'');
});