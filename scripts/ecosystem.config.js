// PM2 Ecosystem Configuration for CrewAI Team
module.exports = {
  apps: [
    // Main CrewAI Application
    {
      name: 'crewai-app',
      script: './src/api/server.ts',
      interpreter: 'node',
      interpreter_args: '--loader tsx',
      cwd: '/home/pricepro2006/CrewAI_Team',
      instances: 1,
      exec_mode: 'fork',
      
      // Environment configuration
      env: {
        NODE_ENV: 'production',
        API_PORT: 3001,
        WS_PORT: 8080,
        DATABASE_PATH: './data/crewai_enhanced.db',
        LLAMA_SERVER_URL: 'http://localhost:8081'
      },
      
      // Auto restart configuration
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 4000,
      
      // Logging
      out_file: './logs/crewai-app-out.log',
      error_file: './logs/crewai-app-error.log',
      log_file: './logs/crewai-app-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Health monitoring
      health_check_grace_period: 30000,
      health_check_fatal_exceptions: true
    },
    
    // Llama.cpp Server
    {
      name: 'llama-server',
      script: './scripts/start-llama-server.sh',
      args: ['start'],
      cwd: '/home/pricepro2006/CrewAI_Team',
      instances: 1,
      exec_mode: 'fork',
      interpreter: 'bash',
      
      // Environment configuration
      env: {
        LLAMA_PROFILE: 'balanced',
        LLAMA_MODEL: 'llama-3.2-3b-instruct.Q4_K_M.gguf',
        LLAMA_PORT: 8081,
        LLAMA_HOST: '0.0.0.0'
      },
      
      // Auto restart configuration
      autorestart: true,
      watch: false,
      max_memory_restart: '16G',
      min_uptime: '30s',
      max_restarts: 3,
      restart_delay: 10000,
      
      // Logging
      out_file: './logs/llama-server-out.log',
      error_file: './logs/llama-server-error.log',
      log_file: './logs/llama-server-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Health monitoring
      health_check_grace_period: 120000,
      health_check_fatal_exceptions: false
    },
    
    // ChromaDB Server (if not using Docker)
    {
      name: 'chromadb-server',
      script: './scripts/start-chromadb.sh',
      cwd: '/home/pricepro2006/CrewAI_Team',
      instances: 1,
      exec_mode: 'fork',
      interpreter: 'bash',
      
      // Environment configuration
      env: {
        CHROMA_PORT: 8000,
        CHROMA_HOST: '0.0.0.0',
        PERSIST_DIRECTORY: './data/chromadb'
      },
      
      // Auto restart configuration
      autorestart: true,
      watch: false,
      max_memory_restart: '4G',
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 5000,
      
      // Logging
      out_file: './logs/chromadb-out.log',
      error_file: './logs/chromadb-error.log',
      log_file: './logs/chromadb-combined.log',
      time: true,
      
      // Health monitoring
      health_check_grace_period: 60000
    },
    
    // WebSocket Server (if separate from main app)
    {
      name: 'websocket-server',
      script: './scripts/start-websocket-server.sh',
      cwd: '/home/pricepro2006/CrewAI_Team',
      instances: 1,
      exec_mode: 'fork',
      interpreter: 'bash',
      
      // Environment configuration
      env: {
        WS_PORT: 8080,
        WS_HOST: '0.0.0.0'
      },
      
      // Auto restart configuration
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      min_uptime: '5s',
      max_restarts: 10,
      restart_delay: 2000,
      
      // Logging
      out_file: './logs/websocket-out.log',
      error_file: './logs/websocket-error.log',
      log_file: './logs/websocket-combined.log',
      time: true,
      
      // Disable if WebSocket is integrated with main app
      disabled: true
    }
  ],
  
  // Deployment configuration
  deploy: {
    production: {
      user: 'pricepro2006',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'git@github.com:pricepro2006/CrewAI_Team.git',
      path: '/home/pricepro2006/CrewAI_Team',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
      'ssh_options': 'ForwardAgent=yes'
    },
    
    staging: {
      user: 'pricepro2006',
      host: 'localhost',
      ref: 'origin/develop',
      repo: 'git@github.com:pricepro2006/CrewAI_Team.git',
      path: '/home/pricepro2006/CrewAI_Team-staging',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env staging',
      env: {
        NODE_ENV: 'staging'
      }
    }
  }
};