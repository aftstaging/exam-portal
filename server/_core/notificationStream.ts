import type { IRouter, Request, Response } from "express";
import { sdk } from "./sdk";

/**
 * Real-time notification channel. Each signed-in browser keeps one Server-Sent Events connection
 * open; the server pushes a `notification` event the moment a notification is stored for that
 * user. The connection is per-process, which matches the single-instance deployment in
 * deploy/aft-portal.service: a notification written by one process reaches every browser attached
 * to that process, and the browser falls back to its normal refetch on reconnect.
 */

type Client = { res: Response };

const HEARTBEAT_MS = 25_000;
const clientsByUser = new Map<number, Set<Client>>();

export function publishToUser(userId: number, event: string, data: unknown): number {
  const clients = clientsByUser.get(userId);
  if (!clients?.size) return 0;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach((client) => client.res.write(payload));
  return clients.size;
}

export function connectedClientCount(userId?: number): number {
  if (userId != null) return clientsByUser.get(userId)?.size ?? 0;
  let total = 0;
  clientsByUser.forEach((set) => { total += set.size; });
  return total;
}

export function registerNotificationStream(app: IRouter) {
  app.get("/api/notifications/stream", async (req: Request, res: Response) => {
    let userId: number;
    try {
      const user = await sdk.authenticateRequest(req);
      userId = user.id;
    } catch {
      res.status(401).json({ error: "Sign in to receive notifications" });
      return;
    }

    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();
    res.write("retry: 5000\n\n");

    const client: Client = { res };
    const set = clientsByUser.get(userId) ?? new Set<Client>();
    set.add(client);
    clientsByUser.set(userId, set);

    const heartbeat = setInterval(() => res.write(": ping\n\n"), HEARTBEAT_MS);
    req.on("close", () => {
      clearInterval(heartbeat);
      set.delete(client);
      if (!set.size) clientsByUser.delete(userId);
    });
  });
}
