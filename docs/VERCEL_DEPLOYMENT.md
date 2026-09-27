# Vercel Deployment Guide — TEF Platform

This guide explains how to host the TEF Platform frontend on **Vercel** and connect it to your backend API.

---

## 1. Architecture Overview

* **Frontend (`apps/web`)**: React 19 + Vite 8 + Tailwind CSS v4 + React Router v7.  
  👉 **Hosted on Vercel** (Global Edge CDN, automatic HTTPS, preview branches).
* **Backend (`apps/api`)**: Python FastAPI + Celery workers + PostgreSQL + Redis.  
  👉 **Hosted on a container service** such as [Railway](https://railway.app), [Render](https://render.com), [Fly.io](https://fly.io), or a Docker VPS.  
  *(Vercel is a serverless platform for web apps and cannot run persistent Celery/Redis worker processes).*

---

## 2. Quick Deploy on Vercel (2 Minutes)

You can deploy using either of two methods:

### Method A: Deploy from Monorepo Root (Recommended)

Thanks to the root `vercel.json`, Vercel automatically detects the build command and output directory:

1. Push your code to **GitHub** (or GitLab/Bitbucket).
2. Go to [vercel.com/new](https://vercel.com/new) and select your repository.
3. Keep the **Root Directory** as `./` (default).
4. Vercel will automatically read `vercel.json`:
   - **Framework Preset**: `Vite`
   - **Build Command**: `pnpm build` (or leave default)
   - **Output Directory**: `dist` (default)
5. Click **Deploy**.

---

### Method B: Deploy by Setting Root Directory to `apps/web`

If you prefer Vercel to only monitor the frontend directory:

1. Import your repository on [vercel.com/new](https://vercel.com/new).
2. In the configuration screen, click **Edit** next to **Root Directory**.
3. Select `apps/web`.
4. Vercel will configure:
   - **Framework Preset**: `Vite`
   - **Build Command**: `pnpm build` (or `vite build`)
   - **Output Directory**: `dist`
5. Click **Deploy**.

---

## 3. Connecting Frontend to the Backend API (Render)

There are two primary ways to connect your Vercel frontend to your deployed backend API on **Render**:

### Option 1: Direct Environment Variable (`VITE_API_URL` ⭐ Recommended for WebSockets)

If your backend is live on Render (e.g. `https://tef-api.onrender.com`):

1. In Vercel, navigate to **Settings** → **Environment Variables**.
2. Add:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://tef-api.onrender.com/api/v1`
   - **Environments**: Production, Preview, Development
3. (Optional) If you use a custom WebSocket domain, you can also specify:
   - **Key**: `VITE_WS_URL`
   - **Value**: `wss://tef-api.onrender.com/api/v1`
   *(If omitted, the platform automatically derives `wss://...` directly from `VITE_API_URL`).*
4. In your Render `tef-api` dashboard, configure `CORS_ORIGINS`:
   ```json
   ["https://your-tef-app.vercel.app"]
   ```

---

### Option 2: Vercel Reverse Proxy Rewrite (Zero-CORS for HTTP)

You can have Vercel forward `/api/*` HTTP requests to your Render backend to eliminate CORS preflight overhead and simplify cookie sharing:

In `vercel.json` (or `apps/web/vercel.json`), add the backend destination before the SPA fallback:

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

> [!IMPORTANT]
> **WebSockets & Vercel Rewrites**: Vercel Serverless/Edge rewrites **do not support WebSockets**.
> If you choose Option 2 for HTTP rewrites, you **must set `VITE_WS_URL`** in Vercel Environment Variables:
> - **Key**: `VITE_WS_URL`
> - **Value**: `wss://tef-api.onrender.com/api/v1`
> This ensures that real-time live oral exams (Gemini Live and WebRTC signaling) connect directly to Render while standard HTTP requests route through the Vercel proxy.

---

## 4. Single-Page Application (SPA) Routing

In client-side routers like React Router, refreshing the page on routes like `/dashboard`, `/admin/ai-studio/scenarios`, or `/speaking` would normally return a `404 Not Found` on static hosts.

Both `vercel.json` and `apps/web/vercel.json` include the rewrite rule:

```json
{
  "source": "/(.*)",
  "destination": "/index.html"
}
```

This routes all navigation to `index.html` so React Router handles the URL cleanly on every refresh.

---

## 5. Summary of Environment Variables

| Variable | Required? | Example / Default | Description |
| :--- | :--- | :--- | :--- |
| `VITE_API_URL` | Optional | `https://tef-api.onrender.com/api/v1` | Base URL for REST API calls. If omitted, uses relative `/api/v1`. |
| `VITE_WS_URL` | Optional | `wss://tef-api.onrender.com/api/v1` | Base URL for WebSockets (Gemini Live Examiner, Oral practice signaling). |
| `NODE_VERSION` | Optional | `20.x` or `22.x` | Node.js runtime version in Vercel project settings. |

---

## 6. Verification Checklist

- [x] Root `package.json` contains `"build": "pnpm --filter web build"`.
- [x] Node engine compatibility set to `>=20.0.0`.
- [x] Root `vercel.json` and `apps/web/vercel.json` configured for SPA routing.
- [x] `apps/web/src/core/config.ts` defaults to relative `/api/v1` with `VITE_API_URL` override.
