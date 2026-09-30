import express, { type Express, type IRouter } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

/**
 * `portal` is the express app with the base path already stripped from `req.url`, so every route
 * below is written root-relative. `app` is the unstripped app, used for Vite in development.
 */
export async function setupVite(app: Express, server: Server, portal: IRouter) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  // Vite applies `base` to the raw request path itself, so its middleware is mounted on `app`,
  // where the `/exam` prefix is still on `req.url`. Mounting it on `portal` would hand it a
  // stripped path that no longer matches the base it was built with.
  app.use(vite.middlewares);
  portal.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

/** Serves the built client from `portal`, which already has the base path stripped from `req.url`. */
export function serveStatic(portal: IRouter) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  portal.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  portal.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
