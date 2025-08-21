#!/bin/bash

# Start Walmart Microservices
echo "🚀 Starting Walmart Microservices..."

# Port 3005: Grocery Service (doesn't exist yet, skip)
# echo "Starting Grocery Service on port 3005..."

# Port 3006: Cache Warmer Service
echo "Starting Cache Warmer Service on port 3006..."
PORT=3006 tsx src/microservices/cache-warmer/CacheWarmerServer.ts &
CACHE_PID=$!
echo "Cache Warmer Service started with PID: $CACHE_PID"

# Port 3007: Pricing Service
echo "Starting Pricing Service on port 3007..."
PORT=3007 tsx src/microservices/pricing-service/PricingServiceServer.ts &
PRICING_PID=$!
echo "Pricing Service started with PID: $PRICING_PID"

# Port 3008: NLP Service
echo "Starting NLP Service on port 3008..."
PORT=3008 tsx src/microservices/nlp-service/NLPServiceServer.ts &
NLP_PID=$!
echo "NLP Service started with PID: $NLP_PID"

# Port 3009: Deal Engine (doesn't exist, skip)
# echo "Starting Deal Engine on port 3009..."

# Port 3010: Memory Monitor (doesn't exist, skip)
# echo "Starting Memory Monitor on port 3010..."

echo "✅ Available microservices started!"
echo "Services running:"
echo "  - Cache Warmer: http://localhost:3006 (PID: $CACHE_PID)"
echo "  - Pricing Service: http://localhost:3007 (PID: $PRICING_PID)"
echo "  - NLP Service: http://localhost:3008 (PID: $NLP_PID)"
echo ""
echo "To stop all services, run: kill $CACHE_PID $PRICING_PID $NLP_PID"

# Keep script running
wait