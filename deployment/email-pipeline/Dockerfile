# Email Pipeline Service Dockerfile
# Multi-stage build for optimized production image

# Stage 1: Build dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY .npmrc* ./

# Install pnpm and dependencies
RUN npm install -g pnpm@9.15.0
RUN pnpm install --frozen-lockfile --prod=false

# Stage 2: Build application
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.15.0

# Copy dependencies from previous stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml

# Copy source code
COPY src ./src
COPY tsconfig.json ./
COPY tsconfig.email-pipeline.json ./

# Build the email pipeline service
RUN pnpm run build:email-pipeline || echo "Build script not found, using tsc directly"
RUN npx tsc --project tsconfig.email-pipeline.json || true

# Stage 3: Production image
FROM node:20-alpine AS runner
WORKDIR /app

# Install production dependencies only
RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Install pnpm
RUN npm install -g pnpm@9.15.0

# Copy package files
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY .npmrc* ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/src ./src
COPY --chown=nodejs:nodejs data ./data
COPY --chown=nodejs:nodejs migrations ./migrations

# Create necessary directories
RUN mkdir -p /app/logs /app/data /app/temp && \
    chown -R nodejs:nodejs /app/logs /app/data /app/temp

# Set environment to production
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3456/health || exit 1

# Switch to non-root user
USER nodejs

# Expose email pipeline service port
EXPOSE 3456

# Start the email pipeline service
CMD ["node", "--loader", "tsx", "src/services/email/email-pipeline-standalone.ts"]