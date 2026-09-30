/**
 * The portal is served under a path prefix (`http://host/exam`), not at the domain root, so every
 * generated URL has to carry that prefix: the client router, the tRPC endpoint, static assets and
 * the absolute return URLs handed to PayFast and Stripe.
 *
 * The prefix is configured once, in `APP_BASE_PATH`, and read from three places — the Vite config
 * (asset `base`), the Express app (mount point) and the browser bundle (router + fetch URLs) — so
 * the three can never disagree. An empty or `/` value means "domain root", which is what local
 * development uses.
 */

/**
 * Normalises a configured base path to either an empty string (domain root) or a leading-slash,
 * no-trailing-slash prefix such as `/exam`.
 *
 * Stripping the trailing slash matters: wouter concatenates `base + path` and Express treats a
 * mount path with a trailing slash as a distinct path, so `/exam/` and `/exam` would not match.
 */
export function normalizeBasePath(raw: string | undefined | null): string {
  const value = (raw ?? "").trim();
  if (!value || value === "/") return "";
  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash.replace(/\/+$/, "") : withLeadingSlash;
}

/**
 * Prefixes a root-relative path with the base path, leaving absolute URLs (anything with a scheme
 * or protocol-relative `//`) and already-prefixed paths untouched.
 *
 * A path of `/` becomes the bare prefix, so `withBasePath("/exam", "/")` is `/exam` rather than
 * `/exam/`.
 */
export function withBasePath(basePath: string, path: string): string {
  if (!path || !path.startsWith("/")) return path;
  if (path.startsWith("//")) return path;
  if (!basePath) return path;
  if (path === basePath || path.startsWith(`${basePath}/`)) return path;
  return path === "/" ? basePath : `${basePath}${path}`;
}
