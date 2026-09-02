import type { Express } from "express";
import { storageGetSignedUrl } from "../storage";

export function registerStorageProxy(app: Express) {
  // Legacy route: rows seeded before self-hosting may carry /manus-storage/...
  // URLs. Redirect them to the new /storage/* prefix so stored fileUrls keep
  // working, then fall through to the live handler below.
  app.get("/manus-storage/:key(*)", (req, res) => {
    res.redirect(308, `/storage/${req.params.key}`);
  });

  app.get("/storage/:key(*)", async (req, res) => {
    const key = req.params.key;
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    try {
      const url = await storageGetSignedUrl(key);
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage error");
    }
  });
}