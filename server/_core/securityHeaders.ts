import type { NextFunction, Request, Response } from "express";

/**
 * Security headers for every response.
 *
 * The Content-Security-Policy is built from what the client actually loads: scripts and styles
 * from this origin (the build emits no inline scripts), Google Fonts for the typeface, data and
 * blob images for rich-text diagrams and previews, and https frames for the in-page PDF viewer,
 * whose files are served from object storage. `frame-ancestors 'none'` stops the portal being
 * embedded in another site, which is the clickjacking defence for every page, signed-in or not.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "frame-src 'self' https:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https:",
].join("; ");

const PERMISSIONS_POLICY = "camera=(), microphone=(), geolocation=(), payment=(self), usb=()";

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", PERMISSIONS_POLICY);
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  // HSTS only over HTTPS, so a plain-HTTP staging host is not pinned to HTTPS by mistake.
  if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
}

/** Last-resort error handler: logs the detail server-side and returns a generic body. */
export function genericErrorHandler(error: unknown, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(error);
    return;
  }
  console.error("[error]", req.method, req.path, error instanceof Error ? error.message : "unknown error");
  res.status(500).json({ error: "Something went wrong. Please try again." });
}
