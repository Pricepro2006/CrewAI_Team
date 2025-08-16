const express = require('express');
const { config } = require('dotenv');
config();

const app = express();
const PORT = process.env.PORT || 3001;

// Basic middleware
app.use(express.json());

// Health check endpoint
app.get('/health', async (req, res) => {
  const startTime = Date.now();
  const services = {
    api: 'running',
    database: 'unknown',
    port: PORT
  };

  try {
    // Test basic database connection if possible
    const Database = require('better-sqlite3');
    const db = new Database('./data/app.db', { readonly: true });
    db.prepare('SELECT 1').get();
    db.close();
    services.database = 'connected';
  } catch (error) {
    services.database = 'error: ' + error.message;
  }

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    responseTime: Date.now() - startTime,
    services,
    message: 'Simple health server running'
  });
});

// Simple test endpoint
app.get('/test', (req, res) => {
  res.json({
    message: 'Server is responsive',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// Database test endpoint
app.get('/db-test', async (req, res) => {
  try {
    const Database = require('better-sqlite3');
    const db = new Database('./data/app.db', { readonly: true });
    
    // Try to get table info
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    
    // Test a simple query if emails table exists
    let emailCount = 0;
    try {
      emailCount = db.prepare("SELECT COUNT(*) as count FROM emails").get()?.count || 0;
    } catch (e) {
      emailCount = 'table not found';
    }
    
    db.close();
    
    res.json({
      database: 'connected',
      tables: tables.map(t => t.name),
      emailCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Database connection failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Port test endpoint  
app.get('/port-test', (req, res) => {
  res.json({
    port: PORT,
    actualPort: req.socket.localPort,
    host: req.hostname,
    protocol: req.protocol,
    url: req.url,
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Simple Health Server running on http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/test`);
  console.log(`🗄️  Database test: http://localhost:${PORT}/db-test`);
  console.log(`🔌 Port test: http://localhost:${PORT}/port-test`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server };