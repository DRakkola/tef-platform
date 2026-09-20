# Reverse Proxy, HTTPS & TLS Architecture

## 1. Overview

In production and staging environments, the FastAPI application (`api:8000`) and the Vite web client (`web:80`) are **never exposed directly to the public internet**. Instead, all ingress traffic terminates at a hardened reverse proxy (Nginx) configured in [`infra/nginx/nginx.production.conf`](file:///C:/Users/MSI/Documents/tef-platform/infra/nginx/nginx.production.conf).

The proxy handles:
1. **TLS Termination**: Enforces TLS 1.2 and TLS 1.3 with modern cipher suites.
2. **HTTP Redirection**: Automatically redirects all port 80 traffic to port 443 HTTPS via `301 Moved Permanently`.
3. **Security Headers**: HSTS, Content-Security-Policy, Permissions-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy.
4. **WebSocket Upgrades**: Transparent proxying of long-lived WebSocket signaling (`/ws/`) for realtime audio events.
5. **Differential Timeouts**: 60-second default read timeout, with a 300-second extended timeout for AI correction pipelines and audio uploads.
6. **Request Limits**: Enforces `client_max_body_size 15M;` to accommodate audio recordings while defending against volumetric denial of service.

---

## 2. Ingress Architecture & Network Flow

```
[ Internet Client ]
       │
       ▼ (HTTPS :443 / HTTP :80)
+─────────────────────────────────────────────────────────────+
|               NGINX REVERSE PROXY (tef-public-net)         |
|  - TLS 1.2 / 1.3 Termination                                |
|  - HSTS / CSP / Security Headers                            |
|  - X-Forwarded-* Headers Injection                          |
+─────────────────────────────────────────────────────────────+
       │                                     │
       │ (HTTP :80 /)                        │ (HTTP :8000 /api/, /ws/)
       ▼                                     ▼
+───────────────────────────+    +────────────────────────────+
|   WEB CONTAINER (React)   |    |    FASTAPI BACKEND (API)   |
|   tef-public-net only     |    |    tef-public-net &        |
+───────────────────────────+    |    tef-internal-net        |
                                 +────────────────────────────+
                                                │
                 ┌──────────────────────────────┼──────────────────────────────┐
                 ▼                              ▼                              ▼
    +────────────────────────+    +────────────────────────+    +────────────────────────+
    |      POSTGRESQL 18     |    |        REDIS 7.4       |    |         MINIO          |
    |    tef-internal-net    |    |    tef-internal-net    |    |    tef-internal-net    |
    |   (NO HOST PORT)       |    |   (NO HOST PORT)       |    |   (NO HOST PORT)       |
    +────────────────────────+    +────────────────────────+    +────────────────────────+
```

---

## 3. Allowed Container Communication Matrix

| Source | Destination | Protocol / Port | Purpose | Network |
|:---|:---|:---|:---|:---|
| Internet | Nginx Proxy | TCP 80, 443 | Public web & API traffic | Public |
| Nginx Proxy | Web Container | TCP 80 (`web:80`) | Static asset delivery | `tef-public-net` |
| Nginx Proxy | API Container | TCP 8000 (`api:8000`) | REST API & WebSocket | `tef-public-net` |
| API Container | PostgreSQL | TCP 5432 (`postgres:5432`) | Domain data persistence | `tef-internal-net` |
| API Container | Redis | TCP 6379 (`redis:6379`) | Cache, rate limiting, presence | `tef-internal-net` |
| API Container | MinIO | TCP 9000 (`minio:9000`) | S3 audio and essay storage | `tef-internal-net` |
| Celery Worker | PostgreSQL | TCP 5432 (`postgres:5432`) | Task persistence & ledger | `tef-internal-net` |
| Celery Worker | Redis | TCP 6379 (`redis:6379`) | Broker (DB 1) & backend (DB 2)| `tef-internal-net` |
| Celery Worker | MinIO | TCP 9000 (`minio:9000`) | Object processing & exports | `tef-internal-net` |
| Celery Worker | External APIs | HTTPS 443 (egress) | Stripe, DeepSeek, OpenAI | Host egress |

---

## 4. TLS Certificate Management (Let's Encrypt / Certbot)

For automated certificate provisioning and renewal:

```bash
# Initial certificate issuance:
certbot certonly --webroot -w /var/www/certbot \
  -d tef-prep.example.com \
  -d app.tef-prep.example.com \
  --email admin@tef-prep.example.com \
  --agree-tos --no-eff-email

# Test renewal:
certbot renew --dry-run
```

Certbot places certificates at `/etc/letsencrypt/live/tef-prep.example.com/`, which is mounted read-only into the proxy container.

---

## 5. Security Header Guarantees

Every response emitted through the proxy carries:

```http
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(self), geolocation=()
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' wss: https:;
```
