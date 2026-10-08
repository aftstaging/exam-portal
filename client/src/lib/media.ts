import { withBasePath } from "@/lib/basePath";

/**
 * Resolves a stored media path (a product image, a profile photo) into a URL the browser can load.
 *
 * Uploaded files are stored as root-relative `/storage/<key>` paths. The storage route is mounted
 * under the portal's base path (`/exam`), so the bare path points outside the portal and the image
 * breaks. Prefixing it here keeps every image on the same path as the rest of the app. Absolute
 * URLs (https://…, data:…) are returned unchanged.
 */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  return withBasePath(path.startsWith("/") ? path : `/${path}`);
}

/** Reads a File as a data URL, the form the upload procedures accept. */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the selected file"));
    reader.readAsDataURL(file);
  });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function formatShortDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export function initialsFor(name: string | null | undefined, email?: string | null): string {
  const source = (name ?? "").trim() || (email ?? "").split("@")[0] || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]![0] : "")).toUpperCase() || "?";
}
