# syntax=docker/dockerfile:1
# ------------------------------------------------------------------------------
# Stage 1: Build static assets
# ------------------------------------------------------------------------------
FROM node:24-alpine AS builder

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@10.4.0 --activate

# Copy dependency manifests
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install

# Copy source code and build
ARG VITE_SUPABASE_URL=https://lisekikckvvjshculasd.supabase.co
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_API_URL=/api/v1
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_API_URL=$VITE_API_URL

COPY . .
RUN pnpm build

# ------------------------------------------------------------------------------
# Stage 2: Minimal static serving runtime
# ------------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy build artifacts from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom nginx configuration supporting reverse-proxy, client-side routing, and security headers
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Configure unprivileged permissions for nginx runtime
RUN touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid /var/cache/nginx /usr/share/nginx/html /etc/nginx/conf.d

USER nginx

EXPOSE 80

STOPSIGNAL SIGQUIT

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]

