import type { Request } from "express";
import { normalizeBasePath } from "../../shared/basePath";

/**
 * The prefix the app is mounted under, from `APP_BASE_PATH` (`/exam` in production, empty in local
 * development). Read from the environment rather than the build so a deployment can move the portal
 * by changing one value and restarting.
 */
export const APP_BASE_PATH = normalizeBasePath(process.env.APP_BASE_PATH);

/** Builds a mount path for a route the app owns, e.g. `/exam/api/trpc`. */
export function appPath(routePath: string): string {
  if (!APP_BASE_PATH) return routePath;
  if (!routePath.startsWith("/")) return `${APP_BASE_PATH}/${routePath}`;
  return routePath === "/" ? `${APP_BASE_PATH}/` : `${APP_BASE_PATH}${routePath}`;
}

/**
 * The externally visible origin of a request, including the base path, used to build the absolute
 * return/notify URLs handed to PayFast and Stripe.
 *
 * `req.protocol` only reports the scheme seen by Node, which is `http` behind a TLS-terminating
 * proxy unless `trust proxy` is set, so `x-forwarded-proto` is consulted first.
 */
export function publicOrigin(req: Request): string {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protoHeader = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  const protocol = (protoHeader?.split(",")[0]?.trim() || req.protocol || "http").toLowerCase();
  const host = req.get("host") ?? "localhost";
  return `${protocol}://${host}${APP_BASE_PATH}`;
}
