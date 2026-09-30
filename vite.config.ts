import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import { normalizeBasePath } from "./shared/basePath";

export default defineConfig(({ mode }) => {
  // Vite's own mode is used rather than NODE_ENV, so `APP_BASE_PATH` can be set per mode (in
  // `.env.production`, say) and still reach the build that needs it.
  const env = loadEnv(mode, import.meta.dirname, "");
  const basePath = normalizeBasePath(env.APP_BASE_PATH);
  return {
  // Vite wants a trailing slash so that `base` can be concatenated with a root-relative asset
  // path. The prefix is shared with the Express app and the browser bundle via `APP_BASE_PATH`.
  base: `${basePath}/`,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react/') || 
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/react/jsx-runtime') ||
              id.includes('node_modules/scheduler/')) {
            return 'react-vendor';
          }
          if (id.includes('@radix-ui')) {
            return 'radix';
          }
          if (id.includes('recharts') || id.includes('d3-')) {
            return 'charts';
          }
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
  server: {
    host: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  };
});
