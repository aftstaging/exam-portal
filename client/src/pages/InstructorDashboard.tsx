import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { BarChart3, FileText, GraduationCap, Loader2, MessageSquare, Send, UserRound, Users, Wrench, Bell, ClipboardCheck } from "lucide-react";
import { PublicHeader } from "@/components/PortalHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ProfileEditor } from "@/components/ProfileEditor";
import { EmptyState, PersonAvatar, ScoreTrend, StatCard } from "@/components/PortalUi";
import { trpc } from "@/lib/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { formatDateTime, formatShortDate, readFileAsDataUrl } from "@/lib/media";
import { startLogin } from "@/const";

type Tab = "overview" | "learners" | "submissions" | "messages" | "profile";
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <BarChart3 className="h-4 w-4" /> },
  { id: "learners", label: "My learners", icon: <Users className="h-4 w-4" /> },
  { id: "submissions", label: "Submissions", icon: <FileText className="h-4 w-4" /> },
  { id: "messages", label: "Messages", icon: <MessageSquare className="h-4 w-4" /> },
  { id: "profile", label: "My profile", icon: <UserRound className="h-4 w-4" /> },
];

/**
 * Instructor dashboard: the people an instructor supervises, their submissions, marks and comments,
 * the performance of the whole group, and direct messages with each learner.
 */
export default function InstructorDashboard() {
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const role = me.data?.role;
  const allowed = role === "instructor" || role === "admin";
  const initial = (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("tab")) as Tab | null;
  const [tab, setTab] = useState<Tab>(TABS.some((item) => item.id === initial) ? (initial as Tab) : "overview");
  const [learnerFilter, setLearnerFilter] = useState<number | null>(null);
  const [openAttempt, setOpenAttempt] = useState<number | null>(null);
  const [messageTarget, setMessageTarget] = useState<number | null>(null);
  const dashboard = trpc.instructor.dashboard.useQuery(undefined, { enabled: allowed, retry: false, refetchInterval: 30_000 });
  const profile = trpc.profile.me.useQuery(undefined, { enabled: allowed, retry: false });
  const unread = trpc.messages.unreadCount.useQuery(undefined, { enabled: allowed, retry: false, refetchInterval: 30_000 });

  if (me.isLoading) return <Shell><Spinner /></Shell>;
  if (!me.data) {
    return (
      <Shell>
        <Card className="mx-auto mt-16 max-w-lg border-white/10 bg-[#120730]"><CardContent className="p-8 text-center">
          <h1 className="text-2xl font-bold text-white">Instructor sign-in</h1>
          <p className="mt-3 text-[#c4b5fd]">Sign in with your instructor account to see your learners and submissions.</p>
          <Button className="aft-button mt-6" onClick={() => startLogin("login")}>Sign in</Button>
        </CardContent></Card>
      </Shell>
    );
  }
  if (!allowed) return <Shell><EmptyState title="Instructor access required" body="This dashboard is for instructor accounts. Learners can see their own results on the My profile page." /></Shell>;

  const pick = (next: Tab) => {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url.toString());
  };
  const openLearnerSubmissions = (learnerId: number) => {
    setLearnerFilter(learnerId);
    pick("submissions");
  };

  return (
    <Shell>
      <main className="container py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Instructor dashboard</p>
            <h1 className="mt-2 text-3xl font-bold text-white">Welcome back{profile.data?.user.name ? `, ${profile.data.user.name}` : ""}.</h1>
            <p className="mt-1 text-[#c4b5fd]">Review submissions, mark work, leave comments and keep in touch with the learners you supervise.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/instructor/content"><Button variant="outline" className="border-[#00e5ff] text-white"><Wrench className="mr-2 h-4 w-4" /> Content & exam studio</Button></Link>
          </div>
        </div>

        <div className="mt-8 flex gap-2 overflow-auto border-b border-white/10">
          {TABS.map((item) => (
            <button key={item.id} onClick={() => pick(item.id)} className={`tab-button flex items-center gap-2 ${tab === item.id ? "tab-active" : ""}`}>
              {item.icon} {item.label}
              {item.id === "messages" && (unread.data ?? 0) > 0 && <span className="ml-1 rounded-full bg-[#00ff88] px-2 text-xs font-bold text-[#0c0524]">{unread.data}</span>}
            </button>
          ))}
        </div>

        <div className="mt-8">
          {tab === "overview" && <OverviewPanel data={dashboard.data} loading={dashboard.isLoading} onOpenSubmission={(id) => { setOpenAttempt(id); pick("submissions"); }} />}
          {tab === "learners" && <LearnersPanel data={dashboard.data} loading={dashboard.isLoading} onViewSubmissions={openLearnerSubmissions} onMessage={(id) => { setMessageTarget(id); pick("messages"); }} />}
          {tab === "submissions" && <SubmissionsPanel data={dashboard.data} loading={dashboard.isLoading} learnerFilter={learnerFilter} onFilter={setLearnerFilter} openAttempt={openAttempt} onOpen={setOpenAttempt} />}
          {tab === "messages" && <MessagesPanel data={dashboard.data} initialPartnerId={messageTarget} />}
          {tab === "profile" && (profile.data ? <ProfileEditor data={profile.data} role={profile.data.user.role} /> : <Spinner />)}
        </div>
      </main>
    </Shell>
  );
}

