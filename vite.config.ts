import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Portal administrador",
        short_name: "Portal administrador",
        description: "Gestiona clientes y servicios desde un solo lugar.",
        lang: "es",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#0f172a",
        background_color: "#18181b",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      // In dev, /api/* requests are forwarded to the Express backend
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
