#!/usr/bin/env node

// Quick test startup script to bypass TypeScript issues for testing
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3001;

// Basic middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'running',
    timestamp: new Date().toISOString(),
    services: {
      api: 'running',
      ollama: 'unknown',
      database: 'unknown'
    }
  });
});

// Basic placeholder endpoints for testing
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/chat', (req, res) => {
  const { message } = req.body;
  res.json({
    response: `Echo: ${message}`,
    timestamp: new Date().toISOString(),
    agent: 'test-agent'
  });
});

// Serve static files (for UI testing)
app.use(express.static('dist/client'));

app.get('*', (req, res) => {
  res.sendFile('index.html', { root: 'dist/client' });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Test Server running on http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});