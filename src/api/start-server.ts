#!/usr/bin/env node

/**
 * Server Startup Script
 * Initializes credential manager and starts the server
 */

import { config } from "dotenv";
config(); // Load environment variables

import CredentialManager from "../config/CredentialManager.js";

async function startServer() {
  try {
    console.log('🔐 Initializing credential manager...');
    
    // Initialize credential manager before anything else
    const credentialManager = CredentialManager.getInstance();
    await credentialManager.initialize();
    
    console.log('✅ Credential manager initialized successfully');
    
    // Now import and start the actual server
    console.log('🚀 Starting server...');
    await import('./server.js');
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    
    if (error instanceof Error) {
      if (error?.message?.includes('Credential validation failed')) {
        console.error('\n🔧 Fix the credential issues above and try again.');
        console.error('💡 Run: node scripts/setup-security.js for help setting up credentials.');
      } else if (error?.message?.includes('.env file not found')) {
        console.error('\n🔧 Copy .env.example to .env and configure your credentials.');
        console.error('💡 Run: cp .env.example .env && node scripts/setup-security.js');
      }
    }
    
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

export { startServer };