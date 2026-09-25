/// <reference types="vitest/config" />
import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// https://vite.dev/config/
export default defineConfig(() => {
  // In dev, Vite proxies /api → FastAPI. Change this if your API runs elsewhere.
  const API_TARGET = "http://localhost:8000"

  return {
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    strictPort: false, // fall back to next free port rather than erroring
    proxy: {
      // Proxy all API calls through the dev server — eliminates CORS entirely
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./tests/setup.ts",
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
  },
  }
})
