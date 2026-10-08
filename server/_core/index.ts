import "dotenv/config";
import express, { type IRouter, Router } from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { registerNotificationStream } from "./notificationStream";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerStripeWebhook } from "../stripe";
import { registerPayFastITN } from "../payfast";
import { getPayFastGatewaySettings } from "../db";
import { handleAutoSubmit } from "./autoSubmit";
import { APP_BASE_PATH } from "./basePath";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // The app is reached through nginx, so `req.protocol`/`req.ip` only describe the hop to
  // 127.0.0.1. Trusting the proxy makes Express read the client's scheme from X-Forwarded-Proto,
  // which is what the session cookie and the payment return URLs need.
  app.set("trust proxy", true);

  // Every route below is registered on `portal` and written root-relative. Mounting that router
  // under the base path is what lets the app live at /exam while its own routes stay /api/trpc,
  // /admin and so on. With no base path configured the routes are registered on `app` directly,
  // so local development at the domain root behaves exactly as before.
  const portal: IRouter = APP_BASE_PATH ? Router() : app;
  if (APP_BASE_PATH) app.use(APP_BASE_PATH, portal);

  // Registered before the JSON body parser so Stripe's signature check sees the raw body.
  registerStripeWebhook(portal);
  // Configure body parser with larger size limit for file uploads
  portal.use(express.json({ limit: "50mb" }));
  portal.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerPayFastITN(portal, async () => (await getPayFastGatewaySettings()).mode);
  registerStorageProxy(portal);
  registerNotificationStream(portal);
  portal.post("/api/auto-submit", handleAutoSubmit);
  // tRPC API
  portal.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server, portal);
  } else {
    serveStatic(portal);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(
      `Server running on http://localhost:${port}${APP_BASE_PATH || "/"}`
    );
  });
}

startServer().catch(console.error);
