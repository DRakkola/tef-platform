# Render Deployment Guide — TEF Platform

This guide explains how to deploy the entire TEF Platform backend stack (FastAPI, Celery Worker, PostgreSQL, and Redis) on **[Render](https://render.com)** using **Render Blueprints (`render.yaml`)**.

---

## 1. Architecture on Render

Render provides native support for containerized web services, background workers, and managed data stores:

| Component | Render Service Type | Details |
| :--- | :--- | :--- |
| **`tef-api`** | Web Service (Docker) | FastAPI application handling HTTP endpoints, authentication, exam engine, and WebSockets. Runs on port `8000`. |
| **`tef-celery-worker`** | Background Worker (Docker) | Processes asynchronous scoring, exam completion evaluations, and maintenance tasks. |
| **`tef-postgres`** | Managed PostgreSQL (v16) | High-performance relational database with automated backups. |
| **`tef-redis`** | Managed Redis | In-memory store used as the Celery task broker and application cache. |

*(For the frontend, we recommend hosting on **Vercel** via [docs/VERCEL_DEPLOYMENT.md](file:///C:/Users/MSI/Documents/tef-platform/docs/VERCEL_DEPLOYMENT.md) for global Edge CDN performance, and pointing it to your Render backend).*

---

## 2. Quick Deploy with Render Blueprints (One-Click IaC)

The repository includes a production-ready `render.yaml` blueprint specification at the root of the project.

### Step 1: Push Code to GitHub / GitLab
Make sure your repository has `render.yaml` committed:
```bash
git add render.yaml apps/api/app/core/config.py docs/RENDER_DEPLOYMENT.md
git commit -m "feat(deploy): configure Render blueprint and database url compatibility"
git push origin main
```

### Step 2: Create a New Blueprint on Render
1. Log in to your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** at the top right and select **Blueprint**.
3. Connect your GitHub/GitLab repository.
4. Render will automatically parse `render.yaml` and display the resources it will create:
   - `tef-api` (Web Service)
   - `tef-celery-worker` (Background Worker)
   - `tef-postgres` (PostgreSQL Database)
   - `tef-redis` (Redis Instance)

### Step 3: Configure Environment Variables
During blueprint initialization, Render will prompt you for any un-synced variables:
- **`CORS_ORIGINS`**: Enter your frontend domain as a JSON list, for example:
  ```json
  ["https://tef-platform.vercel.app", "http://localhost:5173"]
  ```
- **`SECRET_KEY`**: Render will auto-generate a secure random 32+ character string.
- **`DATABASE_URL` & `REDIS_URL`**: Render links these automatically via internal VPC connection strings.

### Step 4: Click "Apply"
Render will:
1. Provision PostgreSQL and Redis in your private network.
2. Build the Docker images for `tef-api` and `tef-celery-worker`.
3. Run `preDeployCommand: alembic upgrade head` to apply all database migrations.
4. Launch the web service and worker.
5. Verify health via `/health/live`.

Your API will be live at:
`https://tef-api.onrender.com`

---

## 3. Database URL & Asyncpg Automatic Compatibility

Render generates PostgreSQL connection strings in the format:
```text
postgres://tef_app:password@dpg-xxxx-a:5432/tef_platform
# or
postgresql://tef_app:password@dpg-xxxx-a:5432/tef_platform
```

SQLAlchemy 2.0 with asynchronous I/O requires the `postgresql+asyncpg://` dialect.

The TEF Platform backend automatically detects this in `apps/api/app/core/config.py`:
- Incoming `postgres://` or `postgresql://` URIs from Render are automatically normalized to `postgresql+asyncpg://`.
- No manual editing of the connection string or environment variable is required!

---

## 4. Connecting Vercel Frontend to Render Backend

Once your backend is live on Render (e.g., `https://tef-api.onrender.com`), connect your frontend hosted on Vercel using one of the following methods:

### Option A: Zero-CORS Reverse Proxy Rewrite in `vercel.json` (Recommended)

In your root `vercel.json` or `apps/web/vercel.json`, set the destination of `/api/:path*` to your Render API URL:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "pnpm --filter web build",
  "outputDirectory": "apps/web/dist",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://tef-api.onrender.com/api/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

**Benefits**:
- Zero CORS preflight latency.
- No third-party cookie blocking issues.
- Frontend code simply calls `/api/v1/...`.

### Option B: Environment Variable `VITE_API_URL`

In your Vercel Project Settings under **Environment Variables**, set:
- **`VITE_API_URL`**: `https://tef-api.onrender.com/api/v1`

Ensure your Render `tef-api` service has your Vercel domain added to `CORS_ORIGINS`:
```json
["https://tef-platform.vercel.app"]
```

---

## 5. Environment Variables Reference

| Variable | Service | Source | Description |
| :--- | :--- | :--- | :--- |
| `ENVIRONMENT` | Web & Worker | `production` | Sets application mode to production. |
| `PORT` | Web | `8000` | HTTP port exposed by FastAPI container. |
| `DATABASE_URL` | Web & Worker | `fromDatabase: tef-postgres` | PostgreSQL connection string (auto-normalized to `asyncpg`). |
| `REDIS_URL` | Web & Worker | `fromService: tef-redis` | Internal Redis connection string. |
| `SECRET_KEY` | Web & Worker | `generateValue: true` | Cryptographic key for JWT tokens and session signing (min 32 chars). |
| `CORS_ORIGINS` | Web | User Input | Allowed frontend origins (JSON array, e.g. `["https://tef-platform.vercel.app"]`). |
| `COOKIE_SAMESITE` | Web | `lax` or `none` | Use `lax` if using Vercel proxy rewrite or shared domain; use `none` if cross-domain cookies are required. |
| `GEMINI_API_KEY` | Web & Worker | User Input | Google Gemini API key for real-time virtual examiner & oral evaluations. |
| `OPENAI_API_KEY` | Web & Worker | User Input | OpenAI API key (optional for writing evaluations). |
| `DEEPSEEK_API_KEY` | Web & Worker | User Input | DeepSeek API key (optional for writing evaluations). |
| `STORAGE_BUCKET_NAME` | Web & Worker | `tef-private` | S3 / MinIO storage bucket name for audio recordings & documents. |
| `STORAGE_ENDPOINT` | Web & Worker | `s3.amazonaws.com` | S3 endpoint or Cloudflare R2 / MinIO URL. |
| `STORAGE_ACCESS_KEY` | Web & Worker | User / Auto | S3 access key ID. |
| `STORAGE_SECRET_KEY` | Web & Worker | User / Auto | S3 secret access key. |
| `STORAGE_USE_SSL` | Web & Worker | `true` | Enables TLS for S3 / Cloudflare R2 object storage. |

---

## 6. Maintenance & Troubleshooting

### Viewing Logs
- In the Render Dashboard, click `tef-api` or `tef-celery-worker` and navigate to the **Logs** tab to view real-time stdout/stderr.

### Running Ad-hoc Migrations / Shell
- In the `tef-api` service, click the **Shell** tab to open an interactive terminal in the container:
  ```bash
  # Check migration status
  alembic current
  
  # Run a custom command
  python -m app.core.celery_app inspect ping
  ```

### Health Checks
- Render pings `/health/live` every few seconds to verify the container is healthy and serving requests. If a deployment fails health checks, Render keeps the previous version running to ensure zero downtime.
