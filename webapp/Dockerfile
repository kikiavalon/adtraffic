# Pin to specific digest — run `docker pull node:20-slim` and update periodically
FROM node:20-slim@sha256:2862e32e35f4f13e2e5e167446e4a3db53e49e2eb1c44a1b4da6a1318aef093e AS builder
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
FROM nginx:alpine@sha256:65645c7bb6000792e56419e7e47099bfebab80c7e4f75b90a8e4e1a3ffcfab64
COPY --from=builder /app/webapp/dist /usr/share/nginx/html
COPY webapp/nginx.conf /etc/nginx/conf.d/default.conf

# Ensure nginx user owns the html directory
RUN chown -R nginx:nginx /usr/share/nginx/html

EXPOSE 80
USER nginx
