# Pin to specific digest — run `docker pull node:20-slim` and update periodically
FROM node:20-slim@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0 AS builder
WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/ ./shared/
COPY backend/ ./backend/

# Install all dependencies
RUN npm ci

# Build shared types
RUN npm run build --workspace=shared

# Build backend
RUN npm run build --workspace=backend

# Production stage
FROM node:20-slim@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0
WORKDIR /app

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/shared/package.json ./shared/
COPY --from=builder /app/shared/dist/ ./shared/dist/
COPY --from=builder /app/backend/package.json ./backend/
COPY --from=builder /app/backend/dist/ ./backend/dist/

# Install production dependencies only
RUN npm ci --omit=dev --workspace=shared --workspace=backend

# No local data directory needed — all state is in PostgreSQL and Redis

EXPOSE 3001
ENV NODE_ENV=production

HEALTHCHECK --interval=10s --timeout=5s --retries=3 --start-period=15s \
  CMD node -e "fetch('http://localhost:3001/health/live').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

USER node
CMD ["node", "backend/dist/index.js"]
