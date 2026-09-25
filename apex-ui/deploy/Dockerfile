# Multi-stage Dockerfile — Niumination Mission Control v4.0 "Aether"
# Stage 1: deps — install dependencies
# Stage 2: builder — build Next.js standalone
# Stage 3: runner — minimal runtime

FROM node:22-alpine AS deps
WORKDIR /app
# Install native deps for better-sqlite3
RUN apk add --no-cache python3 make g++ libc6-compat
COPY package.json package-lock.json* ./
RUN npm ci --frozen-lockfile || npm install

FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++ libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build Next.js standalone output
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Install runtime deps for better-sqlite3 (needs python? no, only prebuilt, but keep libc)
RUN apk add --no-cache libc6-compat

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Copy migrations and necessary files
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/package.json ./package.json

# Data volume mount point
RUN mkdir -p /app/data/backups && chown -R nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/mc/health || exit 1

CMD ["node", "server.js"]
