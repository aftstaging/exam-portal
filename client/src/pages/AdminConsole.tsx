import { useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  BookOpen,
  CreditCard,
  Eye,
  FileText,
  GraduationCap,
  ImageUp,
  Layers3,
  ListChecks,
  LockKeyhole,
  Package,
  Pencil,
  Plus,
  ShieldCheck,
  Ticket,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import ExamStudio from "@/components/ExamStudio";

const zar = (cents: number) => (cents / 100).toLocaleString("en-ZA", { style: "currency", currency: "ZAR" });
const shortDate = (value?: Date | string | null) => (value ? new Date(value).toLocaleDateString() : "—");

function BrandMark() {
  return (
    <span className="inline-flex items-center" aria-label="Accountants for Tomorrow">
      <img src="/assets/aft_logo_white.png" alt="Accountants for Tomorrow" className="h-10 w-auto object-contain" />
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "published" || status === "active" || status === "completed"
      ? "bg-[#102b36] text-[#00ff88]"
      : status === "draft" || status === "pending"
        ? "bg-[#18093c]/60 text-[#f4c44e]"
        : "bg-[#18093c]/60 text-white/55";
  return (
    <Badge className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${tone}`}>{status}</Badge>
  );
}

function StatusAction({ status, onPublish, onArchive }: { status: string; onPublish: () => void; onArchive: () => void }) {
  if (status === "published") {
    return (
      <Button size="sm" variant="outline" className="h-7 border-[#ff8278]/50 px-2 text-[11px] text-[#ff8278]" onClick={onArchive}>
        Archive
      </Button>
    );
  }
  return (
    <Button size="sm" variant="outline" className="h-7 border-[#00ff88] px-2 text-[11px] text-[#00ff88]" onClick={onPublish}>
      Publish
    </Button>
  );
}

function DeniedState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="min-h-screen bg-[#0c0524]">
      <main className="container py-20">
        <Card className="mx-auto max-w-xl border-[#00e5ff]/30 bg-[#120730] text-center">
          <CardContent className="p-10">
            <LockKeyhole className="mx-auto h-10 w-10 text-[#00e5ff]" />
            <h1 className="mt-5 text-3xl font-bold text-white">{title}</h1>
            <p className="mt-3 text-[#c4b5fd]">{copy}</p>
            <Button className="aft-button mt-7" onClick={() => startLogin()}>
              Sign in securely <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function OverviewTab() {
  const overviewQuery = trpc.admin.overview.useQuery(undefined, { retry: false });
  const settingsQuery = trpc.admin.payfastSettings.useQuery(undefined, { retry: false });
  const overview = overviewQuery.data;
  const activity = overview?.recentActivity ?? [];
  const settings = settingsQuery.data;
  return (
    <>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {[
          { label: "Active learners", value: overview?.activeLearners ?? "…", hint: "Registered accounts" },
          { label: "Awaiting marking", value: overview?.awaitingMarking ?? "…", hint: "Queue status" },
          { label: "Published products", value: overview?.publishedProducts ?? "…", hint: "Live catalogue" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="text-sm text-white/50">{stat.label}</div>
              <div className="mt-2 text-3xl font-bold text-white">{stat.value}</div>
              <div className="mt-2 text-xs font-bold text-[#00ff88]">{stat.hint}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-white">Payment gateway</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#18093c]/60 px-4 py-3">
              <span className="text-[#c4b5fd]">PayFast mode</span>
              <Badge className={`rounded-full px-3 py-0.5 ${settings?.mode === "live" ? "bg-[#102b36] text-[#00ff88]" : "bg-[#18093c]/60 text-[#f4c44e]"}`}>
                {settings?.mode ?? "sandbox"}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#18093c]/60 px-4 py-3">
              <span className="text-[#c4b5fd]">Credentials configured</span>
              <span className={settings?.configured ? "text-[#00ff88]" : "text-[#ff8278]"}>
                {settings?.configured ? "Yes" : "No"}
              </span>
            </div>
            {settings?.updatedAt && (
              <p className="text-xs text-white/45">Switched {shortDate(settings.updatedAt)} — switch it from the Payments tab.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-white">Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length ? (
              <ul className="space-y-2">
                {activity.map((event) => (
                  <li key={`${event.id}-${event.createdAt}`} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#18093c]/40 px-3 py-2 text-xs">
                    <span className="truncate text-[#c4b5fd]">
                      <span className="capitalize">{event.entityType}</span> · {event.action}
                    </span>
                    <span className="shrink-0 text-white/45">{shortDate(event.createdAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-white/45">No audited activity yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function PaymentsTab() {
  const settingsQuery = trpc.admin.payfastSettings.useQuery(undefined, { retry: false });
  const setMode = trpc.admin.setPayfastMode.useMutation({
    onSuccess: () => {
      toast.success("Payment gateway mode updated");
      settingsQuery.refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  const paymentsQuery = trpc.admin.payments.useQuery(undefined, { retry: false });
  const payments = paymentsQuery.data ?? [];
  const settings = settingsQuery.data;

  const toggleMode = (next: "sandbox" | "live") => {
    if (next === "live" && !window.confirm("Switch PayFast to LIVE mode? Real payments will be accepted.")) return;
    setMode.mutate({ mode: next });
  };

  return (
    <div className="space-y-7">
      <Card className="border-[#00e5ff]/30 bg-[#120730]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <CreditCard className="h-5 w-5 text-[#00e5ff]" /> Gateway mode
          </CardTitle>
          <p className="text-sm leading-6 text-white/50">
            Test mode routes checkouts to the PayFast sandbox. Switch to live only when the merchant credentials are configured.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button
            className={settings?.mode === "sandbox" ? "aft-button" : "border-[#00e5ff] text-white"}
            variant={settings?.mode === "sandbox" ? "default" : "outline"}
            disabled={setMode.isPending}
            onClick={() => toggleMode("sandbox")}
          >
            Test mode (sandbox)
          </Button>
          <Button
            className={settings?.mode === "live" ? "aft-button" : "border-[#00ff88] text-white"}
            variant={settings?.mode === "live" ? "default" : "outline"}
            disabled={setMode.isPending || (settings?.mode === "live" && true)}
            onClick={() => toggleMode("live")}
          >
            Live mode
          </Button>
          <span className={settings?.configured ? "text-xs font-bold text-[#00ff88]" : "text-xs font-bold text-[#ff8278]"}>
            {settings?.configured ? "Credentials configured" : "Credentials not configured for the active mode"}
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-white">Payment ledger</CardTitle>
          <Badge className="bg-[#102b36] text-[#00ff88]">{payments.length} transaction{payments.length === 1 ? "" : "s"}</Badge>
        </CardHeader>
        <CardContent>
          {payments.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-white/45">
                    <th className="pb-3 pr-4 font-semibold">Date</th>
                    <th className="pb-3 pr-4 font-semibold">Learner</th>
                    <th className="pb-3 pr-4 font-semibold">Product</th>
                    <th className="pb-3 pr-4 font-semibold">Provider</th>
                    <th className="pb-3 pr-4 font-semibold">Reference</th>
                    <th className="pb-3 pr-4 font-semibold">Amount</th>
                    <th className="pb-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-b border-white/5">
                      <td className="py-3 pr-4 text-white/60">{shortDate(payment.createdAt)}</td>
                      <td className="py-3 pr-4 text-white">{payment.learnerName ?? "—"}<div className="text-xs text-white/45">{payment.learnerEmail}</div></td>
                      <td className="py-3 pr-4 text-[#c4b5fd]">{payment.productTitle ?? "Granted"}</td>
                      <td className="py-3 pr-4 capitalize text-[#c4b5fd]">{payment.provider}</td>
                      <td className="py-3 pr-4 text-xs text-white/45">{payment.reference ?? "—"}</td>
                      <td className="py-3 pr-4 font-semibold text-white">{zar(payment.amountCents)}</td>
                      <td className="py-3"><StatusBadge status={payment.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-white/45">No payments recorded yet. Completed PayFast, Stripe, and admin allocations appear here.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UsersTab() {
  const [role, setRole] = useState<"user" | "instructor">("user");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const usersQuery = trpc.admin.users.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const createStudent = trpc.admin.createStudent.useMutation({
    onSuccess: () => {
      toast.success("Student account created");
      utils.admin.users.invalidate();
      setEmail(""); setName(""); setPassword("");
    },
    onError: (error) => toast.error(error.message),
  });
  const createInstructor = trpc.admin.createInstructor.useMutation({
    onSuccess: () => {
      toast.success("Instructor account created");
      utils.admin.users.invalidate();
      setEmail(""); setName(""); setPassword("");
    },
    onError: (error) => toast.error(error.message),
  });
  const removeUser = trpc.admin.removeUser.useMutation({
    onSuccess: () => {
      toast.success("Account removed");
      utils.admin.users.invalidate();
      utils.admin.overview.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const users = usersQuery.data ?? [];
  const visible = users.filter((user) => (role === "instructor" ? user.role === "instructor" : user.role === "user"));
  const create = role === "instructor" ? createInstructor : createStudent;

  return (
    <div className="space-y-7">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-white">Create account</CardTitle>
          <Badge className="bg-[#102b36] text-[#00ff88]">{role}</Badge>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-2">
            <Button variant={role === "user" ? "default" : "outline"} className={role === "user" ? "aft-button" : "border-[#00e5ff] text-white"} onClick={() => setRole("user")}>Student</Button>
            <Button variant={role === "instructor" ? "default" : "outline"} className={role === "instructor" ? "aft-button" : "border-[#00e5ff] text-white"} onClick={() => setRole("instructor")}>Instructor</Button>
          </div>
          <form
            className="grid gap-3 md:grid-cols-[1fr_1.2fr_1fr_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              if (!email.trim() || password.length < 8) return;
              create.mutate({ email: email.trim(), name: name.trim() || undefined, password });
            }}
          >
            <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="you@example.co.za" className="border-white/10 bg-[#0c0524] text-white" disabled={create.isPending} />
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name (optional)" className="border-white/10 bg-[#0c0524] text-white" disabled={create.isPending} />
            <Input value={password} onChange={(event) => setPassword(event.target.value)} type="text" placeholder={`Password (min 8 chars)`} className="border-white/10 bg-[#0c0524] text-white" disabled={create.isPending} />
            <Button className="aft-button" type="submit" disabled={create.isPending || !email.trim() || password.length < 8}>
              <Plus className="mr-2 h-4 w-4" /> Create {role}
            </Button>
          </form>
          <p className="mt-3 text-xs text-white/45">
            {role === "instructor"
              ? "Instructors sign in to upload content and manage marking. Admins manage billing and learner accounts."
              : "Students can be given exam access here or through the Entitlements tab — no checkout required."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-white">{role === "instructor" ? "Instructors" : "Students"}</CardTitle>
          <Badge className="bg-[#102b36] text-[#00ff88]">{visible.length} account{visible.length === 1 ? "" : "s"}</Badge>
        </CardHeader>
        <CardContent>
          {usersQuery.isLoading ? (
            <div className="h-24 animate-pulse rounded-xl bg-[#18093c]" />
          ) : visible.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-white/45">
                    <th className="pb-3 pr-4 font-semibold">Name</th>
                    <th className="pb-3 pr-4 font-semibold">Email</th>
                    <th className="pb-3 pr-4 font-semibold">Created</th>
                    <th className="pb-3 pr-4 font-semibold">Products</th>
                    <th className="pb-3 pr-4 font-semibold">Attempts</th>
                    <th className="pb-3 pr-4 font-semibold">Last sign in</th>
                    <th className="pb-3 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((user) => (
                    <tr key={user.id} className="border-b border-white/5">
                      <td className="py-3 pr-4 text-white">{user.name ?? "—"}</td>
                      <td className="py-3 pr-4 text-[#c4b5fd]">{user.email}</td>
                      <td className="py-3 pr-4 text-white/55">{shortDate(user.createdAt)}</td>
                      <td className="py-3 pr-4 text-white/55">{user.entitlementCount}</td>
                      <td className="py-3 pr-4 text-white/55">{user.attemptCount}</td>
                      <td className="py-3 pr-4 text-white/55">{shortDate(user.lastSignedIn)}</td>
                      <td className="py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 border-[#ff8278]/50 px-2 text-[11px] text-[#ff8278]"
                          disabled={removeUser.isPending}
                          onClick={() => {
                            if (!window.confirm(`Remove ${user.email}? Their entitlements, attempts, and notifications are deleted.`)) return;
                            removeUser.mutate({ userId: user.id });
                          }}
                        >
                          <Trash2 className="mr-1 h-3 w-3" /> Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-white/45">No {role}s yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EntitlementsTab() {
  const usersQuery = trpc.admin.users.useQuery(undefined, { retry: false });
  const productsQuery = trpc.catalogue.products.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const [studentId, setStudentId] = useState("");
  const [productId, setProductId] = useState("");
  const [accessDays, setAccessDays] = useState("");
  const students = (usersQuery.data ?? []).filter((user) => user.role === "user");
  const products = productsQuery.data ?? [];
  const learnerEntitlementsQuery = trpc.admin.learnerEntitlements.useQuery({ userId: Number(studentId) }, { retry: false, enabled: Boolean(studentId) });
  const grant = trpc.admin.grantAccess.useMutation({
    onSuccess: (result) => {
      toast.success(`Access granted to ${result.title}`);
      utils.admin.learnerEntitlements.invalidate();
      utils.admin.users.invalidate();
      utils.admin.payments.invalidate();
      setProductId("");
    },
    onError: (error) => toast.error(error.message),
  });
  const revoke = trpc.admin.revokeAccess.useMutation({
    onSuccess: () => {
      toast.success("Access removed");
      utils.admin.learnerEntitlements.invalidate();
      utils.admin.users.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const selected = students.find((student) => String(student.id) === studentId);
  const rows = learnerEntitlementsQuery.data ?? [];

  return (
    <div className="space-y-7">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white"><GraduationCap className="h-5 w-5 text-[#00ff88]" /> Allocate exams to a student</CardTitle>
          <p className="text-sm leading-6 text-white/50">
            Grant any published product without a checkout. Works for any registered learner — the entitlement activates immediately.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[1.2fr_1.4fr_120px_auto]">
            <select
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              className="h-11 rounded-lg border border-white/10 bg-[#0c0524] px-3 text-sm text-white"
              aria-label="Select student"
            >
              <option value="">Select student…</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>{student.name ?? student.email} · {student.email}</option>
              ))}
            </select>
            <select
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              className="h-11 rounded-lg border border-white/10 bg-[#0c0524] px-3 text-sm text-white"
              aria-label="Select product"
            >
              <option value="">Select product…</option>
              {products.map(({ product }) => (
                <option key={product.id} value={product.id}>{product.title} · {zar(product.priceCents)}</option>
              ))}
            </select>
            <Input
              value={accessDays}
              onChange={(event) => setAccessDays(event.target.value)}
              type="number"
              min="1"
              max="3650"
              placeholder="Days"
              className="border-white/10 bg-[#0c0524] text-white"
            />
            <Button
              className="aft-button"
              disabled={grant.isPending || !studentId || !productId}
              onClick={() => grant.mutate({ userId: Number(studentId), productId: Number(productId), accessDays: accessDays ? Number(accessDays) : undefined })}
            >
              Grant access
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-white">{selected ? `Access for ${selected.name ?? selected.email}` : "Student access"}</CardTitle>
          {rows.length ? <Badge className="bg-[#102b36] text-[#00ff88]">{rows.length} entitlement{rows.length === 1 ? "" : "s"}</Badge> : null}
        </CardHeader>
        <CardContent>
          {!studentId ? (
            <p className="py-8 text-center text-sm text-white/45">Select a student to review and revoke their exam access.</p>
          ) : learnerEntitlementsQuery.isLoading ? (
            <div className="h-20 animate-pulse rounded-xl bg-[#18093c]" />
          ) : rows.length ? (
            <ul className="space-y-2">
              {rows.map(({ entitlement, product }) => (
                <li key={entitlement.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#18093c]/50 px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2 font-semibold text-white">{product.title}<StatusBadge status={entitlement.status} /></div>
                    <div className="mt-1 text-xs text-white/45">
                      {entitlement.source} · starts {shortDate(entitlement.startsAt)} · expires {shortDate(entitlement.expiresAt)}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 border-[#ff8278]/50 px-2 text-[11px] text-[#ff8278]"
                    disabled={revoke.isPending || entitlement.status === "revoked"}
                    onClick={() => {
                      if (!window.confirm(`Remove ${product.title} from this student?`)) return;
                      revoke.mutate({ entitlementId: entitlement.id });
                    }}
                  >
                    <Trash2 className="mr-1 h-3 w-3" /> Revoke
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-white/45">This student has no entitlements yet. Grant one above.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ContentTab() {
  const [section, setSection] = useState<"Products" | "Exams" | "Sections" | "Question bank" | "Resources">("Products");
  const productsQuery = trpc.admin.products.useQuery(undefined, { retry: false });
  const contentQuery = trpc.admin.contentOverview.useQuery(undefined, { retry: false });
  const contentKind = section === "Exams" ? "mock_exams" : section === "Sections" ? "sections" : section === "Question bank" ? "objective_questions" : "resources";
  const contentItemsQuery = trpc.admin.contentItems.useQuery({ kind: contentKind }, { retry: false, enabled: section === "Exams" || section === "Sections" || section === "Question bank" || section === "Resources" });
  const utils = trpc.useUtils();
  const contentStatus = trpc.admin.updateContentStatus.useMutation({
    onSuccess: () => { toast.success("Content status updated"); utils.admin.contentItems.invalidate(); utils.admin.contentOverview.invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const productStatus = trpc.admin.updateProductStatus.useMutation({
    onSuccess: () => { toast.success("Product status updated"); utils.admin.products.invalidate(); utils.admin.overview.invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const sectionTitle = trpc.admin.updateSectionTitle.useMutation({
    onSuccess: () => { toast.success("Section title updated"); utils.admin.contentItems.invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const generatePdf = trpc.admin.generatePrintablePdf.useMutation({
    onError: (error) => toast.error(error.message),
  });
  const items = contentItemsQuery.data ?? [];

  const [previewId, setPreviewId] = useState<number | null>(null);
  const previewQuery = trpc.admin.examPreview.useQuery({ mockExamId: previewId ?? 0 }, { enabled: previewId !== null });

  const [editingExamId, setEditingExamId] = useState<number | null>(null);
  const [deletingExam, setDeletingExam] = useState<{ id: number; title: string } | null>(null);
  const deleteExam = trpc.admin.deleteExamBundle.useMutation({
    onSuccess: () => {
      toast.success("Exam deleted");
      setDeletingExam(null);
      utils.admin.contentItems.invalidate();
      utils.admin.contentOverview.invalidate();
      utils.admin.products.invalidate();
      utils.admin.overview.invalidate();
      utils.admin.staffCatalogue.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const nav = ["Products", "Exams", "Sections", "Question bank", "Resources"];

  return (
    <>
      <div className="mt-8 flex gap-2">
        {nav.map((item) => (
          <button
            key={item}
            onClick={() => setSection(item as typeof section)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${section === item ? "bg-[#102b36] text-[#00ff88]" : "text-white/70 hover:bg-[#18093c]/60 hover:text-white"}`}
          >
            {item}
          </button>
        ))}
      </div>

      {section === "Products" && <ProductsPanel publish={productStatus} />}

      {section === "Exams" && (
        <>
          {editingExamId === null ? (
            <ExamStudio onCreated={() => { utils.admin.contentItems.invalidate(); contentQuery.refetch(); }} />
          ) : (
            <ExamStudio
              editExamId={editingExamId}
              onCancelled={() => setEditingExamId(null)}
              onCreated={() => {
                setEditingExamId(null);
                utils.admin.contentItems.invalidate();
                utils.admin.contentOverview.invalidate();
                utils.admin.products.invalidate();
                utils.admin.staffCatalogue.invalidate();
                contentQuery.refetch();
              }}
            />
          )}
          <Card className="mt-6">
            <CardContent className="pt-6">
              {items.length ? items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 border-b border-white/5 py-3 last:border-0">
                  <div><div className="font-semibold text-white">{item.title}</div><div className="text-xs capitalize text-white/45">{item.detail}</div></div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-7 border-[#00e5ff] px-2 text-[11px] text-[#00e5ff]" onClick={() => setPreviewId(item.id)}><Eye className="mr-1 h-3 w-3" /> Preview</Button>
                    <Button size="sm" variant="outline" className="h-7 border-white/10 px-2 text-[11px] text-white/60" onClick={() => generatePdf.mutate({ mockExamId: item.id })}><FileText className="mr-1 h-3 w-3" /> PDF</Button>
                    <Button size="sm" variant="outline" className="h-7 border-[#f4c44e]/50 px-2 text-[11px] text-[#f4c44e]" onClick={() => setEditingExamId(item.id)}><Pencil className="mr-1 h-3 w-3" /> Edit</Button>
                    <Button size="sm" variant="outline" className="h-7 border-[#ff8278]/50 px-2 text-[11px] text-[#ff8278]" onClick={() => setDeletingExam({ id: item.id, title: item.title })}><Trash2 className="mr-1 h-3 w-3" /> Delete</Button>
                    <StatusAction status={item.status} onPublish={() => contentStatus.mutate({ kind: "mock_exams", id: item.id, status: "published" })} onArchive={() => contentStatus.mutate({ kind: "mock_exams", id: item.id, status: "archived" })} />
                  </div>
                </div>
              )) : <p className="py-8 text-center text-sm text-white/45">No exams yet.</p>}
            </CardContent>
          </Card>
          {previewId !== null && (
            <ExamPreviewModal
              data={previewQuery.data ?? null}
              loading={previewQuery.isLoading}
              onClose={() => { setPreviewId(null); }}
            />
          )}
          {deletingExam && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#120730]/85 p-4 backdrop-blur-sm" onClick={() => { if (!deleteExam.isPending) setDeletingExam(null); }}>
              <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c0524] p-6" onClick={(event) => event.stopPropagation()}>
                <p className="eyebrow">Permanently delete exam</p>
                <h3 className="mt-2 text-2xl font-black text-white">Delete "{deletingExam.title}"?</h3>
                <p className="mt-3 text-sm leading-6 text-[#c4b5fd]">
                  This permanently removes the exam, its store listing, questions/sections, resources, and all learner attempts, markings, feedback and entitlement/payment records for it. This action cannot be undone.
                </p>
                <div className="mt-6 flex justify-end gap-3">
                  <Button variant="outline" className="border-white/15 text-white/70" onClick={() => setDeletingExam(null)} disabled={deleteExam.isPending}>Cancel</Button>
                  <Button className="bg-[#ff8278] text-white hover:bg-[#ff6f63]" onClick={() => deleteExam.mutate({ mockExamId: deletingExam.id })} disabled={deleteExam.isPending}>
                    <Trash2 className="mr-2 h-4 w-4" /> {deleteExam.isPending ? "Deleting…" : "Delete exam"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {section === "Sections" && (
        <Card className="mt-6">
          <CardContent className="pt-6">
            {items.length ? items.map((item) => (
              <SectionRow key={item.id} item={item} onSave={(title) => sectionTitle.mutate({ sectionId: item.id, title })} />
            )) : <p className="py-8 text-center text-sm text-white/45">No case-study sections yet.</p>}
          </CardContent>
        </Card>
      )}

      {section === "Question bank" && (
        <>
          <QuestionForm refresh={() => { utils.admin.contentItems.invalidate(); contentQuery.refetch(); }} examItems={[]} />
          <Card className="mt-6">
            <CardContent className="pt-6">
              {items.length ? items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 border-b border-white/5 py-3 last:border-0">
                  <div><div className="font-semibold text-white">{item.title}</div><div className="text-xs text-white/45">{item.detail}</div></div>
                  <StatusAction status={item.status} onPublish={() => contentStatus.mutate({ kind: "objective_questions", id: item.id, status: "published" })} onArchive={() => contentStatus.mutate({ kind: "objective_questions", id: item.id, status: "archived" })} />
                </div>
              )) : <p className="py-8 text-center text-sm text-white/45">No questions yet.</p>}
            </CardContent>
          </Card>
        </>
      )}

      {section === "Resources" && (
        <>
          <ResourceForm refresh={() => { utils.admin.contentItems.invalidate(); contentQuery.refetch(); }} products={productsQuery.data ?? []} />
          <Card className="mt-6">
            <CardContent className="pt-6">
              {items.length ? items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 border-b border-white/5 py-3 last:border-0">
                  <div><div className="font-semibold text-white">{item.title}</div><div className="text-xs capitalize text-white/45">{item.detail}</div></div>
                  <StatusAction status={item.status} onPublish={() => contentStatus.mutate({ kind: "resources", id: item.id, status: "published" })} onArchive={() => contentStatus.mutate({ kind: "resources", id: item.id, status: "archived" })} />
                </div>
              )) : <p className="py-8 text-center text-sm text-white/45">No resources uploaded yet.</p>}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}

