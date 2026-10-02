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

  // `vite.config.ts` exports a function rather than an object, because it reads `APP_BASE_PATH` for
  // the current mode and builds the config from it. Spreading that function silently produces `{}`,
  // and `configFile: false` below stops Vite from loading the real file, so the dev server would
  // start with no `root`, no `@shared` alias, no React plugin and no Tailwind: every `/src` asset
  // would 404 and the app would never boot. The function has to be called to get what it builds.
  const resolved = await viteConfig({ mode: "development", command: "serve" });

  const vite = await createViteServer({
    ...resolved,
    configFile: false,
    // Middleware mode replaces Vite's listen options, but the `fs` allowlist has to survive: it is
    // what decides whether `/src/main.tsx` and the `@shared` modules under it may be served.
    server: { ...resolved.server, ...serverOptions },
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
