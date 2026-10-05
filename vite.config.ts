import react from "@vitejs/plugin-react";
import {
  defineConfig,
} from "vite";

export default defineConfig({
  plugins: [
    react(),
  ],

  /*
   * Development keeps the browser on one origin:
   *
   * Vite:
   *   http://localhost:5173
   *
   * /api requests are forwarded to the local Express API.
   *
   * Production does not use this proxy because Express
   * serves both the frontend and API from the same origin.
   */
  server: {
    proxy: {
      "/api": {
        target:
          "http://127.0.0.1:8787",

        changeOrigin:
          false,
      },
    },
  },
});
