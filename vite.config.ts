import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: '/',
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
});
