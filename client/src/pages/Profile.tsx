import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Bell, FileText, Loader2, MessageSquare, Send, UserRound, BarChart3 } from "lucide-react";
import { PublicHeader } from "@/components/PortalHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProfileEditor } from "@/components/ProfileEditor";
import { EmptyState, PersonAvatar, ScoreTrend, StatCard } from "@/components/PortalUi";
import { trpc } from "@/lib/trpc";
import { formatDateTime, formatShortDate } from "@/lib/media";
import { withBasePath } from "@/lib/basePath";
import { startLogin } from "@/const";

type Tab = "profile" | "performance" | "messages" | "notifications";

/** The learner dashboard sections, linked from the profile. Slugs match `DASHBOARD_TAB_SLUGS`. */
const DASHBOARD_LINKS = [
  { slug: "overview", label: "Overview" },
  { slug: "products", label: "My products" },
  { slug: "attempts", label: "Saved attempts" },
  { slug: "results", label: "Results" },
] as const;
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "profile", label: "Profile", icon: <UserRound className="h-4 w-4" /> },
  { id: "performance", label: "Submissions & performance", icon: <BarChart3 className="h-4 w-4" /> },
  { id: "messages", label: "Messages", icon: <MessageSquare className="h-4 w-4" /> },
  { id: "notifications", label: "Notifications", icon: <Bell className="h-4 w-4" /> },
];

