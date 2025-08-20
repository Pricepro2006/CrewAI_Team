# Multi-stage build for CrewAI Team application
FROM node:20.11-alpine AS builder

# Set build arguments
ARG BUILD_ENV=production
ENV NODE_ENV=production

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source code
COPY src/ ./src/
COPY public/ ./public/
COPY scripts/ ./scripts/
COPY *.js ./
COPY *.ts ./

# Build the application
RUN npm run build || true && \
    npm run build:server || true

# Production stage
FROM node:20.11-alpine

# Install runtime dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    sqlite \
    curl \
    bash

# Install Python dependencies
RUN pip3 install --no-cache-dir \
    chromadb \
    chromadb-default-embed

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy built application from builder
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/build ./build
COPY --from=builder --chown=nodejs:nodejs /app/public ./public
COPY --from=builder --chown=nodejs:nodejs /app/scripts ./scripts

# Copy configuration files
COPY --chown=nodejs:nodejs .env.example ./.env.example
COPY --chown=nodejs:nodejs *.js ./
COPY --chown=nodejs:nodejs *.ts ./

# Create data directories
RUN mkdir -p /app/data /app/logs /app/uploads && \
    chown -R nodejs:nodejs /app/data /app/logs /app/uploads

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    API_PORT=3001 \
    WEBSOCKET_PORT=8080 \
    DATABASE_PATH=/app/data/crewai_enhanced.db \
    WALMART_DB_PATH=/app/data/walmart_grocery.db \
    CHROMA_PATH=/app/data/chromadb \
    LOG_PATH=/app/logs

# Expose ports
EXPOSE 3000 3001 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Switch to non-root user
USER nodejs

# Start script
COPY --chown=nodejs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "run", "start"]