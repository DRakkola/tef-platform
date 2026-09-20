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
   - **Build Command**: `pnpm --filter web build`
   - **Output Directory**: `apps/web/dist`
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

## 3. Connecting Frontend to the Backend API

There are two ways to connect your Vercel frontend to your deployed backend API:

### Option 1: Vercel Reverse Proxy Rewrite (Zero CORS! ⭐ Recommended)

You can have Vercel transparently forward `/api/*` requests to your backend. The browser communicates with `https://your-app.vercel.app/api/...`, eliminating all CORS issues and cookie sharing restrictions.

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
      "destination": "https://api-production.up.railway.app/api/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Replace `https://api-production.up.railway.app` with your actual backend URL.

---

### Option 2: Environment Variable (`VITE_API_URL`)

If your backend is on a separate domain (e.g., `https://api.tef-prep.com`) and has CORS configured to accept requests from your Vercel domain:

1. In Vercel, go to **Settings** → **Environment Variables**.
2. Add:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://api.tef-prep.com/api/v1`
   - **Environments**: Production, Preview, Development
3. Redeploy your project.

---

## 4. Single-Page Application (SPA) Routing

In client-side routers like React Router, refreshing the page on routes like `/dashboard`, `/practice`, or `/settings` would normally return a `404 Not Found` on static hosts.

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
| `VITE_API_URL` | Optional | `/api/v1` (default) | Base URL for API calls. If omitted, uses relative `/api/v1` (best with Vercel rewrites). |
| `NODE_VERSION` | Optional | `20.x` or `22.x` | Node.js runtime version in Vercel project settings. |

---

## 6. Verification Checklist

- [x] Root `package.json` contains `"build": "pnpm --filter web build"`.
- [x] Node engine compatibility set to `>=20.0.0`.
- [x] Root `vercel.json` and `apps/web/vercel.json` configured for SPA routing.
- [x] `apps/web/src/core/config.ts` defaults to relative `/api/v1` with `VITE_API_URL` override.
