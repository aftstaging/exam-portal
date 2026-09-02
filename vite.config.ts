import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
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
          if (!id.includes("node_modules")) return;
          if (id.includes("pdf-lib") || id.includes("streamdown")) return "pdf";
          if (id.includes("recharts") || id.includes("/d3-")) return "charts";
          if (id.includes("framer-motion") || id.includes("/motion/")) return "motion";
          if (id.includes("@radix-ui")) return "radix";
          if (
            id.includes("/react/") ||
            id.includes("react-dom") ||
            id.includes("react-hook-form") ||
            id.includes("react-day-picker") ||
            id.includes("@tanstack") ||
            id.includes("@trpc") ||
            id.includes("superjson") ||
            id.includes("wouter")
          ) {
            return "react-vendor";
          }
          return "vendor";
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
