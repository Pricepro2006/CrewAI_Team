#!/bin/bash

cd /home/pricepro2006/CrewAI_Team

echo "Installing all missing dependencies..."

# Core compression library
echo "Installing pako..."
npm install pako
npm install --save-dev @types/pako

# Middleware for proxy functionality
echo "Installing http-proxy-middleware..."
npm install http-proxy-middleware
npm install --save-dev @types/http-proxy-middleware

# gRPC packages for microservices
echo "Installing gRPC packages..."
npm install @grpc/grpc-js @grpc/proto-loader

# Fastify and related packages for NLP service
echo "Installing Fastify ecosystem..."
npm install fastify @fastify/cors @fastify/helmet @fastify/rate-limit

# Email notification packages
echo "Installing email packages..."
npm install nodemailer
npm install --save-dev @types/nodemailer

# Discord integration
echo "Installing Discord.js..."
npm install discord.js

# React toast notifications
echo "Installing react-hot-toast..."
npm install react-hot-toast

echo "Checking installations..."
npm list pako @types/pako http-proxy-middleware @grpc/grpc-js @grpc/proto-loader fastify @fastify/cors @fastify/helmet @fastify/rate-limit nodemailer discord.js react-hot-toast 2>/dev/null || echo "Packages installed successfully"

echo "All missing dependencies have been installed!"