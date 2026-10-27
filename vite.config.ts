import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// GitHub Pages serves this project from /air-guitar-hero/.
export default defineConfig({
  base: "/air-guitar-hero/",
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "1.0.0"),
    __BUILD_SHA__: JSON.stringify((process.env.GITHUB_SHA ?? "dev").slice(0, 7)),
  },
  build: {
    target: "es2022",
    cssTarget: "chrome111",
  },
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
