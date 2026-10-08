import { useEffect } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { withBasePath } from "@/lib/basePath";

type LiveNotification = { id: number | null; type: string; subject: string; body: string; link: string | null };

/**
 * Keeps a live connection to the server while someone is signed in. A new notification shows as a
 * toast straight away, and the notification, message and profile data are refreshed so the badges
 * and lists update without a reload. The browser reconnects on its own if the connection drops.
 */
export function NotificationListener() {
  const utils = trpc.useUtils();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const signedIn = Boolean(me.data?.id);

  useEffect(() => {
    if (!signedIn || typeof EventSource === "undefined") return;
    const source = new EventSource(withBasePath("/api/notifications/stream"), { withCredentials: true });
    source.addEventListener("notification", (event) => {
      let payload: LiveNotification;
      try {
        payload = JSON.parse((event as MessageEvent).data) as LiveNotification;
      } catch {
        return;
      }
      toast(payload.subject, {
        description: payload.body.length > 160 ? `${payload.body.slice(0, 157)}…` : payload.body,
        duration: 8000,
        action: payload.link ? { label: "Open", onClick: () => { window.location.href = withBasePath(payload.link!); } } : undefined,
      });
      void utils.student.notifications.invalidate();
      void utils.messages.unreadCount.invalidate();
      void utils.messages.conversations.invalidate();
      void utils.messages.thread.invalidate();
      void utils.instructor.dashboard.invalidate();
      void utils.profile.performance.invalidate();
    });
    return () => source.close();
  }, [signedIn, utils]);

  return null;
}
