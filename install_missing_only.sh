#!/bin/bash

cd /home/pricepro2006/CrewAI_Team

echo "Installing missing dependencies..."

# First, let's check what's actually missing
echo "Checking which packages are missing..."

# Install only packages not in package.json
echo "Installing http-proxy-middleware..."
npm install http-proxy-middleware
npm install --save-dev @types/http-proxy-middleware

echo "Installing gRPC packages..."
npm install @grpc/grpc-js @grpc/proto-loader

echo "Installing Fastify ecosystem..."
npm install fastify @fastify/cors @fastify/helmet @fastify/rate-limit

echo "Installing email packages..."
npm install nodemailer
npm install --save-dev @types/nodemailer

echo "Installing Discord.js..."
npm install discord.js

echo "Installing react-hot-toast..."
npm install react-hot-toast

echo "Installing types for pako (if missing)..."
npm install --save-dev @types/pako

echo "Running npm install to ensure all dependencies are properly installed..."
npm install

echo "Installation complete!"