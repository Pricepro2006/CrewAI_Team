# Multi-stage build for NLP microservice
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY src/microservices/nlp-service/package.json ./service/

# Install dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Copy source code
COPY src/microservices/nlp-service/src ./service/src
COPY src/microservices/nlp-service/tsconfig.json ./service/
COPY src/api/services/GroceryNLPQueue.ts ./shared/
COPY src/api/types/grocery-nlp.types.ts ./shared/types/
COPY src/utils ./shared/utils

# Build the service
WORKDIR /app/service
RUN pnpm build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install production dependencies
COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm
RUN pnpm install --prod --frozen-lockfile

# Copy built application
COPY --from=builder /app/service/dist ./dist
COPY --from=builder /app/service/package.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership
RUN chown -R nextjs:nodejs /app
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Expose port
EXPOSE 3001

# Start the service
CMD ["node", "dist/index.js"]