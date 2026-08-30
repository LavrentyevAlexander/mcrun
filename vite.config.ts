import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `/api` proxy target for `npm run dev`. Defaults to the local `vercel dev`
// server so local development never writes to production. Set VITE_API_PROXY
// to hit a deployed environment on purpose (e.g. read-only against prod).
const API_PROXY = process.env.VITE_API_PROXY || "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: API_PROXY,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "node",
  },
});
