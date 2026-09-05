import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true,
    port: 9003,
  },
  preview: {
    host: true,
    port: 9003,
  },
  plugins: [cloudflare({ inspectorPort: false })],
});
