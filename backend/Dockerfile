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

EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "backend/dist/index.js"]
