import { config } from 'dotenv';
config();

console.log('Test server starting...');
console.log('Node version:', process.version);
console.log('Current directory:', process.cwd());

// Test basic imports
import express from 'express';
const app = express();

app.get('/test', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`);
});