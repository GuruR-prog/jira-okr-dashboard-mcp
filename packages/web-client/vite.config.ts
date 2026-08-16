import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev convenience only: proxies /api/* to the web-server so the client can
// use relative paths and never worry about CORS in development. In
// production, serve the built client from anywhere and point it at a real
// API origin via VITE_API_BASE (see src/api.ts).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
