FROM node:20-slim AS builder
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
FROM node:20-slim
WORKDIR /app

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/shared/package.json ./shared/
COPY --from=builder /app/shared/dist/ ./shared/dist/
COPY --from=builder /app/backend/package.json ./backend/
COPY --from=builder /app/backend/dist/ ./backend/dist/

# Install production dependencies only
RUN npm ci --omit=dev --workspace=shared --workspace=backend

# Create data directory owned by non-root user
RUN mkdir -p /app/backend/data && chown -R node:node /app/backend/data

EXPOSE 3001
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

USER node
CMD ["node", "backend/dist/index.js"]