export default function Profile() {
  const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const initialTab = (params.get("tab") as Tab | null) ?? (params.get("attempt") ? "performance" : "profile");
  const [tab, setTab] = useState<Tab>(TABS.some((item) => item.id === initialTab) ? initialTab : "profile");
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const signedIn = Boolean(me.data);
  const profile = trpc.profile.me.useQuery(undefined, { enabled: signedIn, retry: false });
  const unread = trpc.messages.unreadCount.useQuery(undefined, { enabled: signedIn, retry: false, refetchInterval: 30_000 });

  if (me.isLoading) return <Shell><div className="py-24 text-center text-[#c4b5fd]"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div></Shell>;
  if (!signedIn) {
    return (
      <Shell>
        <Card className="mx-auto mt-16 max-w-lg border-white/10 bg-[#120730]"><CardContent className="p-8 text-center">
          <h1 className="text-2xl font-bold text-white">Sign in to see your profile</h1>
          <p className="mt-3 text-[#c4b5fd]">Your profile, submission history and messages are private to your account.</p>
          <Button className="aft-button mt-6" onClick={() => startLogin("login")}>Sign in</Button>
        </CardContent></Card>
      </Shell>
    );
  }
  if (profile.isLoading || !profile.data) return <Shell><div className="py-24 text-center text-[#c4b5fd]"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div></Shell>;

  const data = profile.data;
  const pick = (next: Tab) => {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url.toString());
  };

  return (
    <Shell>
      <main className="container py-10">
        <div className="flex flex-wrap items-center gap-5">
          <PersonAvatar name={data.user.name} email={data.user.email} src={data.profile.avatarUrl} size={88} />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">My profile</p>
            <h1 className="mt-1 truncate text-3xl font-bold text-white">{data.user.name ?? data.user.email}</h1>
            <p className="text-sm text-[#c4b5fd]">{data.profile.headline ?? "Learner"} · member since {formatShortDate(data.user.createdAt)}</p>
          </div>
          <Link href="/dashboard"><Button variant="outline" className="border-[#00e5ff] text-white">Back to dashboard</Button></Link>
        </div>

        {data.user.role === "user" && (
          <Card className="mt-8 border-white/10 bg-[#120730]">
            <CardContent className="flex flex-wrap items-center gap-3 p-5">
              <span className="mr-2 text-sm font-semibold text-[#c4b5fd]">Dashboard</span>
              {DASHBOARD_LINKS.map((item) => (
                <Link key={item.slug} href={`/dashboard?tab=${item.slug}`}>
                  <Button variant="outline" className="border-[#00ff88]/40 text-white hover:border-[#00ff88] hover:text-[#00ff88]">{item.label}</Button>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="mt-8 flex gap-2 overflow-auto border-b border-white/10">
          {TABS.map((item) => (
            <button key={item.id} onClick={() => pick(item.id)} className={`tab-button flex items-center gap-2 ${tab === item.id ? "tab-active" : ""}`}>
              {item.icon} {item.label}
              {item.id === "messages" && (unread.data ?? 0) > 0 && <span className="ml-1 rounded-full bg-[#00ff88] px-2 text-xs font-bold text-[#0c0524]">{unread.data}</span>}
            </button>
          ))}
        </div>

        <div className="mt-8">
          {tab === "profile" && <ProfileEditor data={data} role={data.user.role} />}
          {tab === "performance" && <PerformancePanel />}
          {tab === "messages" && <MessagesPanel />}
          {tab === "notifications" && <NotificationsPanel />}
        </div>
      </main>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#0c0524]"><PublicHeader onLogin={() => startLogin("login")} />{children}</div>;
}

function PerformancePanel() {
  const performance = trpc.profile.performance.useQuery(undefined, { retry: false, refetchInterval: 30_000 });
  const [openAttempt, setOpenAttempt] = useState<number | null>(() => {
    const value = new URLSearchParams(window.location.search).get("attempt");
    return value ? Number(value) : null;
  });
  if (performance.isLoading) return <Loader />;
  const data = performance.data;
  if (!data) return <EmptyState title="Performance unavailable" body="We could not load your submissions. Refresh the page to try again." />;
  const { summary, history, supervisor } = data;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Submitted" value={summary.submitted} hint="Locked exam attempts" tone="cyan" />
        <StatCard label="Marked" value={summary.marked} hint="With released feedback" />
        <StatCard label="Awaiting marking" value={summary.awaitingMarking} tone="amber" />
        <StatCard label="Average score" value={summary.averagePercent != null ? `${summary.averagePercent}%` : "—"} tone="lavender" />
        <StatCard label="Best score" value={summary.bestPercent != null ? `${summary.bestPercent}%` : "—"} />
        <StatCard label="Pass rate" value={summary.passRate != null ? `${summary.passRate}%` : "—"} hint="Scores of 50% or more" tone="cyan" />
      </div>

      <Card className="border-white/10 bg-[#120730]">
        <CardHeader><CardTitle className="text-white">Score trend</CardTitle></CardHeader>
        <CardContent><ScoreTrend points={summary.trend} /></CardContent>
      </Card>

      <Card className="border-white/10 bg-[#120730]">
        <CardHeader><CardTitle className="flex items-center gap-2 text-white"><FileText className="h-5 w-5 text-[#00e5ff]" /> Submission history</CardTitle></CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <EmptyState title="No submissions yet" body="Locked exam attempts and their marks will be listed here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-white/45">
                  <tr><th className="py-3 pr-4">Exam</th><th className="py-3 pr-4">Mode</th><th className="py-3 pr-4">Submitted</th><th className="py-3 pr-4">Status</th><th className="py-3 pr-4">Score</th><th className="py-3 pr-4">Feedback</th><th className="py-3" /></tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {history.map((row) => (
                    <tr key={row.attemptId} className="text-[#e9e4ff]">
                      <td className="py-3 pr-4 font-semibold text-white">{row.examTitle}</td>
                      <td className="py-3 pr-4 capitalize">{row.mode}</td>
                      <td className="py-3 pr-4">{formatDateTime(row.submittedAt ?? row.startedAt)}</td>
                      <td className="py-3 pr-4"><StatusPill label={row.statusLabel} /></td>
                      <td className="py-3 pr-4 font-bold text-[#00ff88]">{row.percent != null ? `${row.percent}%` : "—"}</td>
                      <td className="py-3 pr-4">{row.visibleCommentCount ? `${row.visibleCommentCount} comment${row.visibleCommentCount === 1 ? "" : "s"}` : "—"}</td>
                      <td className="py-3 text-right"><Button size="sm" variant="outline" className="border-[#00e5ff] text-[#00e5ff]" onClick={() => setOpenAttempt(row.attemptId)}>View</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {supervisor && <Card className="border-white/10 bg-[#120730]"><CardContent className="flex flex-wrap items-center gap-4 p-5"><PersonAvatar name={supervisor.name} email={supervisor.email} src={supervisor.avatarUrl} size={56} /><div><div className="text-xs uppercase tracking-wider text-white/45">Your supervising instructor</div><div className="text-lg font-bold text-white">{supervisor.name ?? supervisor.email}</div><div className="text-sm text-[#c4b5fd]">{supervisor.headline ?? "Instructor"}</div></div></CardContent></Card>}

      <Dialog open={openAttempt != null} onOpenChange={(open) => !open && setOpenAttempt(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto border-white/10 bg-[#120730] text-white">
          <DialogHeader><DialogTitle className="text-white">Submission details</DialogTitle></DialogHeader>
          {openAttempt != null && <SubmissionDetail attemptId={openAttempt} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SubmissionDetail({ attemptId }: { attemptId: number }) {
  const detail = trpc.profile.submission.useQuery({ attemptId }, { retry: false });
  if (detail.isLoading) return <Loader />;
  if (!detail.data) return <p className="text-sm text-[#c4b5fd]">This submission could not be loaded.</p>;
  const d = detail.data;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-bold text-white">{d.examTitle}</h3>
        <StatusPill label={d.statusLabel} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 p-4"><div className="text-xs uppercase text-white/45">Submitted</div><div className="mt-1 font-semibold text-white">{formatDateTime(d.submittedAt)}</div></div>
        <div className="rounded-xl border border-white/10 p-4"><div className="text-xs uppercase text-white/45">Score</div><div className="mt-1 font-semibold text-[#00ff88]">{d.percent != null ? `${d.percent}% (${d.awardedPoints}/${d.totalPoints})` : "Not yet released"}</div></div>
        <div className="rounded-xl border border-white/10 p-4"><div className="text-xs uppercase text-white/45">Marked</div><div className="mt-1 font-semibold text-white">{d.markedAt ? formatDateTime(d.markedAt) : "—"}</div></div>
      </div>
      {d.feedback && (
        <div className="rounded-xl border border-[#00e5ff]/30 bg-[#102b36] p-4">
          <div className="font-bold text-white">Marker feedback</div>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#e9e4ff]">{d.feedback}</p>
        </div>
      )}
      {d.markedFiles.length > 0 && (
        <div className="rounded-xl border border-white/10 p-4">
          <div className="font-bold text-white">Marked script</div>
          <ul className="mt-2 divide-y divide-white/10">
            {d.markedFiles.map((file) => (
              <li key={file.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                <span className="text-[#e9e4ff]">{file.fileName}</span>
                <a href={file.url} target="_blank" rel="noreferrer" className="font-semibold text-[#00ff88] hover:underline">Download</a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {d.comments.length > 0 && (
        <div className="space-y-3">
          <div className="font-bold text-white">Comments from your instructor</div>
          {d.comments.map((comment) => (
            <div key={comment.id} className="rounded-xl border border-white/10 bg-[#0c0524]/60 p-4">
              <div className="text-xs text-white/45">{comment.authorName} · {formatDateTime(comment.createdAt)}</div>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#e9e4ff]">{comment.body}</p>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-3">
        <div className="font-bold text-white">Your answers</div>
        {d.answers.length === 0 && <p className="text-sm text-[#c4b5fd]">No answers were saved for this attempt.</p>}
        {d.answers.map((answer) => (
          <div key={answer.sectionId} className="rounded-xl border border-white/10 p-4">
            <div className="flex items-center justify-between text-sm"><span className="font-semibold text-white">{answer.title}</span><span className="text-white/45">{answer.wordCount} words</span></div>
            <div className="mt-2 max-h-60 overflow-y-auto whitespace-pre-line text-sm leading-6 text-[#e9e4ff]">{stripHtml(answer.body) || "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MessagesPanel() {
  const utils = trpc.useUtils();
  const performance = trpc.profile.performance.useQuery(undefined, { retry: false, refetchInterval: 30_000 });
  const supervisor = performance.data?.supervisor ?? null;
  const thread = trpc.messages.thread.useQuery({ partnerId: supervisor?.id ?? 0 }, { enabled: Boolean(supervisor), retry: false, refetchInterval: 15_000 });
  const [draft, setDraft] = useState("");
  const send = trpc.messages.send.useMutation({
    onSuccess: () => {
      setDraft("");
      utils.messages.thread.invalidate();
      utils.messages.conversations.invalidate();
      utils.messages.unreadCount.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  if (performance.isLoading) return <Loader />;
  if (!supervisor) {
    return <EmptyState title="No supervising instructor yet" body="When an instructor is assigned to you, you can message them here. Messages from your instructor appear in this tab and in your email." />;
  }
  return (
    <Card className="border-white/10 bg-[#120730]">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-white">
          <PersonAvatar name={supervisor.name} email={supervisor.email} src={supervisor.avatarUrl} size={40} />
          <span>Conversation with {supervisor.name ?? "your instructor"}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-xl border border-white/10 bg-[#0c0524]/60 p-4">
          {thread.isLoading && <Loader />}
          {thread.data?.length === 0 && <p className="text-center text-sm text-[#c4b5fd]">No messages yet. Say hello to your instructor.</p>}
          {thread.data?.map((message) => (
            <div key={message.id} className={`flex ${message.fromMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-6 ${message.fromMe ? "bg-[#00ff88] text-[#0c0524]" : "bg-[#18093c] text-white"}`}>
                <div className="whitespace-pre-line">{message.body}</div>
                <div className={`mt-1 text-[10px] ${message.fromMe ? "text-[#0c0524]/60" : "text-white/40"}`}>{formatDateTime(message.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
        <form className="flex gap-3" onSubmit={(event) => { event.preventDefault(); if (draft.trim()) send.mutate({ recipientId: supervisor.id, body: draft.trim() }); }}>
          <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={2} maxLength={5000} placeholder="Write a message to your instructor…" className="border-white/10 bg-[#0c0524] text-white" />
          <Button type="submit" className="aft-button h-auto" disabled={!draft.trim() || send.isPending}>{send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}<span className="sr-only">Send</span></Button>
        </form>
      </CardContent>
    </Card>
  );
}

function NotificationsPanel() {
  const utils = trpc.useUtils();
  const list = trpc.student.notifications.useQuery(undefined, { retry: false });
  const markRead = trpc.student.markNotificationRead.useMutation({ onSuccess: () => utils.student.notifications.invalidate() });
  if (list.isLoading) return <Loader />;
  const items = list.data ?? [];
  if (!items.length) return <EmptyState title="No notifications" body="Purchases, marking results, instructor comments and messages will appear here as they happen, and are also emailed to you." />;
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <button key={item.id} type="button" onClick={() => { if (!item.readAt) markRead.mutate({ notificationId: item.id }); if (item.link) window.location.href = withBasePath(item.link); }} className={`w-full rounded-xl border p-4 text-left transition hover:border-[#00ff88]/50 ${item.readAt ? "border-white/10 bg-[#120730]" : "border-[#00e5ff]/40 bg-[#102b36]"}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-bold text-white">{item.subject}</div>
              <div className="mt-1 whitespace-pre-line text-sm text-[#c4b5fd]">{item.body}</div>
            </div>
            <div className="shrink-0 text-right text-xs text-white/45">
              <div>{formatDateTime(item.createdAt)}</div>
              {item.emailedAt && <div className="mt-1 text-[#00ff88]">Emailed</div>}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function StatusPill({ label }: { label: string }) {
  const tone = label === "Marked" ? "text-[#00ff88] border-[#00ff88]/50" : label === "Awaiting marking" || label === "Being marked" ? "text-[#f4c44e] border-[#f4c44e]/50" : "text-[#00e5ff] border-[#00e5ff]/50";
  return <span className={`inline-block rounded-full border px-3 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>;
}

function Loader() {
  return <div className="py-10 text-center text-[#c4b5fd]"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;
}

/** Answers are stored as rich-text HTML; this turns them into plain text for the read-only view. */
function stripHtml(html: string): string {
  return html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|li|h[1-6]|div)>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\n{3,}/g, "\n\n").trim();
}
