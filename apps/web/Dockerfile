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

# Custom nginx configuration supporting client-side routing and security headers
RUN printf 'server {\n\
    listen 80;\n\
    server_name localhost;\n\
    add_header X-Content-Type-Options "nosniff" always;\n\
    add_header X-Frame-Options "DENY" always;\n\
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;\n\
    add_header Permissions-Policy "camera=(), microphone=(self), geolocation=()" always;\n\
    location / {\n\
        root /usr/share/nginx/html;\n\
        index index.html;\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
