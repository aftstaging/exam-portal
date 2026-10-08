import type { IRouter } from "express";
import { storageGetSignedUrl } from "../storage";
import { sdk } from "./sdk";
import { canReadStorageKey } from "./storageAccess";

/**
 * Serves a stored object through a short-lived signed URL, but only to a viewer entitled to it.
 * Authorisation is decided by `canReadStorageKey`; a denial is a plain 404 so the response does not
 * reveal whether the key exists.
 */
export function registerStorageProxy(app: IRouter) {
  app.get("/storage/:key(*)", async (req, res) => {
    const key = req.params.key;
    if (!key) {
      res.status(404).send("Not found");
      return;
    }

    let viewer: { id: number; role: string } | null = null;
    try {
      const user = await sdk.authenticateRequest(req);
      viewer = { id: user.id, role: user.role };
    } catch {
      viewer = null;
    }

    try {
      if (!(await canReadStorageKey(viewer, key))) {
        res.status(404).send("Not found");
        return;
      }
      const url = await storageGetSignedUrl(key);
      res.set("Cache-Control", "private, no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err instanceof Error ? err.message : "unknown error");
      res.status(502).send("Storage error");
    }
  });
}
