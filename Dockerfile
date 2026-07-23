# Dockerfile for XAUUSD Bot — Railway/Render/Fly.io ready
# Uses Node.js 20 LTS Alpine for small image size

FROM node:20-alpine AS base

# Install bun for standalone server (lighter than node)
# Actually we'll just use node since the standalone output uses node
RUN apk add --no-cache libc6-compat

# ---- Dependencies stage ----
FROM base AS deps
WORKDIR /app

# Copy lockfile and package.json
COPY package.json bun.lock* ./

# Install all dependencies (including devDeps for build)
RUN npm install --legacy-peer-deps --no-audit --no-fund

# ---- Builder stage ----
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js (produces .next/standalone + .next/static)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- Runner stage (final image) ----
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=${PORT:-3000}
ENV HOSTNAME=0.0.0.0

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone server (includes only needed node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Switch to non-root user
USER nextjs

EXPOSE 3000

# Healthcheck: ping the SSE endpoint (lightweight)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O- http://localhost:3000/api/xau/paper-trade > /dev/null || exit 1

# Start the standalone Next.js server
CMD ["node", "server.js"]