/** Saves a base64 PDF to the user's machine. */
function downloadBase64Pdf(fileName: string, base64: string) {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#0c0524]"><PublicHeader onLogin={() => startLogin("login")} />{children}</div>;
}

function Spinner() {
  return <div className="py-24 text-center text-[#c4b5fd]"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;
}

type Dashboard = inferRouterOutputs<AppRouter>["instructor"]["dashboard"];

function OverviewPanel({ data, loading, onOpenSubmission }: { data: Dashboard | undefined; loading: boolean; onOpenSubmission: (attemptId: number) => void }) {
  if (loading || !data) return <Spinner />;
  const t = data.totals;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Learners" value={t.learners} hint="Active supervisions" tone="cyan" />
        <StatCard label="Submissions" value={t.submissions} hint="Locked attempts" />
        <StatCard label="To mark" value={t.awaitingMarking} tone="amber" hint="Awaiting marking" />
        <StatCard label="Marked" value={t.marked} />
        <StatCard label="Average score" value={t.averagePercent != null ? `${t.averagePercent}%` : "—"} tone="lavender" />
        <StatCard label="Pass rate" value={t.passRate != null ? `${t.passRate}%` : "—"} hint="Scores of 50% or more" tone="cyan" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="border-white/10 bg-[#120730]"><CardHeader><CardTitle className="text-white">Group score trend</CardTitle></CardHeader><CardContent><ScoreTrend points={data.trend} /></CardContent></Card>
        <Card className="border-white/10 bg-[#120730]">
          <CardHeader><CardTitle className="flex items-center gap-2 text-white"><ClipboardCheck className="h-5 w-5 text-[#00ff88]" /> Recent submissions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.submissions.slice(0, 6).map((row) => (
              <button key={row.attemptId} onClick={() => onOpenSubmission(row.attemptId)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0c0524]/60 p-3 text-left hover:border-[#00e5ff]/50">
                <div className="min-w-0"><div className="truncate font-semibold text-white">{row.learner?.name ?? row.learner?.email ?? "Learner"}</div><div className="truncate text-xs text-[#c4b5fd]">{row.examTitle} · {formatShortDate(row.submittedAt)}</div></div>
                <span className="shrink-0 text-xs font-bold text-[#00ff88]">{row.percent != null ? `${row.percent}%` : row.statusLabel}</span>
              </button>
            ))}
            {!data.submissions.length && <p className="text-sm text-[#c4b5fd]">No submissions from your learners yet.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LearnersPanel({ data, loading, onViewSubmissions, onMessage }: { data: Dashboard | undefined; loading: boolean; onViewSubmissions: (id: number) => void; onMessage: (id: number) => void }) {
  if (loading || !data) return <Spinner />;
  if (!data.students.length) return <EmptyState title="No learners assigned yet" body="When an administrator assigns an enrolled learner to you, they appear here with their submissions and performance." />;
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {data.students.map((student) => (
        <Card key={student.id} className="border-white/10 bg-[#120730]">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-4">
              <PersonAvatar name={student.name} email={student.email} src={student.avatarUrl} size={56} />
              <div className="min-w-0">
                <div className="truncate font-bold text-white">{student.name ?? "Learner"}</div>
                <div className="truncate text-xs text-white/50">{student.email}</div>
                <div className="mt-1 text-xs text-[#c4b5fd]">{student.enrolled ? "Enrolled" : "Not enrolled"} · last seen {formatShortDate(student.lastSignedIn)}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Mini label="Submitted" value={student.performance.submitted} />
              <Mini label="To mark" value={student.performance.awaitingMarking} />
              <Mini label="Average" value={student.performance.averagePercent != null ? `${student.performance.averagePercent}%` : "—"} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="aft-button flex-1" onClick={() => onViewSubmissions(student.id)}>Submissions</Button>
              <Button size="sm" variant="outline" className="flex-1 border-[#00e5ff] text-[#00e5ff]" onClick={() => onMessage(student.id)}>Message</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-xl bg-[#0c0524]/70 p-3"><div className="text-lg font-black text-white">{value}</div><div className="text-[10px] uppercase tracking-wider text-white/45">{label}</div></div>;
}

function SubmissionsPanel({ data, loading, learnerFilter, onFilter, openAttempt, onOpen }: { data: Dashboard | undefined; loading: boolean; learnerFilter: number | null; onFilter: (id: number | null) => void; openAttempt: number | null; onOpen: (id: number | null) => void }) {
  const rows = useMemo(() => (data?.submissions ?? []).filter((row) => learnerFilter == null || row.learner?.id === learnerFilter), [data, learnerFilter]);
  if (loading || !data) return <Spinner />;
  const selected = openAttempt ?? rows[0]?.attemptId ?? null;
  const learnerName = data.students.find((student) => student.id === learnerFilter)?.name;
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
      <Card className="border-white/10 bg-[#120730]">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-white">
            <span>Submissions</span>
            <select value={learnerFilter ?? ""} onChange={(event) => onFilter(event.target.value ? Number(event.target.value) : null)} className="h-9 rounded-lg border border-white/10 bg-[#0c0524] px-3 text-sm text-white" aria-label="Filter by learner">
              <option value="">All learners</option>
              {data.students.map((student) => <option key={student.id} value={student.id}>{student.name ?? student.email}</option>)}
            </select>
          </CardTitle>
          {learnerName && <p className="text-xs text-[#c4b5fd]">Showing submissions from {learnerName}.</p>}
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? <EmptyState title="No submissions" body="Submitted exam attempts from your learners will appear here." /> : (
            <div className="space-y-2">
              {rows.map((row) => (
                <button key={row.attemptId} onClick={() => onOpen(row.attemptId)} className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${selected === row.attemptId ? "border-[#00ff88] bg-[#102b36]" : "border-white/10 bg-[#0c0524]/60 hover:border-[#00e5ff]/50"}`}>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-white">{row.learner?.name ?? row.learner?.email}</div>
                    <div className="truncate text-xs text-[#c4b5fd]">{row.examTitle} · {formatDateTime(row.submittedAt)}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-bold text-[#00ff88]">{row.percent != null ? `${row.percent}%` : "—"}</div>
                    <div className="text-[11px] text-white/50">{row.statusLabel}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <div>{selected ? <SubmissionReview attemptId={selected} /> : <EmptyState title="Select a submission" body="Choose a submission to read the answers, leave comments and mark it." />}</div>
    </div>
  );
}

function SubmissionReview({ attemptId }: { attemptId: number }) {
  const utils = trpc.useUtils();
  const detail = trpc.instructor.submission.useQuery({ attemptId }, { retry: false });
  const [comment, setComment] = useState("");
  const [visible, setVisible] = useState(true);
  const [awarded, setAwarded] = useState("");
  const [total, setTotal] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const marking = detail.data?.marking;
    if (marking) {
      setAwarded(String(marking.awardedPoints));
      setTotal(String(marking.totalPoints));
      setFeedback(marking.feedback ?? "");
    } else {
      setAwarded("");
      setTotal("");
      setFeedback("");
    }
  }, [detail.data?.marking?.id, detail.data?.attempt.id]);

  const addComment = trpc.instructor.comment.useMutation({
    onSuccess: () => { setComment(""); toast.success(visible ? "Comment saved and sent to the learner" : "Internal note saved"); utils.instructor.submission.invalidate({ attemptId }); },
    onError: (error) => toast.error(error.message),
  });
  const grade = trpc.instructor.grade.useMutation({
    onSuccess: (result) => { toast.success(`Marked${result.percent != null ? ` · ${result.percent}%` : ""}. The learner has been notified.`); utils.instructor.submission.invalidate({ attemptId }); utils.instructor.dashboard.invalidate(); },
    onError: (error) => toast.error(error.message),
  });

  const submissionPdf = trpc.instructor.submissionPdf.useMutation({
    onSuccess: (file) => downloadBase64Pdf(file.fileName, file.base64),
    onError: (error) => toast.error(error.message),
  });
  const uploadMarked = trpc.instructor.uploadMarkedPdf.useMutation({
    onSuccess: () => {
      setMarkedFile(null);
      toast.success("Marked PDF uploaded. The learner has been notified.");
      utils.instructor.submission.invalidate({ attemptId });
    },
    onError: (error) => toast.error(error.message),
  });
  const [markedFile, setMarkedFile] = useState<File | null>(null);
  const uploadMarkedFile = async () => {
    if (!markedFile) return;
    if (markedFile.size > 25 * 1024 * 1024) {
      toast.error("The marked PDF must be 25 MB or smaller");
      return;
    }
    if (markedFile.type !== "application/pdf" && !markedFile.name.toLowerCase().endsWith(".pdf")) {
      toast.error("The marked script must be a PDF");
      return;
    }
    const dataUrl = await readFileAsDataUrl(markedFile);
    uploadMarked.mutate({ attemptId, fileName: markedFile.name, base64: dataUrl });
  };

  if (detail.isLoading) return <Spinner />;
  if (!detail.data) return <EmptyState title="Submission unavailable" body="This submission could not be loaded, or it is not one of your learners." />;
  const d = detail.data;
  const awardedNumber = Number(awarded);
  const totalNumber = Number(total);
  const canGrade = Number.isInteger(awardedNumber) && Number.isInteger(totalNumber) && totalNumber > 0 && awardedNumber >= 0 && awardedNumber <= totalNumber && feedback.trim().length > 0;
  const previewPercent = canGrade ? Math.round((awardedNumber / totalNumber) * 1000) / 10 : null;

  return (
    <div className="space-y-6">
      <Card className="border-white/10 bg-[#120730]">
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          <PersonAvatar name={d.learner.name} email={d.learner.email} src={d.learner.avatarUrl} size={56} />
          <div className="min-w-0 flex-1">
            <div className="font-bold text-white">{d.learner.name ?? d.learner.email}</div>
            <div className="text-sm text-[#c4b5fd]">{d.exam.title} · {d.statusLabel}</div>
            <div className="text-xs text-white/45">Submitted {formatDateTime(d.attempt.submittedAt)} · {d.learner.performance.submitted} submissions · average {d.learner.performance.averagePercent ?? "—"}%</div>
          </div>
          <Link href={`/instructor?tab=learners`}><Button variant="outline" size="sm" className="border-white/20 text-white/80"><GraduationCap className="mr-2 h-4 w-4" /> Learners</Button></Link>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#120730]">
        <CardHeader><CardTitle className="flex items-center gap-2 text-white"><FileText className="h-5 w-5 text-[#00e5ff]" /> Marked script</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" className="border-[#00e5ff] text-white" disabled={submissionPdf.isPending} onClick={() => submissionPdf.mutate({ attemptId })}>
              {submissionPdf.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Download submission PDF
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-[#0c0524] p-4">
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="text-sm text-[#c4b5fd] file:mr-3 file:rounded-md file:border-0 file:bg-[#18093c] file:px-3 file:py-1.5 file:text-white"
              onChange={(event) => setMarkedFile(event.target.files?.[0] ?? null)}
            />
            <Button className="aft-button" disabled={!markedFile || uploadMarked.isPending} onClick={() => void uploadMarkedFile()}>
              {uploadMarked.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Upload marked PDF
            </Button>
          </div>
          {d.markedFiles.length ? (
            <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
              {d.markedFiles.map((file) => (
                <li key={file.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="text-white">{file.fileName} <span className="text-[#c4b5fd]">· {formatDateTime(file.createdAt)}</span></span>
                  <a href={file.url} target="_blank" rel="noreferrer" className="font-semibold text-[#00ff88] hover:underline">Download</a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[#c4b5fd]">No marked script uploaded yet. Uploading one sends the learner a notification.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#120730]">
        <CardHeader><CardTitle className="text-white">Answers</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {d.answers.length === 0 && <p className="text-sm text-[#c4b5fd]">No answers were saved.</p>}
          {d.answers.map((answer) => (
            <div key={answer.sectionId} className="rounded-xl border border-white/10 bg-[#0c0524]/60 p-4">
              <div className="mb-2 flex justify-between text-sm"><span className="font-semibold text-white">{answer.title}</span><span className="text-white/45">{answer.wordCount} words</span></div>
              <div className="max-h-72 overflow-y-auto whitespace-pre-line text-sm leading-6 text-[#e9e4ff]">{stripHtml(answer.body) || "—"}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#120730]">
        <CardHeader><CardTitle className="flex items-center gap-2 text-white"><ClipboardCheck className="h-5 w-5 text-[#00ff88]" /> Mark submission</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2"><label className="text-xs uppercase tracking-wider text-white/55" htmlFor="awarded">Marks awarded</label><Input id="awarded" inputMode="numeric" value={awarded} onChange={(event) => setAwarded(event.target.value.replace(/[^0-9]/g, ""))} className="border-white/10 bg-[#0c0524] text-white" /></div>
            <div className="space-y-2"><label className="text-xs uppercase tracking-wider text-white/55" htmlFor="total">Total available</label><Input id="total" inputMode="numeric" value={total} onChange={(event) => setTotal(event.target.value.replace(/[^0-9]/g, ""))} className="border-white/10 bg-[#0c0524] text-white" /></div>
            <div className="space-y-2"><div className="text-xs uppercase tracking-wider text-white/55">Score</div><div className="pt-2 text-2xl font-black text-[#00ff88]">{previewPercent != null ? `${previewPercent}%` : "—"}</div></div>
          </div>
          <div className="space-y-2"><label className="text-xs uppercase tracking-wider text-white/55" htmlFor="feedback">Feedback for the learner</label><Textarea id="feedback" rows={6} maxLength={100000} value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Strengths, areas to improve and the reasons for your marks…" className="border-white/10 bg-[#0c0524] text-white" /></div>
          <div className="flex justify-end">
            <Button className="aft-button" disabled={!canGrade || grade.isPending} onClick={() => grade.mutate({ attemptId, awardedPoints: awardedNumber, totalPoints: totalNumber, feedback: feedback.trim() })}>
              {grade.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{d.marking?.status === "submitted" ? "Update marks & feedback" : "Release marks & feedback"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#120730]">
        <CardHeader><CardTitle className="flex items-center gap-2 text-white"><Bell className="h-5 w-5 text-[#00e5ff]" /> Comments</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {d.comments.length === 0 && <p className="text-sm text-[#c4b5fd]">No comments yet.</p>}
          <div className="space-y-3">
            {d.comments.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-[#0c0524]/60 p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-white/50">
                  <span className="font-semibold text-white/80">{item.author?.name ?? "Staff"}</span>
                  <span>· {formatDateTime(item.createdAt)}</span>
                  <span className={`rounded-full px-2 py-0.5 ${item.visibleToLearner ? "bg-[#102b36] text-[#00ff88]" : "bg-white/5 text-white/60"}`}>{item.visibleToLearner ? "Visible to learner" : "Internal note"}</span>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#e9e4ff]">{item.body}</p>
              </div>
            ))}
          </div>
          <div className="space-y-3 rounded-xl border border-white/10 p-4">
            <Textarea rows={3} value={comment} onChange={(event) => setComment(event.target.value)} maxLength={5000} placeholder="Write a comment…" className="border-white/10 bg-[#0c0524] text-white" />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-3 text-sm text-[#c4b5fd]"><Switch checked={visible} onCheckedChange={setVisible} /> Share with learner (emails them)</label>
              <Button className="aft-button" disabled={!comment.trim() || addComment.isPending} onClick={() => addComment.mutate({ attemptId, body: comment.trim(), visibleToLearner: visible })}>{addComment.isPending ? "Saving…" : "Add comment"}</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {d.previousAttempts.length > 0 && (
        <Card className="border-white/10 bg-[#120730]">
          <CardHeader><CardTitle className="text-white">Earlier submissions by this learner</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {d.previousAttempts.map((item) => <div key={item.attemptId} className="flex justify-between rounded-lg bg-[#0c0524]/60 p-3 text-[#e9e4ff]"><span>{item.examTitle}</span><span className="text-white/60">{item.statusLabel}{item.percent != null ? ` · ${item.percent}%` : ""} · {formatShortDate(item.date)}</span></div>)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MessagesPanel({ data, initialPartnerId }: { data: Dashboard | undefined; initialPartnerId: number | null }) {
  const utils = trpc.useUtils();
  const conversations = trpc.messages.conversations.useQuery(undefined, { retry: false, refetchInterval: 20_000 });
  const [partnerId, setPartnerId] = useState<number | null>(initialPartnerId);
  const thread = trpc.messages.thread.useQuery({ partnerId: partnerId ?? 0 }, { enabled: partnerId != null, retry: false, refetchInterval: 10_000 });
  const [draft, setDraft] = useState("");
  const send = trpc.messages.send.useMutation({
    onSuccess: () => { setDraft(""); utils.messages.thread.invalidate(); utils.messages.conversations.invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  if (!data) return <Spinner />;
  const learners = data.students;
  if (!learners.length) return <EmptyState title="No learners to message" body="Once learners are assigned to you, you can message them here." />;
  const current = learners.find((learner) => learner.id === partnerId) ?? null;
  return (
    <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
      <Card className="border-white/10 bg-[#120730]">
        <CardHeader><CardTitle className="text-white">Learners</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {learners.map((learner) => {
            const convo = conversations.data?.find((item) => item.partner.id === learner.id);
            return (
              <button key={learner.id} onClick={() => setPartnerId(learner.id)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${partnerId === learner.id ? "border-[#00ff88] bg-[#102b36]" : "border-white/10 bg-[#0c0524]/60 hover:border-[#00e5ff]/50"}`}>
                <PersonAvatar name={learner.name} email={learner.email} src={learner.avatarUrl} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-white">{learner.name ?? learner.email}</div>
                  <div className="truncate text-xs text-white/45">{convo ? convo.lastMessage.body : "No messages yet"}</div>
                </div>
                {convo && convo.unread > 0 && <span className="rounded-full bg-[#00ff88] px-2 text-xs font-bold text-[#0c0524]">{convo.unread}</span>}
              </button>
            );
          })}
        </CardContent>
      </Card>
      <Card className="border-white/10 bg-[#120730]">
        <CardHeader><CardTitle className="text-white">{current ? `Conversation with ${current.name ?? current.email}` : "Choose a learner"}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {current ? (
            <>
              <div className="max-h-[460px] space-y-3 overflow-y-auto rounded-xl border border-white/10 bg-[#0c0524]/60 p-4">
                {thread.data?.length === 0 && <p className="text-center text-sm text-[#c4b5fd]">No messages yet.</p>}
                {thread.data?.map((message) => (
                  <div key={message.id} className={`flex ${message.fromMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-6 ${message.fromMe ? "bg-[#00ff88] text-[#0c0524]" : "bg-[#18093c] text-white"}`}>
                      <div className="whitespace-pre-line">{message.body}</div>
                      <div className={`mt-1 text-[10px] ${message.fromMe ? "text-[#0c0524]/60" : "text-white/40"}`}>{formatDateTime(message.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
              <form className="flex gap-3" onSubmit={(event) => { event.preventDefault(); if (draft.trim()) send.mutate({ recipientId: current.id, body: draft.trim() }); }}>
                <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={2} maxLength={5000} placeholder="Write a message…" className="border-white/10 bg-[#0c0524] text-white" />
                <Button type="submit" className="aft-button h-auto" disabled={!draft.trim() || send.isPending}><Send className="h-4 w-4" /><span className="sr-only">Send</span></Button>
              </form>
            </>
          ) : <p className="text-sm text-[#c4b5fd]">Pick a learner on the left to read and send messages. They also receive an email and an in-app notification.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function stripHtml(html: string): string {
  return html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|li|h[1-6]|div)>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\n{3,}/g, "\n\n").trim();
}
