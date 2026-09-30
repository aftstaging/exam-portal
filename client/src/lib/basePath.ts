import { normalizeBasePath } from "@shared/basePath";

/**
 * The prefix the portal is served under (`/exam` in production, empty at the domain root).
 *
 * Vite injects `import.meta.env.BASE_URL` from the `base` it built with, so reading the prefix back
 * from there keeps the browser bundle in step with the build and the Express app without a second
 * variable to keep in sync.
 */
export const APP_BASE_PATH = normalizeBasePath(import.meta.env.BASE_URL);

/** Prefixes a root-relative path (an asset, an API URL, a route) with the portal's base path. */
export function withBasePath(path: string): string {
  if (!path || !path.startsWith("/")) return path;
  if (path.startsWith("//")) return path;
  if (!APP_BASE_PATH) return path;
  if (path === APP_BASE_PATH || path.startsWith(`${APP_BASE_PATH}/`)) return path;
  return path === "/" ? APP_BASE_PATH : `${APP_BASE_PATH}${path}`;
}

/** The absolute URL of a route on this origin, e.g. `/exam/admin`. */
export function absoluteUrl(path: string): string {
  if (typeof window === "undefined") return withBasePath(path);
  return new URL(withBasePath(path), window.location.origin).toString();
}
