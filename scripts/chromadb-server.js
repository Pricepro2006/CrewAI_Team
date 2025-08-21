#!/usr/bin/env node

/**
 * Mock ChromaDB Server for Development
 * Provides minimal endpoints needed for the application to start
 */

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 8000;

// Enable CORS for all origins
app.use(cors());
app.use(express.json());

// Store collections in memory
const collections = new Map();
let collectionIdCounter = 1;

// Heartbeat endpoint
app.get('/api/v1/heartbeat', (req, res) => {
  res.json({ 
    nanosecond_heartbeat: Date.now() * 1000000,
    status: 'healthy'
  });
});

// Version endpoint - ChromaDB client uses this
app.get('/api/v1/version', (req, res) => {
  res.json({ version: '0.4.0' });
});

// Alternative version endpoint
app.get('/api/v1', (req, res) => {
  res.json({ version: '0.4.0' });
});

// Collections endpoints
app.get('/api/v1/collections', (req, res) => {
  const collectionList = Array.from(collections.values());
  res.json(collectionList);
});

app.post('/api/v1/collections', (req, res) => {
  const { name, metadata = {} } = req.body;
  
  // Check if collection already exists
  const existingCollection = Array.from(collections.values())
    .find(col => col.name === name);
  
  if (existingCollection) {
    return res.status(409).json({ 
      error: 'Collection already exists',
      collection: existingCollection 
    });
  }
  
  const collection = {
    id: `collection-${collectionIdCounter++}`,
    name,
    metadata,
    tenant: 'default_tenant',
    database: 'default_database'
  };
  
  collections.set(collection.id, collection);
  res.status(201).json(collection);
});

app.get('/api/v1/collections/:name', (req, res) => {
  const { name } = req.params;
  const collection = Array.from(collections.values())
    .find(col => col.name === name);
  
  if (!collection) {
    return res.status(404).json({ error: 'Collection not found' });
  }
  
  res.json(collection);
});

// Documents endpoints (mock implementation)
app.post('/api/v1/collections/:collectionId/add', (req, res) => {
  const { collectionId } = req.params;
  const { ids, embeddings, metadatas, documents } = req.body;
  
  // Just acknowledge the request
  res.json({ 
    success: true,
    added: ids?.length || 0
  });
});

app.post('/api/v1/collections/:collectionId/query', (req, res) => {
  const { collectionId } = req.params;
  const { query_embeddings, n_results = 10 } = req.body;
  
  // Return mock results
  res.json({
    ids: [[]],
    distances: [[]],
    metadatas: [[]],
    embeddings: null,
    documents: [[]]
  });
});

app.post('/api/v1/collections/:collectionId/get', (req, res) => {
  const { collectionId } = req.params;
  const { ids, where, limit } = req.body;
  
  // Return empty results
  res.json({
    ids: [],
    metadatas: [],
    documents: [],
    embeddings: null
  });
});

app.delete('/api/v1/collections/:name', (req, res) => {
  const { name } = req.params;
  const collection = Array.from(collections.entries())
    .find(([id, col]) => col.name === name);
  
  if (!collection) {
    return res.status(404).json({ error: 'Collection not found' });
  }
  
  collections.delete(collection[0]);
  res.json({ deleted: true });
});

// Reset endpoint (for testing)
app.post('/api/v1/reset', (req, res) => {
  collections.clear();
  collectionIdCounter = 1;
  res.json({ reset: true });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 Mock ChromaDB Server started');
  console.log(`📊 Heartbeat: http://localhost:${PORT}/api/v1/heartbeat`);
  console.log(`📦 Collections: http://localhost:${PORT}/api/v1/collections`);
  console.log('⚠️  Note: This is a mock server for development only');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Mock ChromaDB Server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down Mock ChromaDB Server...');
  process.exit(0);
});