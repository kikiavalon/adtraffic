# Pin to specific digest — run `docker pull node:20-slim` and update periodically
FROM node:20-slim@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0 AS builder
WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/ ./shared/
COPY webapp/ ./webapp/

# Install dependencies
RUN npm ci

# Build shared types
RUN npm run build --workspace=shared

# Build webapp
RUN npm run build --workspace=webapp

# Production stage — serve with Nginx
# Pin to specific digest — run `docker pull nginx:alpine` and update periodically
FROM nginx:alpine@sha256:4a73073bd557c65b759505da037898b61f1be6cbcc3c2c3aeac22d2a470c1752
COPY --from=builder /app/webapp/dist /usr/share/nginx/html
COPY webapp/nginx.conf /etc/nginx/conf.d/default.conf

# Ensure nginx user owns the html directory
RUN chown -R nginx:nginx /usr/share/nginx/html

EXPOSE 80
USER nginx