function ProductsPanel({ publish }: { publish: { mutate: (input: { productId: number; status: "draft" | "published" | "archived" }) => void } }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<"case_study" | "objective_test" | "marking" | "resource">("objective_test");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [price, setPrice] = useState("149");
  const [accessDays, setAccessDays] = useState("30");
  const [editingId, setEditingId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const createProduct = trpc.admin.createProduct.useMutation({
    onSuccess: () => { toast.success("Product created as draft"); utils.admin.products.invalidate(); setTitle(""); setImage(""); },
    onError: (error) => toast.error(error.message),
  });
  const updateAccess = trpc.admin.updateAccessDays.useMutation({ onSuccess: () => utils.admin.products.invalidate(), onError: (error) => toast.error(error.message) });
  const updatePrice = trpc.admin.updatePrice.useMutation({ onSuccess: () => utils.admin.products.invalidate(), onError: (error) => toast.error(error.message) });
  // products are passed via props from the parent query result; fetch fresh here for simplicity
  const productsQuery = trpc.admin.products.useQuery(undefined, { retry: false });
  const productsRows = productsQuery.data ?? [];

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white"><Package className="h-5 w-5 text-[#00ff88]" /> Create product</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Product title" className="border-white/10 bg-[#0c0524] text-white" />
          <select value={category} onChange={(event) => setCategory(event.target.value as typeof category)} className="h-10 w-full rounded-lg border border-white/10 bg-[#0c0524] px-3 text-sm text-white">
            <option value="objective_test">Objective test</option>
            <option value="case_study">Case study</option>
            <option value="marking">Instructor marking</option>
            <option value="resource">Resource</option>
          </select>
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" className="min-h-20 border-white/10 bg-[#0c0524] text-white" />
          <Input value={image} onChange={(event) => setImage(event.target.value)} placeholder="Featured image URL (https://…)" className="border-white/10 bg-[#0c0524] text-white" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-[#c4b5fd]">Price (ZAR)</label>
              <Input type="number" value={price} onChange={(event) => setPrice(event.target.value)} min="0" step="0.01" placeholder="0.00" className="mt-1 border-white/10 bg-[#0c0524] text-white" aria-label="New product price" />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#c4b5fd]">Subscription duration (days)</label>
              <Input type="number" value={accessDays} onChange={(event) => setAccessDays(event.target.value)} min="1" max="3650" placeholder="30" className="mt-1 border-white/10 bg-[#0c0524] text-white" aria-label="New product access days" />
            </div>
          </div>
          <Button className="aft-button w-full" disabled={createProduct.isPending || !title.trim()} onClick={() => createProduct.mutate({ title, category, description: description || undefined, featuredImageUrl: image || undefined, priceCents: Math.round(Number(price || 0) * 100), accessDays: Number(accessDays) || 30 })}>
            Create draft product
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-white">Catalogue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {productsRows.map(({ product }) => (
              <div key={product.id} className="rounded-xl border border-white/10 bg-[#18093c]/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-semibold text-white">{product.title}</span>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="h-7 border-[#f4c44e] px-2 text-[11px] text-[#f4c44e]" onClick={() => setEditingId(editingId === product.id ? null : product.id)}>
                      <Pencil className="mr-1 h-3 w-3" /> Edit
                    </Button>
                    <StatusAction status={product.status} onPublish={() => publish.mutate({ productId: product.id, status: "published" })} onArchive={() => publish.mutate({ productId: product.id, status: "archived" })} />
                  </div>
                </div>
                {product.featuredImageUrl && (
                  <img src={product.featuredImageUrl} alt={product.title} className="mt-3 h-24 w-full rounded-lg object-cover" />
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs capitalize text-white/40">{product.category}</span>
                  {product.priceCents > 0 && (
                    <Input aria-label={`Price for ${product.title}`} defaultValue={String((product.priceCents / 100).toFixed(2))} type="number" min="0" step="0.01" className="h-8 w-24 border-white/10 bg-[#0c0524] text-white" onBlur={(event) => { const priceCents = Math.round(Number(event.target.value) * 100); if (priceCents !== product.priceCents) updatePrice.mutate({ productId: product.id, priceCents }); }} />
                  )}
                  <Input aria-label={`Access days for ${product.title}`} defaultValue={String(product.accessDays)} type="number" min="1" max="3650" className="h-8 w-24 border-white/10 bg-[#0c0524] text-white" onBlur={(event) => { const days = Number(event.target.value); if (days !== product.accessDays) updateAccess.mutate({ productId: product.id, accessDays: days }); }} />
                  <span className="text-xs text-white/45">days</span>
                </div>
                {editingId === product.id && <ProductEditor product={product} onSaved={() => { setEditingId(null); productsQuery.refetch(); }} />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProductEditor({ product, onSaved }: { product: { id: number; title: string; category: string; description?: string | null; featuredImageUrl?: string | null; priceCents: number; accessDays: number }; onSaved: () => void }) {
  const [title, setTitle] = useState(product.title);
  const [category, setCategory] = useState<"case_study" | "objective_test" | "marking" | "resource">(product.category as "case_study" | "objective_test" | "marking" | "resource");
  const [description, setDescription] = useState(product.description ?? "");
  const [imageUrl, setImageUrl] = useState(product.featuredImageUrl ?? "");
  const [price, setPrice] = useState((product.priceCents / 100).toFixed(2));
  const [accessDays, setAccessDays] = useState(String(product.accessDays));
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const updateProduct = trpc.admin.updateProduct.useMutation({
    onSuccess: () => { toast.success("Product updated"); utils.admin.products.invalidate(); onSaved(); },
    onError: (error) => toast.error(error.message),
  });
  const uploadImage = trpc.admin.uploadProductImage.useMutation({
    onSuccess: (data) => { toast.success("Image uploaded"); setImageUrl(data.url); utils.admin.products.invalidate(); },
    onError: (error) => toast.error(error.message),
  });

  const handleImageFile = (file: File) => {
    if (!file) return;
    const mimeType = file.type;
    if (mimeType !== "image/png" && mimeType !== "image/jpeg") {
      toast.error("Product image must be a PNG or JPEG");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result);
      setUploading(true);
      uploadImage.mutate({ productId: product.id, fileName: file.name, mimeType, base64 }, { onSettled: () => setUploading(false) });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-[#f4c44e]/30 bg-[#0c0524]/60 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-[.14em] text-[#f4c44e]">Edit product</span>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-white/50" onClick={onSaved}>Close</Button>
      </div>
      <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Product title" className="border-white/10 bg-[#0c0524] text-white" aria-label="Product title" />
      <select value={category} onChange={(event) => setCategory(event.target.value as typeof category)} className="h-10 w-full rounded-lg border border-white/10 bg-[#0c0524] px-3 text-sm text-white" aria-label="Category">
        <option value="objective_test">Objective test</option>
        <option value="case_study">Case study</option>
        <option value="marking">Instructor marking</option>
        <option value="resource">Resource</option>
      </select>
      <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" className="min-h-20 border-white/10 bg-[#0c0524] text-white" />
      <div className="grid grid-cols-2 gap-2">
        <Input type="number" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Price ZAR" className="border-white/10 bg-[#0c0524] text-white" aria-label="Price" />
        <Input type="number" value={accessDays} onChange={(event) => setAccessDays(event.target.value)} placeholder="Access days" className="border-white/10 bg-[#0c0524] text-white" aria-label="Access days" />
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-9 border-[#00e5ff] px-3 text-xs text-[#00e5ff]" disabled={uploading || uploadImage.isPending} onClick={() => fileRef.current?.click()}>
            <ImageUp className="mr-1 h-3 w-3" /> {uploading ? "Uploading…" : "Upload image (PNG/JPEG)"}
          </Button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) handleImageFile(file); event.target.value = ""; }} />
        </div>
        <Input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="Or paste an image URL (https://…)" className="border-white/10 bg-[#0c0524] text-white" aria-label="Featured image URL" />
        {(imageUrl || product.featuredImageUrl) && (
          <img src={imageUrl || product.featuredImageUrl || ""} alt="Product preview" className="h-28 w-full rounded-lg object-cover" />
        )}
      </div>
      <Button className="aft-button w-full" disabled={updateProduct.isPending || !title.trim()} onClick={() => updateProduct.mutate({ productId: product.id, title, category, description, featuredImageUrl: imageUrl || undefined, priceCents: Math.round(Number(price || 0) * 100), accessDays: Number(accessDays) || 30 })}>
        Save product
      </Button>
    </div>
  );
}

function SectionRow({ item, onSave }: { item: { id: number; title: string; detail: string; status: string }; onSave: (title: string) => void }) {
  const [value, setValue] = useState(item.title);
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="text-xs text-white/45">{item.detail}</div>
        <Input value={value} onChange={(event) => setValue(event.target.value)} className="mt-1 h-9 border-white/10 bg-[#0c0524] text-white" aria-label={`Title for ${item.detail}`} />
      </div>
      <Button size="sm" variant="outline" className="h-8 border-[#00ff88] px-3 text-xs text-[#00ff88]" disabled={!value.trim() || value.trim() === item.title} onClick={() => onSave(value.trim())}>
        Save title
      </Button>
    </div>
  );
}

function QuestionForm({ refresh, examItems }: { refresh: () => void; examItems: { id: number; title: string }[] }) {
  const examQuery = trpc.admin.contentItems.useQuery({ kind: "mock_exams" }, { retry: false });
  const objectiveExams = (examQuery.data ?? []).filter((item) => item.detail.startsWith("objective test"));
  const allExams = objectiveExams.length ? objectiveExams : (examQuery.data ?? []);
  const [examId, setExamId] = useState("");
  const [topic, setTopic] = useState("");
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState("");
  const [correct, setCorrect] = useState("0");
  const [rationale, setRationale] = useState("");
  const [qtype, setQtype] = useState<"single_choice" | "multiple_choice" | "dropdown" | "numerical" | "text_input">("single_choice");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const createQuestion = trpc.admin.createObjectiveQuestion.useMutation({
    onSuccess: () => { toast.success("Objective question created as draft"); refresh(); setPrompt(""); setTopic(""); setOptions(""); setRationale(""); },
    onError: (error) => toast.error(error.message),
  });
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white"><Layers3 className="h-5 w-5 text-[#f4c44e]" /> Add objective question</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2">
          <select value={examId} onChange={(event) => setExamId(event.target.value)} className="h-10 rounded-lg border border-white/10 bg-[#0c0524] px-3 text-sm text-white" aria-label="Objective exam">
            <option value="">Select objective exam…</option>
            {allExams.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
          <Input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="Topic" className="border-white/10 bg-[#0c0524] text-white" />
        </div>
        <Textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Original AFT question" className="mt-3 min-h-20 border-white/10 bg-[#0c0524] text-white" />
        <Textarea value={options} onChange={(event) => setOptions(event.target.value)} placeholder="Options, one per line" className="mt-3 min-h-16 border-white/10 bg-[#0c0524] text-white" />
        {qtype !== "numerical" && qtype !== "text_input" && (
          <Textarea value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="Why each option is correct/wrong — one reason per line, aligned with the options above. Leave a line blank if an option has no specific reason." className="mt-3 min-h-16 border-[#f4c44e]/30 bg-[#0c0524] text-sm text-[#e8e2f7]" />
        )}
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <select value={qtype} onChange={(event) => setQtype(event.target.value as typeof qtype)} className="h-10 rounded-lg border border-white/10 bg-[#0c0524] px-3 text-sm text-white" aria-label="Question type">
            <option value="single_choice">Single choice</option>
            <option value="multiple_choice">Multiple choice</option>
            <option value="dropdown">Dropdown</option>
            <option value="numerical">Numerical input</option>
            <option value="text_input">Text input</option>
          </select>
          <Input type="number" value={correct} onChange={(event) => setCorrect(event.target.value)} placeholder="Correct option index" className="border-white/10 bg-[#0c0524] text-white" />
          <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as typeof difficulty)} className="h-10 rounded-lg border border-white/10 bg-[#0c0524] px-3 text-sm text-white" aria-label="Difficulty">
            <option value="medium">Medium</option>
            <option value="easy">Easy</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <Button
          className="aft-button mt-4"
          disabled={createQuestion.isPending || !examId || !topic.trim() || !prompt.trim() || options.split("\n").filter(Boolean).length < 2 || Number(correct) < 0}
          onClick={() => {
            const optionList = options.split("\n").map((line) => line.trim()).filter(Boolean);
            const rationaleList = (qtype === "numerical" || qtype === "text_input") ? [] : rationale.split("\n").map((line) => line.trim());
            while (rationaleList.length < optionList.length) rationaleList.push("");
            createQuestion.mutate({ mockExamId: Number(examId), topic: topic.trim(), prompt: prompt.trim(), options: optionList, correct: Number(correct), questionType: qtype, difficulty, rationale: rationaleList.slice(0, optionList.length) });
          }}
        >
          Create draft question
        </Button>
      </CardContent>
    </Card>
  );
}

function ResourceForm({ refresh, products }: { refresh: () => void; products: { product: { id: number; title: string } }[] }) {
  const [productId, setProductId] = useState("");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"pre_seen" | "formulae" | "printable_pdf" | "feedback" | "course_material" | "reference">("reference");
  const [file, setFile] = useState<{ name: string; type: string; data: string } | null>(null);
  const uploadResource = trpc.admin.uploadResource.useMutation({
    onSuccess: () => { toast.success("Resource uploaded as draft"); refresh(); setFile(null); setTitle(""); },
    onError: (error) => toast.error(error.message),
  });
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white"><FileText className="h-5 w-5 text-[#00e5ff]" /> Upload protected resource</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 md:grid-cols-3">
          <select value={productId} onChange={(event) => setProductId(event.target.value)} className="h-10 rounded-lg border border-white/10 bg-[#0c0524] px-3 text-sm text-white" aria-label="Product">
            <option value="">Select product…</option>
            {products.map(({ product }) => <option key={product.id} value={product.id}>{product.title}</option>)}
          </select>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Resource title" className="border-white/10 bg-[#0c0524] text-white" />
          <select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)} className="h-10 rounded-lg border border-white/10 bg-[#0c0524] px-3 text-sm text-white" aria-label="Resource kind">
            <option value="reference">Reference material</option>
            <option value="pre_seen">Pre-seen</option>
            <option value="formulae">Formulae + tables</option>
            <option value="printable_pdf">Printable PDF</option>
            <option value="feedback">Feedback guide</option>
            <option value="course_material">Course material</option>
          </select>
        </div>
        <input
          type="file"
          accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
          className="mt-3 block w-full text-sm text-[#c4b5fd]"
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (!selected) return;
            const reader = new FileReader();
            reader.onload = () => setFile({ name: selected.name, type: selected.type, data: String(reader.result) });
            reader.readAsDataURL(selected);
          }}
        />
        <Button variant="outline" className="mt-3 border-[#00e5ff] text-white" disabled={uploadResource.isPending || !productId || !file} onClick={() => file && uploadResource.mutate({ productId: Number(productId), title, kind, fileName: file.name, mimeType: file.type, base64: file.data })}>
          {uploadResource.isPending ? "Uploading…" : "Upload as draft"}
        </Button>
      </CardContent>
    </Card>
  );
}

function MarkingTab() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const queueQuery = trpc.marking.queue.useQuery(undefined, { retry: false });
  const assign = trpc.marking.assign.useMutation({
    onSuccess: () => { toast.success("Marking assigned to you"); utils.marking.queue.invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const queue = queueQuery.data ?? [];
  return (
    <div className="mt-8">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-white"><ListChecks className="h-5 w-5 text-[#00e5ff]" /> Marking queue</CardTitle>
          <Badge className="bg-[#102b36] text-[#00ff88]">{queue.length} open</Badge>
        </CardHeader>
        <CardContent>
          {queueQuery.isLoading ? (
            <div className="h-24 animate-pulse rounded-xl bg-[#18093c]" />
          ) : queue.length ? (
            <ul className="space-y-2">
              {queue.map(({ marking }) => (
                <li key={marking.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#18093c]/50 px-4 py-3">
                  <div>
                    <div className="font-semibold text-white">Marking #{marking.id} <StatusBadge status={marking.status} /></div>
                    <div className="mt-1 text-xs text-white/45">Attempt #{marking.attemptId} · {marking.awardedPoints}/{marking.totalPoints} pts</div>
                  </div>
                  <Button size="sm" variant="outline" className="h-8 border-[#00ff88] px-3 text-xs text-[#00ff88]" disabled={assign.isPending || marking.status === "assigned" || marking.status === "in_progress"} onClick={() => user && assign.mutate({ markingId: marking.id, markerId: user.id })}>
                    Assign to me
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-white/45">No submissions awaiting marking.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CouponsTab() {
  const couponsQuery = trpc.admin.coupons.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const coupons = couponsQuery.data ?? [];
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editDiscountType, setEditDiscountType] = useState<"percent" | "fixed">("percent");
  const [editValue, setEditValue] = useState("");
  const [editMaxUses, setEditMaxUses] = useState("");
  const [editExpiresAt, setEditExpiresAt] = useState("");

  const refresh = () => utils.admin.coupons.invalidate();

  const create = trpc.admin.createCoupon.useMutation({
    onSuccess: () => {
      toast.success("Coupon created");
      refresh();
      setCode(""); setValue(""); setMaxUses(""); setExpiresAt("");
    },
    onError: (error) => toast.error(error.message),
  });
  const toggle = trpc.admin.revokeCoupon.useMutation({
    onSuccess: (result) => {
      toast.success(result.status === "disabled" ? "Coupon disabled" : "Coupon enabled");
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const update = trpc.admin.updateCoupon.useMutation({
    onSuccess: () => {
      toast.success("Coupon updated");
      refresh();
      setEditingId(null);
    },
    onError: (error) => toast.error(error.message),
  });
  const remove = trpc.admin.deleteCoupon.useMutation({
    onSuccess: () => {
      toast.success("Coupon deleted");
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const submit = () => {
    if (!code.trim()) { toast.error("Enter a coupon code"); return; }
    const numValue = Number(value);
    if (!Number.isFinite(numValue) || numValue <= 0) { toast.error("Enter a valid discount value"); return; }
    create.mutate({
      code: code.trim(),
      discountType,
      value: Math.round(numValue),
      maxUses: maxUses ? Math.max(0, Math.round(Number(maxUses))) : undefined,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
    });
  };

  const startEdit = (coupon: { id: number; code: string; discountType: "percent" | "fixed"; value: number; maxUses: number; expiresAt: Date | null }) => {
    setEditingId(coupon.id);
    setEditCode(coupon.code);
    setEditDiscountType(coupon.discountType);
    setEditValue(String(coupon.value));
    setEditMaxUses(coupon.maxUses > 0 ? String(coupon.maxUses) : "");
    setEditExpiresAt(coupon.expiresAt ? toDatetimeLocal(new Date(coupon.expiresAt)) : "");
  };

  const submitEdit = () => {
    if (!editCode.trim()) { toast.error("Enter a coupon code"); return; }
    const numValue = Number(editValue);
    if (!Number.isFinite(numValue) || numValue <= 0) { toast.error("Enter a valid discount value"); return; }
    update.mutate({
      couponId: editingId!,
      code: editCode.trim(),
      discountType: editDiscountType,
      value: Math.round(numValue),
      maxUses: editMaxUses ? Math.max(0, Math.round(Number(editMaxUses))) : undefined,
      expiresAt: editExpiresAt ? new Date(editExpiresAt).toISOString() : null,
    });
  };

  const confirmDelete = (coupon: { id: number; code: string }) => {
    if (window.confirm(`Delete coupon "${coupon.code}"? This permanently removes it and its redemptions.`)) {
      remove.mutate({ couponId: coupon.id });
    }
  };

  return (
    <div className="space-y-7">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white"><Ticket className="h-5 w-5 text-[#00ff88]" /> Create a coupon code</CardTitle>
          <p className="text-sm leading-6 text-white/50">
            Learners apply the code at checkout for a discount. Percent coupons reduce the cart total by a percentage; fixed coupons reduce it by a set rand amount.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[1.2fr_160px_140px_140px_170px_auto]">
            <Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="e.g. SAVE10" className="border-white/10 bg-[#0c0524] text-white uppercase" />
            <select
              value={discountType}
              onChange={(event) => setDiscountType(event.target.value as "percent" | "fixed")}
              className="h-11 rounded-lg border border-white/10 bg-[#0c0524] px-3 text-sm text-white"
              aria-label="Discount type"
            >
              <option value="percent">Percent %</option>
              <option value="fixed">Fixed R</option>
            </select>
            <Input value={value} onChange={(event) => setValue(event.target.value)} type="number" min="1" placeholder={discountType === "percent" ? "Percent" : "Rand"} className="border-white/10 bg-[#0c0524] text-white" />
            <Input value={maxUses} onChange={(event) => setMaxUses(event.target.value)} type="number" min="0" placeholder="Max uses" className="border-white/10 bg-[#0c0524] text-white" />
            <Input value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} type="datetime-local" aria-label="Expiry" className="border-white/10 bg-[#0c0524] text-white" />
            <Button className="aft-button" disabled={create.isPending} onClick={submit}>{create.isPending ? "Creating..." : "Create coupon"}</Button>
          </div>
          <p className="mt-3 text-xs leading-5 text-white/50">Leave "Max uses" empty for unlimited use and the expiry field empty for no expiry.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-white">Coupon codes</CardTitle>
          {coupons.length ? <Badge className="bg-[#102b36] text-[#00ff88]">{coupons.length} coupon{coupons.length === 1 ? "" : "s"}</Badge> : null}
        </CardHeader>
        <CardContent>
          {coupons.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/45">No coupons yet. Create your first coupon above.</p>
          ) : (
            <div className="space-y-3">
              {coupons.map((coupon) => (
                <div key={coupon.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#18093c]/50 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-bold text-white">{coupon.code} <Badge className={coupon.status === "active" ? "bg-[#102b36] text-[#00ff88]" : "bg-[#3a2030] text-[#ff6b6b]"}>{coupon.status}</Badge></div>
                    <div className="mt-1 text-xs text-white/45">
                      {coupon.discountType === "percent" ? `${coupon.value}% off` : `R${(coupon.value / 100).toFixed(2)} off`}
                      {coupon.maxUses > 0 ? ` · ${coupon.usedCount}/${coupon.maxUses} used` : ` · ${coupon.usedCount} used`}
                      {coupon.expiresAt ? ` · expires ${new Date(coupon.expiresAt).toLocaleDateString()}` : ""}
                    </div>
                    <div className="mt-0.5 text-[11px] text-white/35">{coupon.createdByName ?? coupon.createdByEmail ?? "Staff"}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {editingId === coupon.id ? (
                      <>
                        <Button size="sm" className="h-8 px-3 text-xs text-[#00ff88]" disabled={update.isPending} onClick={submitEdit}>{update.isPending ? "Saving..." : "Save"}</Button>
                        <Button size="sm" variant="ghost" className="h-8 px-3 text-xs text-white/60" onClick={() => setEditingId(null)}>Cancel</Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" className="h-8 border-[#00e5ff]/60 px-3 text-xs text-[#00e5ff]" onClick={() => startEdit(coupon)}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
                        <Button size="sm" variant="outline" className="h-8 border-white/10 px-3 text-xs text-white/60" disabled={toggle.isPending} onClick={() => toggle.mutate({ couponId: coupon.id })}>
                          {coupon.status === "active" ? "Disable" : "Enable"}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2 text-[#ff8278]" disabled={remove.isPending} onClick={() => confirmDelete(coupon)}><Trash2 className="h-4 w-4" /></Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {editingId !== null && (
        <Card className="border-[#00e5ff]/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white"><Pencil className="h-5 w-5 text-[#00e5ff]" /> Edit coupon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-[1fr_160px_120px_140px_170px]">
              <Input value={editCode} onChange={(event) => setEditCode(event.target.value)} placeholder="Coupon code" className="border-white/10 bg-[#0c0524] text-white uppercase" />
              <select
                value={editDiscountType}
                onChange={(event) => setEditDiscountType(event.target.value as "percent" | "fixed")}
                className="h-11 rounded-lg border border-white/10 bg-[#0c0524] px-3 text-sm text-white"
                aria-label="Edit discount type"
              >
                <option value="percent">Percent %</option>
                <option value="fixed">Fixed R</option>
              </select>
              <Input value={editValue} onChange={(event) => setEditValue(event.target.value)} type="number" min="1" placeholder={editDiscountType === "percent" ? "Percent" : "Rand"} className="border-white/10 bg-[#0c0524] text-white" />
              <Input value={editMaxUses} onChange={(event) => setEditMaxUses(event.target.value)} type="number" min="0" placeholder="Max uses" className="border-white/10 bg-[#0c0524] text-white" />
              <div className="flex items-center gap-2">
                <Input value={editExpiresAt} onChange={(event) => setEditExpiresAt(event.target.value)} type="datetime-local" aria-label="Edit expiry" className="border-white/10 bg-[#0c0524] text-white" />
                {editExpiresAt && <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-white/50" onClick={() => setEditExpiresAt("")}>Clear</Button>}
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Button className="aft-button" disabled={update.isPending} onClick={submitEdit}>{update.isPending ? "Saving..." : "Save changes"}</Button>
              <Button variant="outline" className="border-white/15 text-white/70" onClick={() => setEditingId(null)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function toDatetimeLocal(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function ExamPreviewModal({ data, loading, onClose }: { data: { mockExam: { title: string; examType: string; intro: string | null; totalDurationSeconds: number; status: string }; product: { title: string; description: string | null; priceCents: number; accessDays: number }; sections: { sectionNumber: number; title: string; introduction: string | null; scenario: string | null; question: string | null; durationSeconds: number }[]; questions: { topic: string; learningOutcome: string | null; questionType: string; prompt: string; optionsJson: string; answerJson: string; explanation: string | null; difficulty: string }[]; email: { from?: string | null; to?: string | null; subject?: string | null; html?: string | null } | null } | null; loading: boolean; onClose: () => void }) {
  const isCaseStudy = data?.mockExam.examType === "case_study";
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#120730]/85 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-auto my-8 w-full max-w-4xl rounded-2xl border border-white/10 bg-[#0c0524] p-6 sm:p-8" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="eyebrow">Exam preview · {data?.mockExam.examType === "case_study" ? "Case study" : data?.mockExam.examType === "objective_test" ? "Objective test" : "—"}</p>
            <h2 className="mt-2 text-3xl font-black text-white">{data?.mockExam.title ?? "Loading preview…"}</h2>
            <p className="mt-1 text-sm text-white/45">Read-only preview of this exam, including unfinished drafts.</p>
          </div>
          <Button variant="outline" className="border-[#00ff88] text-[#00ff88]" onClick={onClose}>Close preview</Button>
        </div>

        {loading && <div className="mt-8 h-40 animate-pulse rounded-xl bg-[#18093c]" />}

        {!loading && data && (
          <div className="mt-6 space-y-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-[#18093c]/50 p-4"><div className="text-[11px] font-bold uppercase tracking-wider text-white/45">Status</div><StatusBadge status={data.mockExam.status} /></div>
              <div className="rounded-xl border border-white/10 bg-[#18093c]/50 p-4"><div className="text-[11px] font-bold uppercase tracking-wider text-white/45">Duration</div><div className="mt-1 font-bold text-white">{Math.round(data.mockExam.totalDurationSeconds / 60)} minutes</div></div>
              <div className="rounded-xl border border-white/10 bg-[#18093c]/50 p-4"><div className="text-[11px] font-bold uppercase tracking-wider text-white/45">Price</div><div className="mt-1 font-bold text-white">{zar(data.product.priceCents)}</div></div>
              <div className="rounded-xl border border-white/10 bg-[#18093c]/50 p-4"><div className="text-[11px] font-bold uppercase tracking-wider text-white/45">Access</div><div className="mt-1 font-bold text-white">{data.product.accessDays} days</div></div>
            </div>

            {data.mockExam.intro && <section><h3 className="mb-2 text-sm font-bold uppercase tracking-[.14em] text-[#00ff88]">Introduction</h3><p className="whitespace-pre-wrap leading-7 text-[#c4b5fd]">{data.mockExam.intro}</p></section>}
            {data.product.description && <section><h3 className="mb-2 text-sm font-bold uppercase tracking-[.14em] text-[#00ff88]">Store description</h3><p className="whitespace-pre-wrap leading-7 text-[#c4b5fd]">{data.product.description}</p></section>}

            {isCaseStudy && data.email && (data.email.from || data.email.to || data.email.subject || data.email.html) && (
              <section>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-[.14em] text-[#00ff88]">Email attachment</h3>
                <div className="overflow-hidden rounded-xl border border-white/10">
                  <div className="grid gap-px bg-white/10 sm:grid-cols-2">
                    <div className="bg-[#0c0524] px-4 py-2 text-sm text-[#c4b5fd]"><span className="text-white/45">From:</span> {data.email.from || "—"}</div>
                    <div className="bg-[#0c0524] px-4 py-2 text-sm text-[#c4b5fd]"><span className="text-white/45">To:</span> {data.email.to || "—"}</div>
                  </div>
                  <div className="border-t border-white/10 bg-[#0c0524] px-4 py-2 text-sm font-semibold text-white">Subject: {data.email.subject || "—"}</div>
                  <div className="border-t border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-6 text-[#c4b5fd]" dangerouslySetInnerHTML={{ __html: data.email.html ?? "" }} />
                </div>
              </section>
            )}

            {isCaseStudy && data.sections.length > 0 && (
              <section>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-[.14em] text-[#00ff88]">Sections / tasks ({data.sections.length})</h3>
                <div className="space-y-3">
                  {data.sections.map((section) => (
                    <div key={section.sectionNumber} className="rounded-xl border border-white/10 bg-[#18093c]/50 p-4">
                      <div className="flex items-center justify-between gap-3"><span className="font-bold text-white">{section.title}</span><Badge className="bg-[#102b36] text-[#00ff88]">{section.durationSeconds / 60} min</Badge></div>
                      {section.introduction && <p className="mt-3 text-sm leading-6 text-[#c4b5fd]"><span className="font-semibold text-white/70">Introduction: </span>{section.introduction}</p>}
                      {section.scenario && <p className="mt-2 text-sm leading-6 text-[#c4b5fd]"><span className="font-semibold text-white/70">Scenario: </span>{section.scenario}</p>}
                      {section.question && <p className="mt-2 text-sm leading-6 text-[#c4b5fd]"><span className="font-semibold text-white/70">Question: </span>{section.question}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {!isCaseStudy && data.questions.length > 0 && (
              <section>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-[.14em] text-[#00ff88]">Questions ({data.questions.length})</h3>
                <div className="space-y-3">
                  {data.questions.map((question, index) => {
                    let options: string[] = [];
                    try { options = JSON.parse(question.optionsJson) as string[]; } catch { /* ignore */ }
                    let answers: string[] = [];
                    try {
                      const parsed = JSON.parse(question.answerJson);
                      answers = Array.isArray(parsed) ? (parsed as string[]) : parsed == null ? [] : [String(parsed)];
                    } catch { answers = question.answerJson ? [question.answerJson] : []; }
                    const needsOptions = question.questionType !== "numerical" && question.questionType !== "text_input";
                    return (
                      <div key={index} className="rounded-xl border border-white/10 bg-[#18093c]/50 p-4">
                        <div className="flex items-center justify-between gap-3"><span className="font-bold text-white">Q{index + 1} · {question.topic || "General"}</span><Badge className="bg-[#102b36] text-[#00e5ff]">{question.questionType.replace("_", " ")}</Badge></div>
                        <p className="mt-3 text-sm leading-6 text-[#c4b5fd]">{question.prompt}</p>
                        {needsOptions && options.length > 0 && (
                          <ul className="mt-3 space-y-1">{options.map((option, optionIndex) => <li key={optionIndex} className="rounded-lg bg-[#0c0524] px-3 py-2 text-sm text-[#c4b5fd]">{String.fromCharCode(65 + optionIndex)}. {option}</li>)}</ul>
                        )}
                        {Array.isArray(answers) && answers.length > 0 && <p className="mt-3 text-xs text-[#00ff88]">Correct: {answers.join(", ")}</p>}
                        {question.explanation && <p className="mt-2 text-sm leading-6 text-[#c4b5fd]"><span className="font-semibold text-white/70">Explanation: </span>{question.explanation}</p>}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {isCaseStudy && data.sections.length === 0 && <p className="text-sm text-white/45">No sections added yet.</p>}
            {!isCaseStudy && data.questions.length === 0 && <p className="text-sm text-white/45">No questions added yet.</p>}
          </div>
        )}

        <div className="mt-8 flex justify-end border-t border-white/10 pt-5">
          <Button className="aft-button" onClick={onClose}>Close preview</Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminConsole({ mode }: { mode: "admin" | "instructor" }) {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState(mode === "instructor" ? "Content" : "Overview");

  if (loading) return <div className="min-h-screen bg-[#0c0524]" />;
  if (!isAuthenticated || !user) return <DeniedState title="Staff sign in required" copy="This area is restricted to authorized Accountants for Tomorrow staff. Sign in to continue." />;
  if (mode === "instructor" ? user.role !== "instructor" && user.role !== "admin" : user.role !== "admin") {
    return <DeniedState title="Access restricted" copy="You need administrator privileges to manage learners, payments, and allocations. Content uploads are available to instructors in their studio." />;
  }

  const isAdmin = user.role === "admin";
  const tabs = isAdmin ? ["Overview", "Payments", "Coupons", "Users", "Entitlements", "Content", "Marking queue"] : ["Content", "Marking queue"];

  return (
    <div className="min-h-screen bg-[#0c0524]">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 bg-[#120730] p-6 text-white md:block">
          <BrandMark />
          <div className="mt-12 text-xs font-bold uppercase tracking-[.16em] text-white/45">Administration</div>
          <nav className="mt-5 space-y-1">
            {tabs.map((item) => (
              <button
                key={item}
                onClick={() => setTab(item)}
                className={`w-full rounded-lg px-3 py-3 text-left text-sm font-semibold ${tab === item ? "bg-[#18093c]/12 text-[#00ff88]" : "text-white/75 hover:bg-[#18093c]/8 hover:text-white"}`}
              >
                {item}
              </button>
            ))}
          </nav>
          <div className="mt-12 space-y-2">
            <Button variant="outline" className="w-full border-[#00e5ff] text-white" onClick={() => navigate("/mock-exams")}>
              View store
            </Button>
            <Button
              variant="ghost"
              className="w-full text-white/70"
              onClick={async () => {
                await logout();
                navigate("/");
              }}
            >
              Sign out
            </Button>
          </div>
          <div className="mt-6 rounded-xl border border-white/15 bg-[#18093c]/5 p-4 text-sm text-white/70">
            <ShieldCheck className="h-5 w-5 text-[#00ff88]" />
            <p className="mt-3 leading-6">Content changes are audited and publishing is permission-controlled.</p>
          </div>
        </aside>
        <main className="container py-10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow">Staff console</p>
              <h1 className="mt-2 text-4xl font-bold text-white">{tab}</h1>
            </div>
            <Badge className="bg-[#102b36] text-[#00ff88]">{user.role === "instructor" ? "Instructor" : "Administrator"} · {user.email}</Badge>
          </div>
          <Separator className="my-6" />
          {tab === "Overview" && <OverviewTab />}
          {tab === "Payments" && <PaymentsTab />}
          {tab === "Coupons" && <CouponsTab />}
          {tab === "Users" && <UsersTab />}
          {tab === "Entitlements" && <EntitlementsTab />}
          {tab === "Content" && <ContentTab />}
          {tab === "Marking queue" && <MarkingTab />}
        </main>
      </div>
    </div>
  );
}