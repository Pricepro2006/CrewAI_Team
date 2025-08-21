#!/bin/sh
set -e

echo "🚀 Starting CrewAI Team Application"
echo "Environment: ${NODE_ENV}"
echo "Database: ${DATABASE_PATH}"

# Initialize database if it doesn't exist
if [ ! -f "${DATABASE_PATH}" ]; then
    echo "📦 Initializing database..."
    npm run db:init || echo "Database initialization skipped"
fi

# Run migrations
echo "🔄 Running database migrations..."
npm run db:migrate || echo "Migrations skipped"

# Start ChromaDB in background if not using external service
if [ -z "$CHROMA_URL" ]; then
    echo "🎯 Starting local ChromaDB..."
    chroma run --host 0.0.0.0 --port 8000 --path ${CHROMA_PATH} &
    sleep 5
fi

# Start Redis if not using external service
if [ -z "$REDIS_URL" ]; then
    echo "📮 Redis connection not configured, some features may be limited"
fi

# Start the application based on environment
if [ "$NODE_ENV" = "production" ]; then
    echo "🏭 Starting production server..."
    
    # Start API server
    npm run start:server &
    
    # Start WebSocket server
    npm run start:websocket &
    
    # Start frontend
    npm run start
else
    echo "🔧 Starting development server..."
    
    # Start all services in development mode
    npm run dev
fi

# Keep container running
wait