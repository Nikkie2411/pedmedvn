# Multi-stage Dockerfile for optimized backend
FROM node:22-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Production stage
FROM node:22-alpine AS production

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache dumb-init

# Create app directory with proper permissions
RUN mkdir -p /app && chown -R node:node /app

WORKDIR /app

# Copy package files
COPY --chown=node:node package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --chown=node:node --from=builder /app .

# Remove unnecessary files
RUN rm -rf node_modules/.cache && \
    rm -rf /tmp/* && \
    rm -rf /var/cache/apk/*

# Set environment variables for production
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512 --enable-source-maps"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { \
    process.exit(res.statusCode === 200 ? 0 : 1) \
  }).on('error', () => process.exit(1))"

EXPOSE 3000

# Use non-root user
USER node

# Use dumb-init to handle signals properly
CMD ["dumb-init", "node", "app.js"]
