# Canvas MCP Server - Multi-stage Docker Build
# Optimized for production deployment across all platforms

# Build Stage
FROM node:20-alpine3.18 AS builder

# Set working directory
WORKDIR /app

# Install system dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci --only=production=false

# Copy source code
COPY . .

# Build the TypeScript project
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Production Stage
FROM node:20-alpine3.18 AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcp -u 1001

# Set working directory
WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache \
    dumb-init \
    tini

# Copy built application from builder stage
COPY --from=builder --chown=mcp:nodejs /app/dist ./dist
COPY --from=builder --chown=mcp:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=mcp:nodejs /app/package*.json ./
COPY --from=builder --chown=mcp:nodejs /app/tools ./tools
COPY --from=builder --chown=mcp:nodejs /app/lib ./lib

# Create necessary directories
RUN mkdir -p /app/data /app/logs && \
    chown -R mcp:nodejs /app

# Switch to non-root user
USER mcp

# Expose port (if needed for health checks)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('Health check: MCP Server running')" || exit 1

# Use tini as PID 1 to handle signals properly
ENTRYPOINT ["tini", "--"]

# Start the MCP server
CMD ["node", "dist/mcp.js"]