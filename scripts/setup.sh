#!/bin/bash

# AI Agent Team Setup Script

set -e

echo "🚀 AI Agent Team Framework Setup"
echo "================================"

# Check prerequisites
echo "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check pnpm
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm
fi

# Check Ollama
if ! command -v ollama &> /dev/null; then
    echo "❌ Ollama is not installed."
    echo "Please install Ollama first:"
    echo "curl -fsSL https://ollama.com/install.sh | sh"
    exit 1
fi

# Create necessary directories
echo "Creating directories..."
mkdir -p data/vectordb data/documents data/logs

# Copy environment file
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your configuration"
fi

# Install dependencies
echo "Installing dependencies..."
pnpm install

# Pull Ollama models
echo "Pulling Ollama models..."
echo "This may take a while depending on your internet connection..."

ollama pull qwen3:14b
ollama pull qwen3:8b
ollama pull nomic-embed-text

# Check if Docker is installed (optional)
if command -v docker &> /dev/null; then
    echo "🐳 Docker detected. You can use 'docker-compose up' for containerized deployment."
else
    echo "ℹ️  Docker not detected. You can still run the application locally."
fi

# Initialize database
echo "Initializing database..."
pnpm run init:db || echo "Database initialization will run on first start"

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the application:"
echo "  1. Make sure Ollama is running"
echo "  2. Run: pnpm run dev"
echo "  3. Open http://localhost:5173 in your browser"
echo ""
echo "For production deployment:"
echo "  1. Build: pnpm run build"
echo "  2. Start: pnpm run start"
echo ""
echo "Happy coding! 🎉"
