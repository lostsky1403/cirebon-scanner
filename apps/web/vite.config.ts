import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: "prompt",
    includeAssets: ["icons/icon.svg"],
    manifest: {
      name: "CPJ Ticket Scanner",
      short_name: "CPJ Scanner",
      description: "Scanner tiket resmi Cirebon Pride Japan",
      theme_color: "#101010",
      background_color: "#f4f0e6",
      display: "standalone",
      orientation: "portrait-primary",
      icons: [{ src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }]
    },
    workbox: {
      navigateFallbackDenylist: [/^\/api/],
      runtimeCaching: [{ urlPattern: /^https?:\/\/[^/]+\/api\//, handler: "NetworkOnly" }]
    }
  })],
  server: { proxy: { "/api": "http://localhost:3001" } }
});
