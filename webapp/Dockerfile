FROM node:20-slim AS builder
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
FROM nginx:alpine
COPY --from=builder /app/webapp/dist /usr/share/nginx/html
COPY webapp/nginx.conf /etc/nginx/conf.d/default.conf

# Ensure nginx user owns the html directory
RUN chown -R nginx:nginx /usr/share/nginx/html

EXPOSE 80
USER nginx
