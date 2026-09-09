import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import {
  ArrowRight,
  BookOpen,
  Calculator,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Flag,
  GraduationCap,
  HelpCircle,
  Layers3,
  LockKeyhole,
  LogOut,
  Menu,
  MonitorPlay,
  PenLine,
  PlayCircle,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  TimerReset,
  UserRound,
  Bell,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { toast } from "sonner";
import ObjectiveTestsPanel from "@/components/ObjectiveTestsPanel";
import ProtectedResourceView from "@/components/ProtectedResourceView";
import { trpc } from "@/lib/trpc";
import { clearCartStorage } from "@/pages/Cart";
import { getAttemptProgress, humanizeStatus } from "@shared/learning";
import { calculateRubricScore, RUBRIC_CRITERIA } from "@shared/rubric";
import { getAttemptRoute, getDashboardSelection, getDashboardSelectionState, getDashboardView, getExamRetakeRoute, getProductRoute, type DashboardTab } from "@shared/dashboard";
import { canViewIllustrativeSolutions, getIllustrativeSolutions, solutionAccessLabel } from "@shared/solutions";
import { hasActiveEntitlement } from "@shared/integrity";
import { subscriptionDaysRemaining } from "@shared/payments";
import { calculateExamExpression } from "@shared/examCalculator";
import { canStartExamBeforeCooldown, shouldAutoStartExam } from "@shared/examFlow";

const navy = "#0c0524";
const green = "#00ff88";
const formatExamTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return <span aria-label="Accountants for Tomorrow" className="inline-flex items-center">
    <img src="/assets/aft_logo_white.png" alt="Accountants for Tomorrow" className={inverse ? "h-10 w-auto object-contain" : "h-10 w-auto object-contain"} />
  </span>;
}

function PublicHeader({ onLogin }: { onLogin: () => void }) {
  const [shopOpen, setShopOpen] = useState(false);
  const [mockExamsOpen, setMockExamsOpen] = useState(false);
  const [otherProductsOpen, setOtherProductsOpen] = useState(false);
  const shopRef = useRef<HTMLDivElement>(null);
  const mockExamsRef = useRef<HTMLDivElement>(null);
  const otherProductsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shopRef.current && !shopRef.current.contains(event.target as Node)) {
        setShopOpen(false);
        setMockExamsOpen(false);
        setOtherProductsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <div className="utility-bar">
        <div className="container flex items-center justify-end gap-6 text-[11px] font-semibold text-white/80">
          <span>Professional training. Clear and simple.</span>
          <span>South Africa</span>
        </div>
      </div>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#18093c]/95 backdrop-blur">
        <div className="container flex h-[76px] items-center justify-between gap-8">
          <Link href="/" className="shrink-0"><BrandMark /></Link>
          <nav className="hidden items-center gap-7 text-[13px] font-semibold text-white lg:flex">
            <Link href="/" className="nav-link nav-link-active">Home</Link>
            <div className="relative" ref={shopRef}>
              <button
                type="button"
                className="nav-link flex items-center gap-1"
                onClick={() => { setShopOpen(!shopOpen); setMockExamsOpen(false); setOtherProductsOpen(false); }}
                onMouseEnter={() => setShopOpen(true)}
              >
                Shop <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {shopOpen && (
                <div
                  className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-white/10 bg-[#120730] py-1 shadow-xl"
                  onMouseLeave={() => { setShopOpen(false); setMockExamsOpen(false); setOtherProductsOpen(false); }}
                >
                  <div className="relative" ref={mockExamsRef}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-4 py-2 text-sm text-white hover:bg-[#14265b]"
                      onClick={() => setMockExamsOpen(!mockExamsOpen)}
                      onMouseEnter={() => setMockExamsOpen(true)}
                    >
                      Mock exams
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                    {mockExamsOpen && (
                      <div className="absolute left-full top-0 z-50 ml-1 min-w-[180px] rounded-lg border border-white/10 bg-[#120730] py-1 shadow-xl">
                        <Link href="/mock-exams" className="block px-4 py-2 text-sm text-white hover:bg-[#14265b]" onClick={() => { setShopOpen(false); setMockExamsOpen(false); }}>
                          Case study exams
                        </Link>
                        <Link href="/objective-tests" className="block px-4 py-2 text-sm text-white hover:bg-[#14265b]" onClick={() => { setShopOpen(false); setMockExamsOpen(false); }}>
                          Objective tests
                        </Link>
                      </div>
                    )}
                  </div>
                  <div className="relative" ref={otherProductsRef}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-4 py-2 text-sm text-white hover:bg-[#14265b]"
                      onClick={() => setOtherProductsOpen(!otherProductsOpen)}
                      onMouseEnter={() => setOtherProductsOpen(true)}
                    >
                      Other products
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                    {otherProductsOpen && (
                      <div className="absolute left-full top-0 z-50 ml-1 min-w-[180px] rounded-lg border border-white/10 bg-[#120730] py-1 shadow-xl">
                        <Link href="/mock-exams" className="block px-4 py-2 text-sm text-white hover:bg-[#14265b]" onClick={() => { setShopOpen(false); setOtherProductsOpen(false); }}>
                          Case study exams
                        </Link>
                        <Link href="/objective-tests" className="block px-4 py-2 text-sm text-white hover:bg-[#14265b]" onClick={() => { setShopOpen(false); setOtherProductsOpen(false); }}>
                          Objective tests
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <a className="nav-link" href="#resources">Study resources</a>
            <Link href="/dashboard" className="nav-link">My Account</Link>
            <Link href="/cart" className="nav-link">Cart</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" className="hidden text-white sm:inline-flex" onClick={onLogin}>Log in</Button>
            <Button className="aft-button" onClick={onLogin}>Create account <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </div>
        </div>
      </header>
    </>
  );
}

function ExamCalculator() {
  const [expression, setExpression] = useState("");
  const [display, setDisplay] = useState("0");
  const press = (value: string) => {
    if (value === "C") { setExpression(""); setDisplay("0"); return; }
    if (value === "⌫") { const next = expression.slice(0, -1); setExpression(next); setDisplay(next || "0"); return; }
    if (value === "=") { try { const result = calculateExamExpression(expression); setExpression(result); setDisplay(result); } catch (error) { setDisplay(error instanceof Error ? error.message : "Invalid calculation"); } return; }
    const next = `${expression}${value}`;
    setExpression(next);
    setDisplay(next);
  };
  return <div className="exam-calculator">
    <div className="exam-calculator-display" aria-live="polite">{display}</div>
    <div className="exam-calculator-grid">{["C", "⌫", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "0", ".", "(", ")", "="].map((key) => <button key={key} type="button" onClick={() => press(key)} className={key === "=" ? "exam-calculator-key exam-calculator-equals" : key === "C" ? "exam-calculator-key exam-calculator-clear" : "exam-calculator-key"}>{key}</button>)}</div>
    <p className="mt-3 text-xs text-white/45">For exam working only. Results are not saved to your submission.</p>
  </div>;
}

function ExamUtilityRail({ onResource }: { onResource?: (resource: string) => void }) {
  const [localResource, setLocalResource] = useState<string | null>(null);
  const [utilityVisible, setUtilityVisible] = useState(true);
  const queryProductId = typeof window === "undefined" ? 0 : Number(new URLSearchParams(window.location.search).get("productId") || 0);
  const mockExamId = typeof window === "undefined" ? 0 : Number(new URLSearchParams(window.location.search).get("mockExamId") || 0);
  const mockExamsQuery = trpc.catalogue.mockExams.useQuery(undefined, { retry: false, enabled: !onResource });
  const productId = queryProductId || mockExamsQuery.data?.find((item) => item.mockExam.id === mockExamId)?.mockExam.productId || 0;
  const resourcesQuery = trpc.resources.list.useQuery({ productId }, { retry: false, enabled: !onResource && Boolean(productId) });
  const open = (resource: string) => onResource ? onResource(resource) : setLocalResource(resource);
  useEffect(() => {
    if (onResource || typeof window === "undefined") return;
    let lastScrollY = window.scrollY;
    const onScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY < 24 || currentScrollY < lastScrollY) setUtilityVisible(true);
      else if (currentScrollY > lastScrollY + 4) setUtilityVisible(false);
      lastScrollY = currentScrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [onResource]);
  return <>
    <aside className={`exam-utility-rail ${onResource ? "exam-utility-rail-shell" : "exam-utility-rail-public"} ${utilityVisible ? "" : "is-collapsed"}`} aria-label="Exam utilities">
      <button type="button" onClick={() => open("pre-seen")} className="exam-utility-button exam-utility-button-preseen"><BookOpen className="h-4 w-4" /><span>Pre-seen</span></button>
      <button type="button" onClick={() => open("formulae")} className="exam-utility-button"><Layers3 className="h-4 w-4" /><span>Formulae + tables</span></button>
      <button type="button" onClick={() => open("calculator")} className="exam-utility-button"><Calculator className="h-4 w-4" /><span>Calculator</span></button>
    </aside>
    {!onResource && localResource && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#120730]/70 p-4" onClick={() => setLocalResource(null)}><Card className="w-full max-w-xl border-[#00e5ff]/30 bg-[#120730]" onClick={(event) => event.stopPropagation()}><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-white">{localResource === "pre-seen" ? "Pre-seen · AFT illustrative brief" : localResource === "formulae" ? "Formulae + tables" : "Calculator"}</CardTitle><Button size="icon" variant="ghost" onClick={() => setLocalResource(null)}><X className="h-4 w-4" /></Button></CardHeader><CardContent>{localResource === "calculator" ? <ExamCalculator /> : localResource === "pre-seen" ? (() => { const preSeenMatch = resourcesQuery.data?.find((item) => item.kind === "pre_seen"); return preSeenMatch ? <ProtectedResourceView resource={preSeenMatch} /> : <div className="space-y-4 text-sm leading-7 text-[#c4b5fd]"><p className="rounded-lg border border-[#00ff88]/30 bg-[#102b36] p-3 text-xs font-semibold text-[#00ff88]">AFT-created illustrative pre-seen · not an official CIMA document</p><p><strong className="text-white">SoPa Foods</strong> is a regional convenience-food business considering a takeaway and home-delivery service. Management is assessing demand, delivery economics, operational capacity, data quality, and the control environment before approving the pilot.</p><p>The finance team has been asked to evaluate contribution margins, route density, working-capital exposure, service quality measures, and the risks of scaling before the next planning meeting.</p></div>; })() : (() => { const formulaeMatch = resourcesQuery.data?.find((item) => item.kind === "formulae" && item.hasFile); if (formulaeMatch) return <ProtectedResourceView resource={formulaeMatch} />; return <><p>Formulae and tables are available here for this imported mock-exam workspace. Use the protected published document when attached to your entitlement.</p><div className="grid gap-2 sm:grid-cols-2"><div className="rounded-lg border border-white/10 bg-[#18093c] p-3"><strong className="text-white">Contribution</strong><br />Revenue − variable cost</div><div className="rounded-lg border border-white/10 bg-[#18093c] p-3"><strong className="text-white">Break-even volume</strong><br />Fixed cost ÷ contribution per unit</div></div></>})()}<Button variant="outline" className="mt-5 border-[#00e5ff] text-[#00e5ff]" onClick={() => setLocalResource(null)}>Close</Button></CardContent></Card></div>}
  </>;
}

function ExamShell({ screen, setScreen }: { screen: string; setScreen: (next: string) => void }) {
  const [answer, setAnswer] = useState("");
  const [saved, setSaved] = useState(false);
  const saveAnswer = trpc.exams.saveAnswer.useMutation();
  const submitAttempt = trpc.exams.submit.useMutation();
  const attemptId = typeof window === "undefined" ? 0 : Number(new URLSearchParams(window.location.search).get("attempt") || window.sessionStorage.getItem("aft-attempt-id") || 0);
  const [countdown, setCountdown] = useState(screen === "intro" ? 30 : 0);
  const introTimerStarted = useRef(false);
  const transitioningToSubmission = useRef(false);
  const [sectionSeconds, setSectionSeconds] = useState(45 * 60);
  const [resource, setResource] = useState<string | null>(null);
  const attemptContextQuery = trpc.exams.attemptContext.useQuery({ attemptId }, { retry: false, enabled: Boolean(attemptId) });
  const examProductId = attemptContextQuery.data?.productId ?? 0;
  const examResourcesQuery = trpc.resources.list.useQuery({ productId: examProductId || 1 }, { retry: false, enabled: Boolean(examProductId) });
  const isIntro = screen === "intro";
  const isQuestion = screen === "question";
  const attemptLocked = Boolean(attemptContextQuery.data?.status && attemptContextQuery.data.status !== "in_progress");
  const section = screen === "instructions" ? "Exam timings and instructions" : screen === "intro" ? "Section 1 introduction" : "Question 1 of 4";
  useEffect(() => {
    if (attemptLocked && (isIntro || isQuestion)) {
      setScreen("debrief");
      return;
    }
    if (!isIntro) {
      introTimerStarted.current = false;
      return;
    }
    if (!introTimerStarted.current) {
      introTimerStarted.current = true;
      setCountdown(30);
      return;
    }
    if (shouldAutoStartExam(countdown)) {
      setScreen("question");
      return;
    }
    const timer = window.setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [countdown, isIntro, setScreen]);
  useEffect(() => {
    if (!isQuestion || sectionSeconds <= 0) return;
    const timer = window.setInterval(() => setSectionSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [isQuestion, sectionSeconds]);
  useEffect(() => {
    if (!isQuestion || attemptLocked || !attemptId || !answer.trim()) return;
    const timer = window.setTimeout(() => saveAnswer.mutate({ attemptId, sectionId: 1, body: answer, wordCount: answer.trim().split(/\s+/).length }, { onSuccess: () => setSaved(true) }), 700);
    return () => window.clearTimeout(timer);
  }, [answer, attemptId, isQuestion]);
  useEffect(() => {
    if (!isQuestion || sectionSeconds > 0 || attemptLocked || !attemptId) return;
    transitioningToSubmission.current = true;
    toast.warning("Time is up — your exam is being submitted with the answers saved so far.");
    submitAttempt.mutate({ attemptId, optOutOfMarking: true }, { onSuccess: () => setScreen("debrief"), onError: (error) => { toast.error(error.message); setScreen("debrief"); } });
  }, [isQuestion, sectionSeconds, attemptLocked, attemptId]);
  useEffect(() => {
    if (!attemptId || attemptLocked) return;
    const submitBeacon = () => {
      if (transitioningToSubmission.current || !attemptId) return;
      try {
        navigator.sendBeacon(`/api/auto-submit?attempt=${attemptId}`);
      } catch {
        // Beacon failure must never block the leave navigation.
      }
    };
    window.addEventListener("beforeunload", submitBeacon);
    window.addEventListener("pagehide", submitBeacon);
    return () => {
      window.removeEventListener("beforeunload", submitBeacon);
      window.removeEventListener("pagehide", submitBeacon);
      submitBeacon();
    };
  }, [attemptId, attemptLocked]);
  const endSession = () => {
    if (!window.confirm("End and submit this exam now? Your exam will be submitted with the answers saved so far and cannot be resumed.")) return;
    if (attemptLocked || !attemptId) { setScreen("debrief"); return; }
    submitAttempt.mutate({ attemptId, optOutOfMarking: true }, { onSuccess: () => { toast.success("Exam submitted with your saved answers."); setScreen("debrief"); }, onError: (error) => { toast.error(error.message); setScreen("debrief"); } });
  };

  return (
    <div className="exam-shell min-h-screen bg-[#0c0524]">
      <div className="exam-topbar">
        <div className="exam-brand-tools"><BrandMark inverse /><ExamUtilityRail onResource={setResource} /></div>
      </div>
      <div className="exam-titlebar">
        <div className="flex items-center gap-3"><Menu className="h-5 w-5" /><span>CIMA OCS Mock Exam 1</span></div>
        <div className="flex items-center gap-2 font-semibold"><Clock3 className="h-5 w-5" /> {isIntro ? `00:${String(countdown).padStart(2, "0")}` : isQuestion ? formatExamTime(sectionSeconds) : "45 minutes"}</div>
      </div>
      <div className="exam-sessionbar"><div className="text-xs font-semibold uppercase tracking-[.14em] text-white/45">Exam controls</div><div className="flex items-center gap-5 text-sm font-semibold text-white"><button onClick={() => toast.info("Exam help will be available from the configured exam administrator.")} className="exam-top-action"><HelpCircle className="h-4 w-4" /> Help</button><button onClick={endSession} className="exam-top-action"><X className="h-4 w-4" /> End session</button></div></div>
      <main className="container exam-container py-7">
        <div className="mb-5 flex justify-end"><Badge className="rounded-full bg-[#102b36] px-3 py-1 text-[#00ff88]">Autosave on</Badge></div>
        {screen === "instructions" && (
          <Card className="exam-card mx-auto max-w-5xl">
            <CardHeader className="border-b border-white/10 px-8 py-7"><Badge className="w-fit bg-[#102b36] text-[#00ff88]">Interactive mode</Badge><CardTitle className="mt-3 text-3xl text-white">Exam timings and instructions</CardTitle><p className="max-w-2xl text-[#c4b5fd]">Work through each section under timed conditions in a single sitting. Your answers are autosaved as you type. Ending the session or leaving the page automatically submits the exam with the answers saved so far — it cannot be resumed later.</p></CardHeader>
            <CardContent className="px-8 py-7">
              <div className="grid gap-3 md:grid-cols-2">
                {["Section 1", "Section 2", "Section 3", "Section 4"].map((item, index) => <div key={item} className="flex items-center justify-between rounded-xl border border-white/10 bg-[#18093c] p-4"><div><div className="font-bold text-white">{item}</div><div className="text-sm text-white/50">Case-study task set</div></div><Badge variant="outline" className="border-[#00ff88] text-[#00ff88]">45 minutes</Badge></div>)}
              </div>
              <div className="mt-7 rounded-xl bg-[#102b36] p-5 text-sm leading-6 text-[#c4b5fd]"><div className="mb-2 flex items-center gap-2 font-bold text-white"><ShieldCheck className="h-5 w-5 text-[#00e5ff]" /> Before you begin</div>Keep the Pre-seen and permitted reference materials available. Your answers are autosaved continuously. If you leave the page or end the session, the exam is submitted automatically with the answers saved so far — there is no pause or resume.</div>
              <div className="mt-7 flex flex-wrap justify-end gap-3"><Button variant="outline" className="border-[#00e5ff] text-white" onClick={() => setScreen("mode")}>Back</Button><Button className="aft-button" onClick={() => setScreen("intro")}>Start Section 1 <ArrowRight className="ml-2 h-4 w-4" /></Button></div>
            </CardContent>
          </Card>
        )}
        {isIntro && (
          <Card className="exam-card mx-auto max-w-5xl">
            <CardContent className="p-9">
              <div className="flex flex-wrap items-start justify-between gap-5"><div><p className="eyebrow">Section 1</p><h1 className="mt-2 text-3xl font-bold text-white">Section 1 introduction</h1></div><div className="countdown-box"><TimerReset className="h-5 w-5" /> 00:{String(countdown).padStart(2, "0")}</div></div>
              <Separator className="my-7" /><p className="max-w-3xl text-lg leading-8 text-[#c4b5fd]">It’s June 2026. SoPa is diversifying into a takeaway and home delivery service. Read the scenario carefully, review the permitted resources, and prepare to respond to the task in the answer pad.</p>
              <div className="mt-7 rounded-xl border border-[#00e5ff] bg-[#102b36] p-5"><div className="font-bold text-[#00ff88]">30-second cool-down</div><p className="mt-1 text-sm text-[#c4b5fd]">Use this time to settle into the exam environment. The task will become available when the countdown completes.</p></div>
              <div className="mt-7 flex justify-end"><Button className="aft-button" disabled={!canStartExamBeforeCooldown(countdown)} onClick={() => setScreen("question")}>{countdown > 0 ? `Start exam now · ${String(countdown).padStart(2, "0")}s auto-start` : "Start exam"}<ArrowRight className="ml-2 h-4 w-4" /></Button></div>
            </CardContent>
          </Card>
        )}
        {screen === "submission" && (
          <Card className="exam-card mx-auto max-w-3xl"><CardContent className="p-9 text-center"><ShieldCheck className="mx-auto h-10 w-10 text-[#00e5ff]" /><h1 className="mt-4 text-3xl font-bold text-white">Review and submit</h1><p className="mt-3 text-[#c4b5fd]">Your response is saved. Choose whether you want it sent for professional marking.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Button variant="outline" className="border-[#00e5ff] text-white" onClick={() => setScreen("question")}>Return to answer</Button><Button className="aft-button" disabled={!attemptId || submitAttempt.isPending} onClick={() => submitAttempt.mutate({ attemptId, optOutOfMarking: false }, { onSuccess: () => { toast.success("Submission locked and sent for marking"); setScreen("debrief"); }, onError: (error) => toast.error(error.message) })}>Submit for marking <ArrowRight className="ml-2 h-4 w-4" /></Button><Button variant="ghost" className="text-[#00e5ff]" disabled={!attemptId || submitAttempt.isPending} onClick={() => submitAttempt.mutate({ attemptId, optOutOfMarking: true }, { onSuccess: () => { toast.success("Submission locked"); setScreen("debrief"); }, onError: (error) => toast.error(error.message) })}>Submit without marking</Button></div></CardContent></Card>
        )}
        {isQuestion && (
          <Card className="exam-card mx-auto max-w-5xl question-workspace-card"><CardContent className="p-7 md:p-9">
            <div className="flex items-start justify-between gap-5"><div><p className="eyebrow">Section 1 · Question 1</p><h1 className="mt-3 text-3xl font-bold text-white">Assess the proposed delivery service</h1></div><Badge className="shrink-0 bg-[#102b36] text-[#00ff88]">{formatExamTime(sectionSeconds)} remaining</Badge></div>
            <p className="mt-5 max-w-4xl text-base leading-8 text-[#c4b5fd]">Prepare a response to the email from Jack Griggs, Head of Finance. Explain the key financial and operational considerations for the new service and support your recommendations with appropriate analysis.</p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2"><Button variant="outline" className="justify-start border-[#00e5ff] text-[#00ff88]" onClick={() => setResource("email")}><FileText className="mr-2 h-4 w-4" /> Email attachment</Button><Button variant="outline" className="justify-start border-[#00e5ff] text-[#00ff88]" onClick={() => setResource("reference")}><BookOpen className="mr-2 h-4 w-4" /> Reference material</Button></div>
            <div className="mt-7 border-t border-white/10 pt-6"><div className="mb-3 flex items-center justify-between gap-4"><div><p className="eyebrow">Answer</p><p className="mt-1 text-sm text-[#c4b5fd]">Type your response to Section 1 below.</p></div><span className="text-xs text-white/45">Autosave enabled</span></div><div className="editor-toolbar"><span>Paragraph</span><button type="button" onMouseDown={(event) => { event.preventDefault(); document.execCommand("bold"); }}><strong>B</strong></button><button type="button" onMouseDown={(event) => { event.preventDefault(); document.execCommand("italic"); }}><em>I</em></button><button type="button" onMouseDown={(event) => { event.preventDefault(); document.execCommand("underline"); }}><u>U</u></button><span>☷</span><span>☰</span><span>≡</span><span>↗</span></div><div contentEditable role="textbox" aria-label="Exam answer" suppressContentEditableWarning onInput={(event) => { setAnswer(event.currentTarget.textContent ?? ""); setSaved(false); }} className="min-h-[270px] rounded-t-none border border-t-0 border-white/10 bg-[#0c0524] p-4 text-base leading-7 text-white outline-none focus:ring-2 focus:ring-[#00e5ff]" data-placeholder="Type your response here..." /><div className="flex items-center justify-between border border-t-0 border-white/10 px-3 py-2 text-xs text-white/50"><span>Words: {answer.trim() ? answer.trim().split(/\s+/).length : 0}</span><span>{saved ? "Saved just now" : "Unsaved changes"}</span></div><div className="mt-5 flex justify-end gap-3"><Button variant="outline" className="border-[#00ff88] text-[#00ff88]" disabled={attemptLocked} onClick={() => { if (attemptLocked) { toast.error("This submitted attempt is locked and cannot be saved."); return; } if (!attemptId) { toast.error("Start an interactive attempt before saving."); return; } saveAnswer.mutate({ attemptId, sectionId: 1, body: answer, wordCount: answer.trim() ? answer.trim().split(/\s+/).length : 0 }, { onSuccess: () => { setSaved(true); toast.success("Answer saved"); }, onError: (error) => toast.error(error.message) }); }}><Save className="mr-2 h-4 w-4" /> Save</Button><Button className="aft-button" onClick={() => { transitioningToSubmission.current = true; setScreen("submission"); }}>Next <ArrowRight className="ml-2 h-4 w-4" /></Button></div></div>
          </CardContent></Card>
        )}
      </main>
      {resource && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#120730]/50 p-4" onClick={() => setResource(null)}><Card className="w-full max-w-xl" onClick={(event) => event.stopPropagation()}><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-white">{resource === "pre-seen" ? "Pre-seen material" : resource === "formulae" ? "Formulae + tables" : resource === "calculator" ? "Calculator" : resource === "email" ? "Email from Jack Griggs" : "Reference material"}</CardTitle><Button size="icon" variant="ghost" onClick={() => setResource(null)}><X className="h-4 w-4" /></Button></CardHeader><CardContent>{resource === "calculator" ? <ExamCalculator /> : <p className="leading-7 text-[#c4b5fd]">This resource panel stays open without losing your answer or leaving the timed exam. Access is checked on the server before a short-lived secure link is issued.</p>}{(() => { const kind = resource === "pre-seen" ? "pre_seen" : resource === "formulae" ? "formulae" : resource === "reference" ? "reference" : null; const match = kind ? examResourcesQuery.data?.find((item) => item.kind === kind) : undefined; return match ? <ProtectedResourceView resource={match} /> : <p className="mt-5 text-sm text-white/45">Calculator and email tools are available in this exam workspace.</p>; })()}<Button variant="outline" className="ml-3 mt-5 border-[#00e5ff] text-[#00e5ff]" onClick={() => setResource(null)}>Close resource</Button></CardContent></Card></div>}
    </div>
  );
}

function DashboardRedirect({ role }: { role: "admin" | "instructor" }) {
  const [, navigate] = useLocation();
  const target = role === "admin" ? "/admin" : "/instructor";
  useEffect(() => {
    navigate(target, { replace: true });
  }, [navigate, target]);
  return <div className="min-h-screen bg-[#0c0524]" />;
}

function Dashboard() {
  const [location] = useLocation();
  const initialSelection = getDashboardSelection(location);
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => getDashboardSelectionState(initialSelection).tab);
  const { user, loading, isAuthenticated, logout } = useAuth();
  const entitlementsQuery = trpc.student.entitlements.useQuery(undefined, { retry: false, enabled: isAuthenticated });
  const attemptsQuery = trpc.student.attempts.useQuery(undefined, { retry: false, enabled: isAuthenticated });
  const mockExamsQuery = trpc.catalogue.mockExams.useQuery(undefined, { retry: false, enabled: isAuthenticated });
  const notificationsQuery = trpc.student.notifications.useQuery(undefined, { retry: false, enabled: isAuthenticated });
  const feedbackQuery = trpc.student.feedback.useQuery(undefined, { retry: false, enabled: isAuthenticated });
  const markNotificationRead = trpc.student.markNotificationRead.useMutation({ onSuccess: () => notificationsQuery.refetch() });
  const selection = getDashboardSelection(location);
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("payment") === "success") {
      clearCartStorage();
    }
  }, []);
  useEffect(() => {
    const nextTab = getDashboardSelectionState(getDashboardSelection(location)).tab;
    setActiveTab((current) => current === nextTab ? current : nextTab);
  }, [location]);
  if (loading) return <div className="min-h-screen bg-[#0c0524]" />;
  if (!isAuthenticated) return <div className="min-h-screen bg-[#0c0524]"><PublicHeader onLogin={() => startLogin()} /><main className="container py-20"><Card className="mx-auto max-w-xl border-[#00e5ff]/30 bg-[#120730] text-center"><CardContent className="p-10"><LockKeyhole className="mx-auto h-10 w-10 text-[#00e5ff]" /><h1 className="mt-5 text-3xl font-bold text-white">Sign in to view your learning dashboard</h1><p className="mt-3 text-[#c4b5fd]">Your products, saved attempts, progress, and feedback are protected behind your learner account.</p><Button className="aft-button mt-7" onClick={() => startLogin()}>Log in to continue <ArrowRight className="ml-2 h-4 w-4" /></Button></CardContent></Card></main></div>;
  if (entitlementsQuery.isLoading || attemptsQuery.isLoading || mockExamsQuery.isLoading) return <div className="min-h-screen bg-[#0c0524]"><PublicHeader onLogin={() => toast.info("Loading your account")}/><main className="container py-20"><Card><CardContent className="p-10 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#00e5ff] border-t-transparent"/><p className="mt-4 text-[#c4b5fd]">Loading your learning record…</p></CardContent></Card></main></div>;
  if (entitlementsQuery.isError || attemptsQuery.isError) return <div className="min-h-screen bg-[#0c0524]"><PublicHeader onLogin={() => toast.info("Please sign in again")}/><main className="container py-20"><Card className="mx-auto max-w-xl border-[#ff8278]/40"><CardContent className="p-10 text-center"><h1 className="text-2xl font-bold text-white">We could not load your learning record</h1><p className="mt-3 text-[#c4b5fd]">Please refresh the page or sign in again. Your saved exam work is not changed by this display error.</p><Button className="aft-button mt-7" onClick={() => { void entitlementsQuery.refetch(); void attemptsQuery.refetch(); }}>Try again</Button></CardContent></Card></main></div>;
  const displayName = user?.name?.split(" ")[0] ?? "there";
  const entitlements = entitlementsQuery.data ?? [];
  const attempts = attemptsQuery.data ?? [];
  const lastAttempt = attempts[0];
  const nextActionProgress = lastAttempt ? getAttemptProgress(lastAttempt.attempt.status, lastAttempt.attempt.currentSection) : 0;
  const nextActionTitle = lastAttempt?.mockExam.title ?? "Start your first mock exam";
  const nextActionCopy = lastAttempt
    ? `Your last attempt of ${lastAttempt.mockExam.title} reached section ${lastAttempt.attempt.currentSection} (${nextActionProgress}% complete). Retaking starts the exam from the beginning and cannot be paused or resumed.`
    : "There are no exam records yet. Choose a mock exam to take your first timed attempt.";
  const dashboardView = getDashboardView(activeTab);
  const products = entitlements.map(({ product, entitlement }) => {
    const attempt = attempts.find(({ mockExam }) => mockExam.productId === product.id);
    const progress = attempt ? getAttemptProgress(attempt.attempt.status, attempt.attempt.currentSection) : 0;
    const daysLeft = subscriptionDaysRemaining(entitlement.expiresAt);
    const mockExam = mockExamsQuery.data?.find(({ mockExam }) => mockExam.productId === product.id)?.mockExam;
    return { product, entitlement, daysLeft, attempt, progress, href: getProductRoute(product.id, attempt?.attempt.id, attempt?.attempt.status, product.category, mockExam?.id) };
  });
  const selectedAttempt = selection.attemptId ? attempts.find(({ attempt }) => attempt.id === selection.attemptId) : undefined;
  const selectedProduct = selection.productId ? products.find(({ product }) => product.id === selection.productId) : undefined;
  const notifications = notificationsQuery.data ?? [];
  const feedback = feedbackQuery.data ?? [];
  return <div className="min-h-screen bg-[#0c0524]"><PublicHeader onLogin={() => toast.info("You are already in the preview account.")} /><main className="container py-12"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">My Account</p><h1 className="mt-2 text-4xl font-bold text-white">Good morning, {displayName}.</h1><p className="mt-2 text-[#c4b5fd]">Continue building confidence across your professional exams.</p></div><div className="flex items-center gap-3"><Button className="aft-button" onClick={() => toast.info("Profile settings coming next.")}><UserRound className="mr-2 h-4 w-4" /> Edit profile</Button><Button variant="outline" className="border-[#00e5ff] text-white" onClick={logout}><LogOut className="mr-2 h-4 w-4" /> Log out</Button></div></div>{selectedAttempt && <div className="mt-5 rounded-xl border border-[#00e5ff]/40 bg-[#102b36] px-4 py-3 text-sm text-[#c4b5fd]">Selected attempt <strong className="text-white">#{selectedAttempt.attempt.id}</strong> · {selectedAttempt.mockExam.title} · {humanizeStatus(selectedAttempt.attempt.status)}</div>}{selectedProduct && <div className="mt-5 rounded-xl border border-[#00ff88]/40 bg-[#102b36] px-4 py-3 text-sm text-[#c4b5fd]">Selected product <strong className="text-white">{selectedProduct.product.title}</strong> · {humanizeStatus(selectedProduct.product.category)}</div>}<div className="mt-9 grid gap-5 lg:grid-cols-[1.3fr_0.7fr]"><Card className="dashboard-hero"><CardContent className="p-7"><div className="flex items-start justify-between gap-5"><div><Badge className="bg-[#102b36] text-[#00ff88]">Active learner</Badge><h2 className="mt-4 text-2xl font-bold text-white">{nextActionTitle}</h2><p className="mt-2 max-w-xl text-[#c4b5fd]">{nextActionCopy}</p></div><div className="rounded-2xl bg-[#18093c]/80 p-4 text-right"><div className="text-3xl font-bold text-[#00ff88]">{nextActionProgress}%</div><div className="text-xs font-semibold uppercase tracking-wider text-white/50">progress</div></div></div><Progress value={nextActionProgress} className="mt-7 h-2 bg-[#18093c]" /><div className="mt-6 flex flex-wrap gap-3">{lastAttempt ? <Link href={getExamRetakeRoute(lastAttempt.mockExam.id, lastAttempt.mockExam.productId)}><Button className="aft-button">Retake exam <ArrowRight className="ml-2 h-4 w-4" /></Button></Link> : <Link href="/mock-exams"><Button className="aft-button">Browse mock exams <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>}</div></CardContent></Card><Card><CardHeader><CardTitle className="text-white">Subscription details</CardTitle></CardHeader><CardContent>{entitlements[0] ? <div className="rounded-xl bg-[#102b36] p-4"><div className="font-bold text-white">{entitlements[0].product.title}</div><div className="mt-1 text-sm text-[#c4b5fd]">{entitlements[0].entitlement.expiresAt ? `${subscriptionDaysRemaining(entitlements[0].entitlement.expiresAt) ?? 0} days left · active until ${new Date(entitlements[0].entitlement.expiresAt).toLocaleDateString()}` : "Active entitlement"}</div></div> : <div className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-[#c4b5fd]">No active entitlements are linked to this account yet.</div>}<div className="mt-5 grid grid-cols-2 gap-3 text-center"><div className="rounded-xl border border-white/10 p-3"><div className="text-2xl font-bold text-white">{entitlements.length}</div><div className="text-xs text-white/50">products</div></div><div className="rounded-xl border border-white/10 p-3"><div className="text-2xl font-bold text-white">{attempts.length}</div><div className="text-xs text-white/50">saved attempts</div></div></div></CardContent></Card></div><div className="mt-8 flex gap-2 overflow-auto border-b border-white/10">{(["Overview", "My products", "Saved attempts", "Results"] as DashboardTab[]).map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={`tab-button ${activeTab === tab ? "tab-active" : ""}`}>{tab}</button>)}</div><div className="mt-7">{dashboardView === "summary" ? <div className="grid gap-5 md:grid-cols-3"><Card><CardContent className="p-6"><div className="text-sm text-white/50">Owned products</div><div className="mt-2 text-3xl font-bold text-white">{entitlements.length}</div><p className="mt-2 text-xs text-[#00ff88]">Access linked to your account</p></CardContent></Card><Card><CardContent className="p-6"><div className="text-sm text-white/50">Saved attempts</div><div className="mt-2 text-3xl font-bold text-white">{attempts.length}</div><p className="mt-2 text-xs text-[#00e5ff]">Exam records retained securely</p></CardContent></Card><Card><CardContent className="p-6"><div className="text-sm text-white/50">Marked results</div><div className="mt-2 text-3xl font-bold text-white">{attempts.filter(({ attempt }) => attempt.status === "marked").length}</div><p className="mt-2 text-xs text-[#c4b5fd]">Feedback available when released</p></CardContent></Card><Card className="md:col-span-3"><CardHeader><CardTitle className="flex items-center gap-2 text-white"><Bell className="h-5 w-5 text-[#00e5ff]" /> Notifications</CardTitle></CardHeader><CardContent>{notifications.length ? <div className="space-y-3">{notifications.slice(0, 5).map((notification) => <button key={notification.id} type="button" onClick={() => { if (!notification.readAt) markNotificationRead.mutate({ notificationId: notification.id }); }} className={`w-full rounded-xl border p-4 text-left ${notification.readAt ? "border-white/10 bg-[#18093c]/40" : "border-[#00e5ff]/40 bg-[#102b36]"}`}><div className="flex items-start justify-between gap-4"><div><div className="font-bold text-white">{notification.subject}</div><div className="mt-1 text-sm text-[#c4b5fd]">{notification.body}</div></div><span className="text-xs text-white/45">{new Date(notification.createdAt).toLocaleDateString()}</span></div></button>)}</div> : <p className="text-sm text-[#c4b5fd]">Your purchase, submission, and marking updates will appear here.</p>}</CardContent></Card></div> : dashboardView === "products" ? <div className="grid gap-5 md:grid-cols-3">{products.length ? products.map(({ product, daysLeft, attempt, progress, href }) => <div key={product.id}><ProductProgress title={product.title} category={product.category.replace("_", " ")} progress={progress} detail={`${daysLeft === null ? "No expiry" : `${daysLeft} days left`} · ${attempt ? `${humanizeStatus(attempt.attempt.status)} · section ${attempt.attempt.currentSection}` : "Not started"}`} action={attempt ? "Retake" : "Open"} href={href} selected={selectedProduct?.product.id === product.id}><ProtectedResourceList productId={product.id} /></ProductProgress></div>) : <Card className="md:col-span-3"><CardContent className="p-8 text-center"><BookOpen className="mx-auto h-8 w-8 text-[#00e5ff]" /><h3 className="mt-4 font-bold text-white">Your products will appear here</h3><p className="mt-2 text-sm text-[#c4b5fd]">Once an entitlement is active, its learning progress and saved attempts will be shown in this space.</p></CardContent></Card>}</div> : dashboardView === "results" ? <div className="grid gap-5 md:grid-cols-3">{feedback.length ? feedback.map(({ feedback: record, attempt, mockExam }) => <Card key={record.id} className="hover-lift"><CardContent className="p-6"><Badge className="bg-[#102b36] text-[#00ff88]">Feedback available</Badge><h3 className="mt-4 font-bold text-white">{mockExam.title}</h3><p className="mt-2 text-sm text-[#c4b5fd]">Attempt #{attempt.id} · {record.releasedAt ? new Date(record.releasedAt).toLocaleDateString() : "Recently released"}</p><p className="mt-4 leading-7 text-[#c4b5fd]">{record.summary}</p><div className="mt-5 font-bold text-[#00ff88]">{attempt.status === "marked" ? "Marked result" : "Review record"}</div></CardContent></Card>) : <Card className="md:col-span-3"><CardContent className="p-8 text-center"><Check className="mx-auto h-8 w-8 text-[#00e5ff]" /><h3 className="mt-4 font-bold text-white">No released feedback yet</h3><p className="mt-2 text-sm text-[#c4b5fd]">Your marker feedback will appear here when it has been released.</p></CardContent></Card>}</div> : <div className="grid gap-5 md:grid-cols-3">{(dashboardView === "attempts" ? attempts : attempts.filter(({ attempt }) => ["submitted", "awaiting_marking", "marked"].includes(attempt.status))).length ? (dashboardView === "attempts" ? attempts : attempts.filter(({ attempt }) => ["submitted", "awaiting_marking", "marked"].includes(attempt.status))).map(({ attempt, mockExam }) => <Card key={attempt.id} className={`hover-lift ${selectedAttempt?.attempt.id === attempt.id ? "border-[#00e5ff] ring-2 ring-[#00e5ff]/40" : ""}`}><CardContent className="p-6"><Badge variant="outline" className="border-[#00ff88] text-[#00ff88]">{humanizeStatus(attempt.status)}</Badge><h3 className="mt-4 font-bold text-white">{mockExam.title}</h3><p className="mt-2 text-sm text-[#c4b5fd]">Section {attempt.currentSection} · updated {new Date(attempt.updatedAt).toLocaleDateString()}</p><Link href={attempt.status === "in_progress" ? getExamRetakeRoute(mockExam.id, mockExam.productId) : getAttemptRoute(attempt.id, attempt.status)} className="mt-5 inline-flex items-center text-sm font-bold text-[#00ff88]">{attempt.status === "in_progress" ? "Retake" : "Open record"}<ArrowRight className="ml-2 h-4 w-4" /></Link></CardContent></Card>) : <Card className="md:col-span-3"><CardContent className="p-8 text-center"><FileText className="mx-auto h-8 w-8 text-[#00e5ff]" /><h3 className="mt-4 font-bold text-white">No {activeTab.toLowerCase()} yet</h3><p className="mt-2 text-sm text-[#c4b5fd]">Your saved exam records will appear here as you use the portal.</p></CardContent></Card>}</div>}</div></main></div>;
}

function ProductProgress({ title, category, progress, detail, action, href, selected, children }: { title: string; category: string; progress: number; detail: string; action: string; href: string; selected?: boolean; children?: React.ReactNode }) { return <Card className={`hover-lift ${selected ? "border-[#00ff88] ring-2 ring-[#00ff88]/40" : ""}`}><CardContent className="p-6"><div className="flex items-start justify-between gap-3"><div><Badge variant="outline" className="border-[#00ff88] text-[#00ff88]">{category}</Badge><h3 className="mt-4 font-bold text-white">{title}</h3></div><FileText className="h-5 w-5 text-[#00ff88]" /></div><div className="mt-6 flex items-center justify-between text-xs text-white/50"><span>{progress}% complete</span><span className="capitalize">{detail}</span></div><Progress value={progress} className="mt-2 h-2" /><Link href={href} className="mt-5 inline-flex items-center text-sm font-bold text-[#00ff88] hover:text-white">{action} <ArrowRight className="ml-2 h-4 w-4" /></Link>{children}</CardContent></Card>; }

function RubricForm({ pending, onSubmit }: { pending: boolean; onSubmit: (feedback: string, rubricSnapshot: string, awardedPoints: number, totalPoints: number) => void }) {
  const [feedback, setFeedback] = useState("");
  const [scores, setScores] = useState<number[]>(() => RUBRIC_CRITERIA.map(() => 0));
  return <form className="mt-3 space-y-3" onSubmit={(event) => { event.preventDefault(); if (!feedback.trim()) return; const result = calculateRubricScore(scores); const rubricSnapshot = JSON.stringify(RUBRIC_CRITERIA.map((criterion, index) => ({ criterion, awardedPoints: scores[index], maxPoints: 5 }))); onSubmit(feedback.trim(), rubricSnapshot, result.awardedPoints, result.totalPoints); }}><div className="grid gap-2 sm:grid-cols-2">{RUBRIC_CRITERIA.map((criterion, index) => <label key={criterion} className="text-xs font-semibold text-[#c4b5fd]">{criterion}<Input type="number" min="0" max="5" value={scores[index]} onChange={(event) => setScores((current) => current.map((score, scoreIndex) => scoreIndex === index ? Number(event.target.value) : score))} className="mt-1 bg-[#0c0524] text-white" /></label>)}</div><div className="flex gap-2"><Textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Marker feedback and rubric summary" className="min-h-10 flex-1 bg-[#0c0524] text-white" required /><Button type="submit" className="aft-button self-end" disabled={pending || !feedback.trim()}>Release</Button></div></form>;
}

function ProtectedResourceList({ productId }: { productId: number }) {
  const resourcesQuery = trpc.resources.list.useQuery({ productId }, { retry: false });
  const utils = trpc.useUtils();
  const downloadResource = async (resourceId: number) => {
    try {
      const result = await utils.resources.download.fetch({ resourceId });
      if (result.url) window.location.assign(result.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Resource unavailable");
    }
  };
  if (resourcesQuery.isLoading) return <div className="mt-5 h-10 animate-pulse rounded-xl bg-[#18093c]" />;
  if (resourcesQuery.isError) return <p className="mt-5 text-xs text-[#ff8278]">Resources are not available for this entitlement.</p>;
  if (!resourcesQuery.data?.length) return <p className="mt-5 text-xs text-white/45">No protected resources published yet.</p>;
  return <div className="mt-5 space-y-2 border-t border-white/10 pt-4"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#00ff88]">Protected downloads</p>{resourcesQuery.data.map((resource) => <div key={resource.id} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-[#18093c]/60 p-3"><span className="text-xs leading-5 text-[#c4b5fd]">{resource.title}</span>{resource.hasFile ? <Button size="sm" variant="outline" className="w-full border-[#00e5ff] text-[#00e5ff]" onClick={() => void downloadResource(resource.id)}>Download</Button> : <span className="text-[11px] text-white/40">Preparing</span>}</div>)}</div>;
}

function ModeSelection({ setScreen }: { setScreen: (next: string) => void }) { const startAttempt = trpc.exams.startAttempt.useMutation(); const mockExamsQuery = trpc.catalogue.mockExams.useQuery(undefined, { retry: false }); const mockExamId = typeof window === "undefined" ? 1 : Number(new URLSearchParams(window.location.search).get("mockExamId") || 1); const queryProductId = typeof window === "undefined" ? 0 : Number(new URLSearchParams(window.location.search).get("productId") || 0); const selectedMockExam = mockExamsQuery.data?.find((item) => item.mockExam.id === mockExamId)?.mockExam; const examTitle = selectedMockExam?.title ?? "Selected mock exam"; const durationMinutes = Math.round((selectedMockExam?.totalDurationSeconds ?? 10800) / 60); const productId = queryProductId || selectedMockExam?.productId || 0; const sectionsQuery = trpc.catalogue.caseStudySections.useQuery({ mockExamId }, { retry: false, enabled: Boolean(selectedMockExam) }); const resourcesQuery = trpc.resources.list.useQuery({ productId }, { retry: false, enabled: Boolean(productId) }); const resourceUtils = trpc.useUtils(); const printableResource = resourcesQuery.data?.find((item) => item.kind === "printable_pdf" && item.hasFile); const printableMutation = trpc.exams.printable.useMutation(); const [mode, setMode] = useState("interactive"); const modes = [{ id: "interactive", title: "Interactive", text: "Complete the mock exam in one sitting. Ending or leaving submits it automatically with the answers saved so far.", icon: MonitorPlay }, { id: "printable", title: "Printable", text: "Download the protected question paper PDF.", icon: FileText }, { id: "solutions", title: "Online mock with solutions", text: "Unlock AFT-created illustrative solutions after you complete the mock.", icon: Check }, { id: "feedback", title: "Marking feedback instructions", text: "Open the protected answers and marking guide.", icon: PenLine }]; return <div className="min-h-screen bg-[#0c0524]"><PublicHeader onLogin={() => startLogin("login")} /><ExamUtilityRail /><main className="container py-12"><div className="mx-auto max-w-4xl"><p className="eyebrow">Home / CIMA / Case study / {examTitle}</p><h1 className="mt-3 text-4xl font-bold text-white">Select your exam mode</h1><p className="mt-3 text-[#c4b5fd]">Choose how you would like to access {examTitle}. The interactive attempt is timed for {durationMinutes} minutes.</p><div className="mt-6 rounded-2xl border border-white/10 bg-[#120730] p-5"><div className="text-xs font-bold uppercase tracking-[.16em] text-[#00ff88]">Imported exam structure · {sectionsQuery.data?.length ?? 0} published sections</div>{sectionsQuery.isLoading ? <div className="mt-3 h-16 animate-pulse rounded-xl bg-[#18093c]" /> : sectionsQuery.isError ? <p className="mt-3 text-xs text-[#ff8278]">Section metadata is temporarily unavailable. The protected question paper remains the source of truth.</p> : sectionsQuery.data?.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{sectionsQuery.data.map((section) => <div key={section.id} className="rounded-xl border border-white/10 bg-[#18093c]/60 p-3"><div className="text-sm font-bold text-white">Section {section.sectionNumber} · {section.title}</div><div className="mt-1 text-xs text-[#c4b5fd]">{Math.round(section.durationSeconds / 60)} minutes · {section.introduction ?? "See protected question paper"}</div></div>)}</div> : <p className="mt-3 text-xs text-white/45">No published section metadata is available yet.</p>}</div><div className="mt-8 grid gap-4 md:grid-cols-2">{modes.map(({ id, title, text, icon: Icon }) => <button key={id} onClick={() => setMode(id)} className={`mode-card text-left ${mode === id ? "mode-card-selected" : ""}`}><div className="flex items-center justify-between gap-4"><div className={`mode-icon ${mode === id ? "mode-icon-selected" : ""}`}><Icon className="h-6 w-6" /></div><ChevronRight className="h-5 w-5 text-[#00ff88]" /></div><h2 className="mt-5 font-bold text-white">{title}</h2><p className="mt-1 text-sm leading-6 text-[#c4b5fd]">{text}</p></button>)}</div>{mode === "printable" && <div className={`mt-6 rounded-xl border p-4 text-sm ${printableResource ? "border-[#00ff88]/40 bg-[#102b36] text-[#c4b5fd]" : "border-[#00e5ff]/30 bg-[#18093c] text-[#c4b5fd]"}`}><div className="font-bold text-white">{resourcesQuery.isLoading ? "Checking printable resource…" : printableResource ? "Printable exam ready" : "Printable exam not published yet"}</div><p className="mt-1">{printableResource ? "The question paper PDF will open here." : "The question paper PDF is generated automatically and opened when you continue."}</p></div>}<div className="mt-8 flex gap-3"><Button variant="outline" className="border-[#00e5ff] text-white" onClick={() => setScreen("debrief")}>Back</Button><Button className="aft-button" onClick={async () => { if (mode === "solutions") { setScreen("solutions"); return; } if (mode !== "interactive") { const kind = mode === "printable" ? "printable_pdf" : mode === "feedback" ? "feedback" : "reference"; const resource = resourcesQuery.data?.find((item) => item.kind === kind && item.hasFile); if (resource) { try { const result = await resourceUtils.resources.download.fetch({ resourceId: resource.id }); if (result.url) window.location.assign(result.url); } catch (error) { toast.error(error instanceof Error ? error.message : "Resource unavailable"); } } else if (mode === "printable") { try { const result = await printableMutation.mutateAsync({ mockExamId }); if (result.url) window.location.assign(result.url); else toast.error("Printable PDF could not be generated"); } catch (error) { toast.error(error instanceof Error ? error.message : "Printable PDF could not be generated"); } } else { toast.info("This mode is available once the corresponding protected file has been published."); } return; } startAttempt.mutate({ mockExamId, mode: "interactive" }, { onSuccess: (attempt) => { if (attempt?.id && typeof window !== "undefined") { window.sessionStorage.setItem("aft-attempt-id", String(attempt.id)); const nextParams = new URLSearchParams(window.location.search); nextParams.set("attempt", String(attempt.id)); window.history.replaceState({}, "", `${window.location.pathname}?${nextParams.toString()}`); } setScreen("instructions"); }, onError: (error) => toast.error(error.message || "Sign in to start an interactive attempt") }); }}>Continue <ArrowRight className="ml-2 h-4 w-4" /></Button></div></div></main></div>; }

function Debrief({ setScreen }: { setScreen: (next: string) => void }) { const mockExamsQuery = trpc.catalogue.mockExams.useQuery(undefined, { retry: false }); const mockExamId = typeof window === "undefined" ? 1 : Number(new URLSearchParams(window.location.search).get("mockExamId") || 1); const selected = mockExamsQuery.data?.find((item) => item.mockExam.id === mockExamId); const examTitle = selected?.mockExam.title ?? "Selected mock exam"; const durationMinutes = Math.round((selected?.mockExam.totalDurationSeconds ?? 10800) / 60); const sectionsQuery = trpc.catalogue.caseStudySections.useQuery({ mockExamId }, { retry: false, enabled: Boolean(selected) }); const intro = selected?.mockExam.intro ?? "This mock exam mirrors the CIMA Management Case Study format with timed tasks, protected reference material, and post-submission solutions."; return <div className="min-h-screen bg-[#0c0524]"><PublicHeader onLogin={() => startLogin("login")} /><ExamUtilityRail /><main className="container py-12"><div className="mx-auto max-w-5xl"><p className="eyebrow">Home / CIMA / Case study / {examTitle}</p><div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]"><div><h1 className="text-4xl font-bold text-white">{examTitle}</h1><p className="mt-4 text-lg leading-8 text-[#c4b5fd]">{intro}</p><div className="mt-6 rounded-2xl border border-white/10 bg-[#120730] p-5"><div className="text-xs font-bold uppercase tracking-[.16em] text-[#00ff88]">Section plan · {sectionsQuery.data?.length ?? 0} published sections</div>{sectionsQuery.isLoading ? <div className="mt-3 h-16 animate-pulse rounded-xl bg-[#18093c]" /> : sectionsQuery.isError ? <p className="mt-3 text-xs text-[#ff8278]">Section metadata is temporarily unavailable. The protected question paper remains the source of truth.</p> : sectionsQuery.data?.length ? <div className="mt-3 space-y-2">{sectionsQuery.data.map((section) => <div key={section.id} className="flex items-start justify-between gap-4 border-b border-white/10 pb-2 last:border-0 last:pb-0"><div><div className="text-sm font-bold text-white">Section {section.sectionNumber} · {section.title}</div><div className="mt-1 text-xs text-[#c4b5fd]">{section.introduction ?? "See protected question paper"}</div></div><span className="shrink-0 text-xs font-bold text-[#00e5ff]">{Math.round(section.durationSeconds / 60)} min</span></div>)}</div> : <p className="mt-3 text-xs text-white/45">No published section metadata is available yet.</p>}</div><Button className="aft-button mt-8" onClick={() => setScreen("mode")}>Continue to exam modes <ArrowRight className="ml-2 h-4 w-4" /></Button></div><Card className="border-0 bg-[#102b36] shadow-none"><CardContent className="space-y-5 p-7">{[["What is included", "Four timed case-study tasks with one answer screen per task."], ["Timing", `${durationMinutes} minutes total, based on the imported exam configuration.`], ["Resources", "Protected question paper, formulae/tables, and post-submission solutions where supplied."], ["What to expect", "Realistic scenarios, time pressure, and integrated professional judgement."]].map(([label, value]) => <div key={label} className="flex gap-4 border-b border-[#00ff88] pb-5 last:border-0 last:pb-0"><Check className="mt-1 h-5 w-5 text-[#00ff88]" /><div><div className="font-bold text-white">{label}</div><div className="mt-1 text-sm text-[#c4b5fd]">{value}</div></div></div>)}</CardContent></Card></div></div></main></div>; }

function MockExams({ setScreen }: { setScreen: (next: string) => void }) { const [, navigate] = useLocation(); const examsQuery = trpc.catalogue.mockExams.useQuery(undefined, { retry: false }); const exams = examsQuery.data ?? []; return <div className="min-h-screen bg-[#0c0524]"><PublicHeader onLogin={() => startLogin("login")} /><main className="container py-12"><div className="mx-auto max-w-5xl"><p className="eyebrow">CIMA / Case study</p><div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center"><div><h1 className="text-4xl font-bold text-white">Choose your mock exam</h1><p className="mt-4 text-lg leading-8 text-[#c4b5fd]">Attempting mock exams is one of the best ways to prepare for the CIMA Objective Case Study. Build confidence, apply knowledge under timed conditions, and identify the areas to focus on.</p><p className="mt-4 text-sm font-semibold text-[#00ff88]">Choose a format, start when you are ready, and keep your preparation moving.</p></div><div className="space-y-3">{examsQuery.isLoading ? <div className="h-48 animate-pulse rounded-2xl bg-[#120730]" /> : exams.length ? exams.map(({ mockExam, product }, index) => <button key={mockExam.id} onClick={() => { const query = `?mockExamId=${mockExam.id}&productId=${product.id}`; navigate(`/case-study/debrief${query}`); setScreen("debrief"); }} className={`exam-choice ${index === 0 ? "exam-choice-featured" : ""}`}><span>{mockExam.title}</span><ArrowRight className="h-5 w-5" /></button>) : <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-[#c4b5fd]">No published mock exams are available yet.</div>}</div></div></div></main></div>; }

function ObjectiveTests() { const [timed, setTimed] = useState(true); const [topic, setTopic] = useState("All topics"); const [question, setQuestion] = useState(1); const [flagged, setFlagged] = useState(false); const topics = ["All topics", "Activity based costing", "Budgetary control", "Financial reporting", "Risk management"]; return <div className="min-h-screen bg-[#0c0524]"><PublicHeader onLogin={() => startLogin("login")} /><main className="container py-12"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Objective test bank</p><h1 className="mt-2 text-4xl font-bold text-white">Practise with purpose.</h1><p className="mt-3 text-[#c4b5fd]">Build a configurable test from the topics you want to strengthen.</p></div><Badge className="bg-[#102b36] text-[#00ff88]">60 questions available</Badge></div><div className="mt-8 grid gap-5 lg:grid-cols-[.78fr_1.22fr]"><Card><CardHeader><CardTitle className="text-white">Test Yourself Extra</CardTitle><p className="text-sm text-white/50">Set your practice conditions before you begin.</p></CardHeader><CardContent className="space-y-5"><div><label className="text-sm font-bold text-white">Topic</label><select value={topic} onChange={(e) => setTopic(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#18093c] px-3 text-sm"><option>{topics[0]}</option>{topics.slice(1).map((item) => <option key={item}>{item}</option>)}</select></div><div><label className="text-sm font-bold text-white">Number of questions</label><div className="mt-2 grid grid-cols-3 gap-2">{[10, 25, 60].map((number) => <button key={number} className={`rounded-lg border p-3 text-sm font-bold ${number === 25 ? "border-[#00ff88] bg-[#102b36] text-[#00ff88]" : "border-white/10 text-white"}`}>{number}</button>)}</div></div><div className="flex items-center justify-between rounded-xl bg-[#102b36] p-4"><div><div className="font-bold text-white">Timed mode</div><div className="text-xs text-white/50">Show a visible countdown</div></div><button onClick={() => setTimed(!timed)} className={`h-6 w-11 rounded-full p-1 ${timed ? "bg-[#00ff88]" : "bg-[#24105c]"}`}><span className={`block h-4 w-4 rounded-full bg-[#18093c] transition ${timed ? "translate-x-5" : ""}`} /></button></div><Button className="aft-button w-full" onClick={() => toast.success("Practice set configured")}>Start practice <ArrowRight className="ml-2 h-4 w-4" /></Button></CardContent></Card><Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle className="text-white">Question {question} of 25</CardTitle><p className="mt-1 text-sm text-white/50">{topic} · {timed ? "28:44 remaining" : "Untimed"}</p></div><button onClick={() => setFlagged(!flagged)} className={`rounded-lg border px-3 py-2 text-sm font-bold ${flagged ? "border-[#00e5ff] bg-[#2f274e] text-[#00e5ff]" : "border-white/10 text-[#c4b5fd]"}`}><Flag className="mr-2 inline h-4 w-4" />{flagged ? "Flagged" : "Flag question"}</button></CardHeader><CardContent><div className="rounded-xl border border-white/10 p-5"><p className="text-lg font-bold leading-8 text-white">Which statement best explains why a flexible budget is useful when evaluating performance?</p><div className="mt-5 space-y-3">{["It removes all fixed costs from the budget.", "It adjusts expected costs and revenues to the actual level of activity.", "It guarantees that the original budget cannot be exceeded.", "It replaces the need for variance analysis."].map((option, index) => <button key={option} onClick={() => toast.success(`Option ${String.fromCharCode(65 + index)} selected`)} className="flex w-full items-center gap-3 rounded-lg border border-white/10 p-4 text-left text-sm text-[#c4b5fd] hover:border-[#00e5ff] hover:bg-[#18093c]"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#24105c] font-bold text-white">{String.fromCharCode(65 + index)}</span>{option}</button>)}</div></div><div className="mt-5 flex items-center justify-between gap-4"><div className="flex gap-1">{Array.from({ length: 8 }, (_, index) => <button key={index} onClick={() => setQuestion(index + 1)} className={`h-8 w-8 rounded-md text-xs font-bold ${question === index + 1 ? "bg-[#120730] text-white" : index === 2 ? "bg-[#2f274e] text-[#00e5ff]" : "bg-[#24105c] text-white"}`}>{index + 1}</button>)}</div><Button className="aft-button" onClick={() => setQuestion(Math.min(25, question + 1))}>Next <ChevronRight className="ml-2 h-4 w-4" /></Button></div></CardContent></Card></div></main></div>; }

function Admin() {
  const { user, loading, isAuthenticated } = useAuth();
  const [active, setActive] = useState("Overview");
  const overviewQuery = trpc.admin.overview.useQuery(undefined, { retry: false, enabled: isAuthenticated && user?.role === "admin" });
  const productsQuery = trpc.admin.products.useQuery(undefined, { retry: false, enabled: isAuthenticated && user?.role === "admin" });
  const contentQuery = trpc.admin.contentOverview.useQuery(undefined, { retry: false, enabled: isAuthenticated && user?.role === "admin" });
  const contentKind = active === "Case-study exams" ? "mock_exams" : active === "Resources" ? "resources" : active === "Question bank" ? "objective_questions" : "sections";
  const contentItemsQuery = trpc.admin.contentItems.useQuery({ kind: contentKind }, { retry: false, enabled: isAuthenticated && user?.role === "admin" && active !== "Overview" && active !== "Products" && active !== "Marker queue" && active !== "Users" });
  const contentStatusMutation = trpc.admin.updateContentStatus.useMutation({ onSuccess: () => { toast.success("Content status updated"); contentItemsQuery.refetch(); contentQuery.refetch(); }, onError: (error) => toast.error(error.message) });
  const sectionTitleMutation = trpc.admin.updateSectionTitle.useMutation({ onSuccess: () => { toast.success("Section title updated"); contentItemsQuery.refetch(); }, onError: (error) => toast.error(error.message) });
  const queueQuery = trpc.marking.queue.useQuery(undefined, { retry: false, enabled: isAuthenticated && user?.role === "admin" });
  const updateProductStatus = trpc.admin.updateProductStatus.useMutation({ onSuccess: () => { toast.success("Product status updated"); productsQuery.refetch(); overviewQuery.refetch(); }, onError: (error) => toast.error(error.message) });
  const generatePrintablePdfMutation = trpc.admin.generatePrintablePdf.useMutation({ onSuccess: () => { toast.success("Printable exam PDF generated"); contentItemsQuery.refetch(); }, onError: (error) => toast.error(error.message) });
  const utils = trpc.useUtils();
  const assignMutation = trpc.marking.assign.useMutation({ onSuccess: () => { toast.success("Marking assigned to you"); utils.marking.queue.invalidate(); }, onError: (error) => toast.error(error.message) });
  const releaseMutation = trpc.marking.release.useMutation({ onSuccess: () => { toast.success("Feedback released"); utils.marking.queue.invalidate(); utils.admin.overview.invalidate(); }, onError: (error) => toast.error(error.message) });
  const payfastSettingsQuery = trpc.admin.payfastSettings.useQuery(undefined, { retry: false, enabled: isAuthenticated && user?.role === "admin" && active === "Overview" });
  const setPayfastModeMutation = trpc.admin.setPayfastMode.useMutation({ onSuccess: () => { toast.success("PayFast gateway mode updated"); payfastSettingsQuery.refetch(); }, onError: (error) => toast.error(error.message) });
  if (loading) return <div className="min-h-screen bg-[#0c0524]" />;
  if (!isAuthenticated || user?.role !== "admin") return <div className="min-h-screen bg-[#0c0524]"><PublicHeader onLogin={() => startLogin()} /><main className="container py-20"><Card className="mx-auto max-w-xl border-[#00e5ff]/30 bg-[#120730] text-center"><CardContent className="p-10"><LockKeyhole className="mx-auto h-10 w-10 text-[#00e5ff]" /><h1 className="mt-5 text-3xl font-bold text-white">Administrator access required</h1><p className="mt-3 text-[#c4b5fd]">This area is restricted to authorized Accountants for Tomorrow content administrators.</p><Button className="aft-button mt-7" onClick={() => startLogin()}>Sign in securely <ArrowRight className="ml-2 h-4 w-4" /></Button></CardContent></Card></main></div>;
  const nav = ["Overview", "Products", "Case-study exams", "Sections", "Question bank", "Resources", "Marker queue", "Users"];
  const overview = overviewQuery.data;
  const queue = queueQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const content = contentQuery.data;
  const contentItems = contentItemsQuery.data ?? [];
  const activity = overview?.recentActivity ?? [];
  const renderActivity = activity.length ? activity.map((event) => ({ event: `${event.entityType} ${event.action}`, owner: event.userId ? `User #${event.userId}` : "System", status: "Recorded", when: new Date(event.createdAt).toLocaleString() })) : [];
  return <div className="min-h-screen bg-[#0c0524]"><div className="flex min-h-screen"><aside className="hidden w-64 shrink-0 bg-[#120730] p-6 text-white md:block"><BrandMark inverse /><div className="mt-12 text-xs font-bold uppercase tracking-[.16em] text-white/45">Administration</div><nav className="mt-5 space-y-1">{nav.map((item) => <button key={item} onClick={() => setActive(item)} className={`w-full rounded-lg px-3 py-3 text-left text-sm font-semibold ${active === item ? "bg-[#18093c]/12 text-[#00ff88]" : "text-white/75 hover:bg-[#18093c]/8 hover:text-white"}`}>{item}</button>)}</nav><div className="mt-12 rounded-xl border border-white/15 bg-[#18093c]/5 p-4 text-sm text-white/70"><ShieldCheck className="h-5 w-5 text-[#00ff88]" /><p className="mt-3 leading-6">Content changes are audited and publishing is permission-controlled.</p></div></aside><main className="container py-10"><div className="flex items-center justify-between"><div><p className="eyebrow">Admin console</p><h1 className="mt-2 text-4xl font-bold text-white">{active}</h1></div><Badge className="bg-[#102b36] text-[#00ff88]">Super admin</Badge></div><div className="mt-8 grid gap-5 md:grid-cols-3"><Card><CardContent className="p-6"><div className="text-sm text-white/50">Active learners</div><div className="mt-2 text-3xl font-bold text-white">{overview?.activeLearners ?? 0}</div><div className="mt-2 text-xs font-bold text-[#00ff88]">Live account count</div></CardContent></Card><Card><CardContent className="p-6"><div className="text-sm text-white/50">Awaiting marking</div><div className="mt-2 text-3xl font-bold text-white">{overview?.awaitingMarking ?? 0}</div><div className="mt-2 text-xs font-bold text-[#00e5ff]">Queue status</div></CardContent></Card><Card><CardContent className="p-6"><div className="text-sm text-white/50">Published products</div><div className="mt-2 text-3xl font-bold text-white">{overview?.publishedProducts ?? 0}</div><div className="mt-2 text-xs font-bold text-[#00ff88]">Catalogue status</div></CardContent></Card></div><AdminManagementTools />{active === "Overview" && <Card className="mb-5 border-[#00e5ff]/30 bg-[#120730]"><CardHeader><CardTitle className="text-white">PayFast gateway</CardTitle><p className="text-sm text-white/50">Admin-only payment mode. Credentials remain server-side and blank credentials keep checkout disabled.</p></CardHeader><CardContent>{payfastSettingsQuery.data ? <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#18093c]/70 p-4"><div><div className="font-bold capitalize text-white">{payfastSettingsQuery.data.mode} mode</div><div className="mt-1 text-sm text-[#c4b5fd]">{payfastSettingsQuery.data.configured ? "Credentials configured" : "Credentials not configured · checkout disabled"}</div></div><div className="flex gap-2"><Button size="sm" variant="outline" className="border-[#00e5ff] text-[#00e5ff]" disabled={setPayfastModeMutation.isPending} onClick={() => setPayfastModeMutation.mutate({ mode: "sandbox" })}>Sandbox</Button><Button size="sm" variant="outline" className="border-[#00ff88] text-[#00ff88]" disabled={setPayfastModeMutation.isPending || !payfastSettingsQuery.data.configured} onClick={() => { if (window.confirm("Switch PayFast to live payments?")) setPayfastModeMutation.mutate({ mode: "live" }); }}>Live</Button></div></div> : <p className="text-sm text-[#c4b5fd]">Loading gateway settings…</p>}</CardContent></Card>}<div className="mt-5 grid gap-3 grid-cols-2 md:grid-cols-5">{[["Products", content?.products ?? 0], ["Mock exams", content?.mockExams ?? 0], ["Sections", content?.sections ?? 0], ["Resources", content?.resources ?? 0], ["Questions", content?.objectiveQuestions ?? 0]].map(([label, value]) => <div key={label} className="rounded-xl border border-white/10 bg-[#120730] p-4"><div className="text-xs uppercase tracking-wider text-white/45">{label}</div><div className="mt-2 text-2xl font-bold text-white">{value}</div></div>)}</div>{["Case-study exams", "Sections", "Question bank", "Resources"].includes(active) && <Card className="mt-7"><CardHeader><CardTitle className="text-white">{active} content</CardTitle><p className="mt-1 text-sm text-white/50">Role-gated content records and publishing state.</p></CardHeader><CardContent>{contentItems.length ? <div className="space-y-3">{contentItems.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#18093c]/60 p-4"><div><div className="font-bold text-white">{item.title}</div><div className="mt-1 text-sm text-[#c4b5fd]">{item.detail} · {item.status}</div></div>{active === "Sections" ? <Button size="sm" variant="outline" className="border-[#00e5ff] text-[#00e5ff]" disabled={sectionTitleMutation.isPending} onClick={() => { const title = window.prompt("Update section title", item.title); if (title?.trim()) sectionTitleMutation.mutate({ sectionId: item.id, title: title.trim() }); }}>Rename</Button> : active === "Case-study exams" ? <div className="flex flex-wrap gap-2"><Button size="sm" className="aft-button" disabled={generatePrintablePdfMutation.isPending} onClick={() => generatePrintablePdfMutation.mutate({ mockExamId: item.id })}>Generate PDF</Button><Button size="sm" variant="outline" className="border-[#00e5ff] text-[#00e5ff]" disabled={contentStatusMutation.isPending} onClick={() => contentStatusMutation.mutate({ kind: "mock_exams", id: item.id, status: item.status === "published" ? "draft" : "published" })}>{item.status === "published" ? "Unpublish" : "Publish"}</Button></div> : active !== "Resources" || item.status !== "published" ? <Button size="sm" variant="outline" className="border-[#00e5ff] text-[#00e5ff]" disabled={contentStatusMutation.isPending} onClick={() => contentStatusMutation.mutate({ kind: contentKind as "mock_exams" | "resources" | "objective_questions", id: item.id, status: item.status === "published" ? "draft" : "published" })}>{item.status === "published" ? "Unpublish" : "Publish"}</Button> : <Badge className="bg-[#102b36] text-[#00ff88]">Published</Badge>}</div>)}</div> : <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-[#c4b5fd]">No {active.toLowerCase()} records found.</div>}</CardContent></Card>}{active === "Marker queue" ? <Card className="mt-7"><CardHeader><CardTitle className="text-white">Marking queue</CardTitle><p className="mt-1 text-sm text-white/50">Assign, review, and release feedback for locked submissions.</p></CardHeader><CardContent>{queue.length ? <div className="space-y-3">{queue.map(({ marking, submission, attempt }) => <div key={marking.id} className="rounded-xl border border-white/10 bg-[#18093c]/60 p-4"><div className="flex flex-wrap items-center justify-between gap-4"><div><div className="font-bold text-white">Attempt #{attempt.id}</div><div className="mt-1 text-sm capitalize text-[#c4b5fd]">{marking.status.replace("_", " ")} · submission {submission.status}</div></div><div className="flex flex-wrap gap-2">{marking.status === "unassigned" && <Button className="aft-button" disabled={assignMutation.isPending} onClick={() => assignMutation.mutate({ markingId: marking.id, markerId: user.id })}>Assign to me</Button>}{marking.status !== "unassigned" && <RubricForm pending={releaseMutation.isPending} onSubmit={(feedback, rubricSnapshot, awardedPoints, totalPoints) => releaseMutation.mutate({ markingId: marking.id, feedback, rubricSnapshot, awardedPoints, totalPoints })} />}</div></div></div>)}</div> : <div className="rounded-xl border border-dashed border-white/15 p-8 text-center"><PenLine className="mx-auto h-8 w-8 text-[#00e5ff]" /><h3 className="mt-4 font-bold text-white">No submissions are awaiting marking</h3><p className="mt-2 text-sm text-[#c4b5fd]">Locked case-study submissions will appear here when learners request marking.</p></div>}</CardContent></Card> : active === "Products" || active === "Case-study exams" || active === "Question bank" ? <Card className="mt-7"><CardHeader><CardTitle className="text-white">{active}</CardTitle><p className="mt-1 text-sm text-white/50">Live published catalogue records available to administrators.</p></CardHeader><CardContent>{products.length ? <div className="grid gap-3 md:grid-cols-2">{products.filter(({ product }) => active === "Products" || (active === "Case-study exams" ? product.category === "case_study" : product.category === "objective_test")).map(({ product, qualification }) => <div key={product.id} className="rounded-xl border border-white/10 p-4"><Badge variant="outline" className="border-[#00ff88] text-[#00ff88]">{product.category.replace("_", " ")}</Badge><h3 className="mt-3 font-bold text-white">{product.title}</h3><p className="mt-1 text-sm text-[#c4b5fd]">{qualification?.name ?? "No qualification linked"}</p><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><div className="text-xs text-white/50">{product.status} · {product.priceCents ? `${(product.priceCents / 100).toFixed(2)} price` : "Free access"}</div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" className="border-[#00e5ff] text-[#00e5ff]" disabled={updateProductStatus.isPending} onClick={() => updateProductStatus.mutate({ productId: product.id, status: product.status === "published" ? "draft" : "published" })}>{product.status === "published" ? "Unpublish" : "Publish"}</Button></div></div></div>)}</div> : <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-[#c4b5fd]">No published catalogue records found.</div>}</CardContent></Card> : <Card className="mt-7"><CardHeader><CardTitle className="text-white">Recent activity</CardTitle><p className="mt-1 text-sm text-white/50">Role-gated changes and exam workflow events from the audit log.</p></CardHeader><CardContent>{renderActivity.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-white/10 text-xs uppercase tracking-wider text-white/50"><tr><th className="pb-3">Event</th><th className="pb-3">Owner</th><th className="pb-3">Status</th><th className="pb-3">When</th></tr></thead><tbody>{renderActivity.map(({ event, owner, status, when }) => <tr key={`${event}-${when}`} className="border-b border-white/10 last:border-0"><td className="py-4 font-semibold text-white">{event}</td><td className="py-4 text-[#c4b5fd]">{owner}</td><td className="py-4"><Badge variant="outline" className="border-[#00ff88] text-[#00ff88]">{status}</Badge></td><td className="py-4 text-white/50">{when}</td></tr>)}</tbody></table></div> : <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-[#c4b5fd]">No audit activity has been recorded yet.</div>}</CardContent></Card>}</main></div></div>;
}

function HomePage({ onLogin }: { onLogin: () => void }) { return <div className="min-h-screen bg-[#18093c]"><PublicHeader onLogin={onLogin} /><main><section className="hero-section"><div className="container grid gap-10 py-16 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:py-20"><div className="relative z-10"><p className="eyebrow">Professional training. Clear and simple.</p><h1 className="mt-4 max-w-xl text-5xl font-black leading-[1.05] tracking-[-0.04em] text-white sm:text-6xl">Build confidence.<br /><span className="text-[#00ff88]">Achieve more.</span></h1><p className="mt-6 max-w-lg text-lg leading-8 text-[#c4b5fd]">Realistic case-study exams, objective-test practice, and focused preparation for your next professional accounting milestone.</p><div className="mt-8 flex flex-wrap gap-3"><Button className="aft-button" onClick={() => document.getElementById("mock-exams")?.scrollIntoView({ behavior: "smooth" })}>Explore mock exams <ArrowRight className="ml-2 h-4 w-4" /></Button><Link href="/mock-exams"><Button variant="outline" className="border-[#00e5ff] text-white">Start practising <PlayCircle className="ml-2 h-4 w-4" /></Button></Link></div><div className="mt-10 flex items-center gap-8 text-sm"><div><div className="text-2xl font-black text-white">15+</div><div className="text-white/50">years of expertise</div></div><div className="h-9 w-px bg-white/20" /><div><div className="text-2xl font-black text-white">2</div><div className="text-white/50">professional pathways</div></div></div></div><div className="hero-visual"><div className="hero-glow" /><div className="hero-panel"><div className="hero-panel-top"><span className="h-2.5 w-2.5 rounded-full bg-[#ff8278]" /><span className="h-2.5 w-2.5 rounded-full bg-[#f4c44e]" /><span className="h-2.5 w-2.5 rounded-full bg-[#55c51f]" /></div><div className="hero-panel-body"><div className="hero-chart"><div className="hero-chart-label">Your exam readiness</div><div className="flex items-end gap-2"><div className="chart-bar h-20" /><div className="chart-bar h-28" /><div className="chart-bar h-24" /><div className="chart-bar chart-bar-strong h-36" /><div className="chart-bar chart-bar-strong h-44" /></div></div><div className="grid gap-3 sm:grid-cols-2"><div className="mini-stat"><Clock3 className="h-5 w-5 text-[#00ff88]" /><div><div className="font-bold text-white">45 min</div><div className="text-xs text-white/50">timed practice</div></div></div><div className="mini-stat"><ShieldCheck className="h-5 w-5 text-[#00ff88]" /><div><div className="font-bold text-white">Autosaved</div><div className="text-xs text-white/50">every response</div></div></div></div><div className="hero-exam-card"><div className="flex items-center justify-between"><div><div className="text-xs font-bold uppercase tracking-wider text-[#00ff88]">Continue learning</div><div className="mt-1 font-bold text-white">CIMA OCS Mock Exam 1</div></div><ArrowRight className="h-5 w-5 text-[#00ff88]" /></div><Progress value={42} className="mt-4 h-2" /></div></div></div></div></div></section><section id="mock-exams" className="border-y border-white/10 bg-[#120730] py-14"><div className="container"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="eyebrow">Mock-exam store</p><h2 className="mt-3 text-3xl font-bold text-white">Prepare with realistic exam conditions.</h2></div><Link href="/mock-exams" className="text-sm font-bold text-[#00ff88]">Browse mock exams <ArrowRight className="ml-1 inline h-4 w-4" /></Link></div><div className="mt-8 grid gap-4 md:grid-cols-3"><FeatureCard icon={PenLine} title="Case-study mocks" text="Practise realistic timed tasks with protected question papers and feedback guides." /><FeatureCard icon={BookOpen} title="Objective tests" text="Build configurable practice sets and review explanations after submission." /><FeatureCard icon={Sparkles} title="Exam resources" text="Open formulae, tables, pre-seen material, and solutions when your access permits." /></div></div></section><section id="resources" className="container py-16"><div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center"><div><p className="eyebrow">Why learners choose AFT</p><h2 className="mt-3 text-4xl font-bold tracking-tight text-white">A clearer route from study time to exam day.</h2><p className="mt-5 max-w-lg leading-8 text-[#c4b5fd]">Make every study session count with practical learning, intelligent practice, and a portal that keeps your progress visible.</p><div className="mt-7 space-y-4">{["Prepare with focused mock-exam pathways", "Practise with case-study and objective-test formats", "Track progress across owned products and saved attempts"].map((item) => <div key={item} className="flex items-center gap-3 text-sm font-semibold text-white"><div className="rounded-full bg-[#102b36] p-1"><Check className="h-4 w-4 text-[#00ff88]" /></div>{item}</div>)}</div></div><div className="grid gap-4 sm:grid-cols-2"><div className="feature-tile feature-tile-navy"><BookOpen className="h-7 w-7 text-[#00ff88]" /><div className="mt-12 text-2xl font-bold">Pre-seen resources</div><p className="mt-2 text-sm leading-6 text-white/70">Protected reference material available exactly when you need it.</p></div><div className="feature-tile feature-tile-green"><TimerReset className="h-7 w-7 text-white" /><div className="mt-12 text-2xl font-bold text-white">Exam confidence</div><p className="mt-2 text-sm leading-6 text-white/70">Build fluency with timed practice and feedback that points forward.</p></div></div></div></section></main><footer className="border-t border-white/10 bg-[#120730] py-10 text-white"><div className="container flex flex-wrap items-center justify-between gap-6"><BrandMark inverse /><div className="text-sm text-white/60">Accountants for Tomorrow · Professional learning and exam preparation</div></div></footer></div>; }

function FeatureCard({ icon: Icon, title, text }: { icon: typeof BookOpen; title: string; text: string }) { return <Card className="feature-card"><CardContent className="p-6"><div className="icon-box"><Icon className="h-5 w-5" /></div><h3 className="mt-5 font-bold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-[#c4b5fd]">{text}</p><div className="mt-5 text-sm font-bold text-[#00ff88]">Explore <ArrowRight className="ml-1 inline h-4 w-4" /></div></CardContent></Card>; }

function AppRouter() {
  const [, navigate] = useLocation();
  const [matchedCaseStudy, params] = useRoute("/case-study/:screen");
  const [screen, setScreen] = useState(params?.screen || "");
  const currentScreen = params?.screen || screen;
  const { isAuthenticated, user, loading } = useAuth();
  const [, dashRoute] = useRoute("/dashboard");
  const [, adminRoute] = useRoute("/admin");
  const [, mockRoute] = useRoute("/mock-exams");
  const [, objectiveRoute] = useRoute("/objective-tests");
  const mockExamsQuery = trpc.catalogue.mockExams.useQuery(undefined, { retry: false });
  const legacyMockExamId = typeof window === "undefined" ? 0 : Number(new URLSearchParams(window.location.search).get("mockExamId") || 0);
  const legacyProductId = typeof window === "undefined" ? 0 : Number(new URLSearchParams(window.location.search).get("productId") || 0);
  const legacyObjective = matchedCaseStudy && currentScreen === "mode" ? mockExamsQuery.data?.find((item) => item.mockExam.id === legacyMockExamId && item.mockExam.examType === "objective_test") : undefined;
  useEffect(() => {
    if (!legacyObjective) return;
    navigate(`/objective-tests?mockExamId=${legacyObjective.mockExam.id}&productId=${legacyProductId || legacyObjective.mockExam.productId}`);
  }, [legacyObjective, legacyProductId, navigate]);
  const handleLogin = () => { if (isAuthenticated) navigate("/dashboard"); else startLogin(); };
  if (loading && (dashRoute || adminRoute)) return <div className="min-h-screen bg-[#0c0524]" />;
  const go = (next: string) => { setScreen(next); if (["mode", "debrief", "instructions", "intro", "question", "submission", "solutions"].includes(next)) navigate(`/case-study/${next}${typeof window !== "undefined" ? window.location.search : ""}`); };
  if (legacyObjective) return <div className="min-h-screen bg-[#0c0524]" />;
  if (matchedCaseStudy) {
    if (currentScreen === "debrief") return <Debrief setScreen={go} />;
    if (currentScreen === "mode") return <ModeSelection setScreen={go} />;
    if (["instructions", "intro", "question"].includes(currentScreen)) return <ExamShell screen={currentScreen} setScreen={go} />;
    if (currentScreen === "submission") return <Submission setScreen={go} />;
    if (currentScreen === "solutions") return <Solutions setScreen={go} />;
  }
  if (mockRoute) return <MockExams setScreen={go} />;
  if (dashRoute) {
    if (!isAuthenticated) return <HomePage onLogin={handleLogin} />;
    if (user?.role === "admin" || user?.role === "instructor") return <DashboardRedirect role={user.role} />;
    return <Dashboard />;
  }
  if (objectiveRoute) return <ObjectiveTestsPanel />;
  if (adminRoute) return user?.role === "admin" ? <Admin /> : <HomePage onLogin={handleLogin} />;
  return <HomePage onLogin={handleLogin} />;
}

function Solutions({ setScreen }: { setScreen: (next: string) => void }) {
  const attemptsQuery = trpc.student.attempts.useQuery(undefined, { retry: false });
  const mockExamsQuery = trpc.catalogue.mockExams.useQuery(undefined, { retry: false });
  const routeParams = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const attemptId = Number(routeParams.get("attempt") || 0);
  const routeMockExamId = Number(routeParams.get("mockExamId") || 0);
  const routeProductId = Number(routeParams.get("productId") || 0);
  const attempt = attemptsQuery.data?.find(({ attempt: record }) => record.id === attemptId)?.attempt;
  const selectedRecord = mockExamsQuery.data?.find(({ mockExam, product }) => mockExam.id === routeMockExamId && product.id === routeProductId);
  const selectedExam = selectedRecord?.mockExam;
  const selectedAttemptMatches = Boolean(attempt && selectedExam && attempt.mockExamId === routeMockExamId && selectedExam.productId === routeProductId);
  const sectionsQuery = trpc.catalogue.caseStudySections.useQuery({ mockExamId: attempt?.mockExamId ?? 0 }, { retry: false, enabled: Boolean(attempt?.mockExamId) });
  const completed = canViewIllustrativeSolutions(attempt?.status);
  const illustrativeSolutions = getIllustrativeSolutions(selectedExam?.title, sectionsQuery.data ?? []);
  return <div className="min-h-screen bg-[#0c0524]"><PublicHeader onLogin={() => toast.info("Log in to view completed mock-exam solutions.")} /><main className="container py-12"><div className="mx-auto max-w-5xl"><p className="eyebrow">Online mock with solutions</p><h1 className="mt-3 text-4xl font-bold text-white">{selectedExam?.title ?? "Your mock-exam solutions"}</h1><p className="mt-4 max-w-3xl text-lg leading-8 text-[#c4b5fd]">Review AFT-created illustrative approaches after your attempt is complete. These are practice explanations, not official answers or an awarded mark.</p>{attemptsQuery.isLoading || mockExamsQuery.isLoading ? <Card className="mt-8 border-white/10 bg-[#120730]"><CardContent className="p-10 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#00e5ff] border-t-transparent" /><p className="mt-4 text-sm text-[#c4b5fd]">Checking your attempt status…</p></CardContent></Card> : !attemptId || attemptsQuery.isError || !attempt ? <Card className="mt-8 border-[#00e5ff]/30 bg-[#120730]"><CardContent className="p-10 text-center"><LockKeyhole className="mx-auto h-10 w-10 text-[#00e5ff]" /><h2 className="mt-5 text-xl font-bold text-white">Complete an interactive attempt to unlock solutions</h2><p className="mt-2 text-sm leading-6 text-[#c4b5fd]">Solutions are linked to a learner-owned attempt and are not available from the public store alone.</p><Button className="aft-button mt-6" onClick={() => setScreen("mode")}>Return to exam modes</Button></CardContent></Card> : attempt && !selectedAttemptMatches ? <Card className="mt-8 border-[#ff8278]/40 bg-[#120730]"><CardContent className="p-10 text-center"><LockKeyhole className="mx-auto h-10 w-10 text-[#ff8278]" /><h2 className="mt-5 text-xl font-bold text-white">This attempt does not match the selected mock exam</h2><p className="mt-2 text-sm leading-6 text-[#c4b5fd]">Open solutions from the completion link for the same attempt, mock exam, and product. No content has been unlocked for this mismatched route.</p><Button className="aft-button mt-6" onClick={() => setScreen("debrief")}>Return to mock exam</Button></CardContent></Card> : !completed ? <Card className="mt-8 border-[#00e5ff]/30 bg-[#120730]"><CardContent className="p-10 text-center"><Clock3 className="mx-auto h-10 w-10 text-[#00e5ff]" /><h2 className="mt-5 text-xl font-bold text-white">Solutions unlock after submission</h2><p className="mt-2 text-sm leading-6 text-[#c4b5fd]">Finish the timed attempt and lock your submission first. Your current status is <span className="font-bold text-[#00ff88]">{attempt.status.replace("_", " ")}</span>.</p><Button className="aft-button mt-6" onClick={() => setScreen("question")}>Continue attempt</Button></CardContent></Card> : sectionsQuery.isLoading ? <Card className="mt-8 border-white/10 bg-[#120730]"><CardContent className="p-10 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#00e5ff] border-t-transparent" /><p className="mt-4 text-sm text-[#c4b5fd]">Loading the selected section guide…</p></CardContent></Card> : sectionsQuery.isError ? <Card className="mt-8 border-[#ff8278]/40 bg-[#120730]"><CardContent className="p-10 text-center"><h2 className="text-xl font-bold text-white">The illustrative guide is temporarily unavailable</h2><p className="mt-2 text-sm text-[#c4b5fd]">Your attempt is complete, but the selected section metadata could not be loaded.</p></CardContent></Card> : !sectionsQuery.data?.length ? <Card className="mt-8 border-[#00e5ff]/30 bg-[#120730]"><CardContent className="p-10 text-center"><h2 className="text-xl font-bold text-white">No solution sections are published yet</h2><p className="mt-2 text-sm text-[#c4b5fd]">The attempt is complete, but the administrator has not published section metadata for this mock exam.</p></CardContent></Card> : <><div className="mt-8 rounded-2xl border border-[#00ff88]/40 bg-[#102b36] p-5"><div className="flex items-center gap-2 font-bold text-white"><Check className="h-5 w-5 text-[#00ff88]" /> Attempt complete · {solutionAccessLabel(attempt?.status)}</div><p className="mt-2 text-sm leading-6 text-[#c4b5fd]">The guide below is an AFT-created practice aid inspired by the selected section themes. It must not be treated as the official marking guide.</p></div><div className="mt-8 space-y-4">{illustrativeSolutions.map((solution) => <Card key={solution.heading} className="border-white/10 bg-[#120730]"><CardContent className="p-6 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">Section {solution.sectionNumber}</p><h2 className="mt-2 text-xl font-bold text-white">{solution.heading}</h2></div><Badge className="bg-[#24105c] text-[#00e5ff]">AFT illustrative solution</Badge></div><p className="mt-4 leading-7 text-[#c4b5fd]">{solution.body}</p></CardContent></Card>)}</div><Button variant="outline" className="mt-8 border-[#00e5ff] text-[#00e5ff]" onClick={() => setScreen("debrief")}>Back to mock exam</Button></>}</div></main></div>;
}

function Submission({ setScreen }: { setScreen: (next: string) => void }) {
  const [submitted, setSubmitted] = useState(false);
  const submitAttempt = trpc.exams.submit.useMutation();
  const entitlementsQuery = trpc.student.entitlements.useQuery(undefined, { retry: false });
  const attemptId = typeof window === "undefined" ? 0 : Number(new URLSearchParams(window.location.search).get("attempt") || 0);
  const hasMarkingAccess = entitlementsQuery.data?.some(({ entitlement, product }) => product.category === "marking" && hasActiveEntitlement(entitlement)) === true;
  const submit = (optOutOfMarking: boolean) => submitAttempt.mutate({ attemptId, optOutOfMarking }, { onSuccess: () => { setSubmitted(true); toast.success("Submission locked and recorded"); }, onError: (error) => toast.error(error.message) });
  return <div className="min-h-screen bg-[#0c0524]"><PublicHeader onLogin={() => startLogin("login")} /><main className="container py-12"><Card className="mx-auto max-w-3xl border-0 shadow-[0_25px_80px_rgba(7,24,79,0.10)]"><CardContent className="p-9">{submitted ? <div className="py-8 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e5f7e9]"><Check className="h-8 w-8 text-[#00ff88]" /></div><h1 className="mt-6 text-3xl font-bold text-white">Exam submitted</h1><p className="mx-auto mt-3 max-w-md leading-7 text-[#c4b5fd]">Your attempt has been locked and securely recorded. You’ll receive a notification when marking is complete.</p><Button className="aft-button mt-7" onClick={() => setScreen("solutions")}>View illustrative solutions <ArrowRight className="ml-2 h-4 w-4" /></Button><Button variant="outline" className="border-[#00e5ff] text-white mt-3" onClick={() => window.location.href = "/"}>Return to home</Button></div> : <><p className="eyebrow">Final step</p><h1 className="mt-2 text-3xl font-bold text-white">Submit your case-study exam</h1><p className="mt-3 text-[#c4b5fd]">Review your completion summary before you lock and submit this attempt.</p><div className="mt-7 grid gap-3 sm:grid-cols-2">{[["First Name", "Thando"], ["Last Name", "Mokoena"], ["Email", "thando@example.com"], ["Status", "All sections answered"]].map(([label, value]) => <div key={label} className="rounded-xl border border-white/10 p-4"><div className="text-xs font-semibold uppercase tracking-wider text-white/50">{label}</div><div className="mt-1 font-semibold text-white">{value}</div></div>)}</div><div className="mt-6 rounded-xl border border-[#00e5ff]/30 bg-[#120730] p-4"><div className="font-bold text-white">Instructor marking</div><p className="mt-1 text-sm leading-6 text-[#c4b5fd]">{entitlementsQuery.isLoading ? "Checking your marking access…" : hasMarkingAccess ? "Your marking add-on is active. Send this locked attempt to the instructor queue." : "Purchase the Instructor marking add-on from the store to enable Send for marking."}</p></div><div className="mt-7 flex flex-wrap justify-end gap-3"><Button variant="outline" className="border-[#00e5ff] text-white" onClick={() => setScreen("question")}>Return to review</Button><Button variant="outline" className="border-white/15 text-white/60" disabled={!attemptId || submitAttempt.isPending} onClick={() => submit(true)}>Submit without marking</Button><Button className="aft-button" disabled={!attemptId || submitAttempt.isPending || entitlementsQuery.isLoading || !hasMarkingAccess} onClick={() => submit(false)}>{submitAttempt.isPending ? "Locking…" : "Send for marking"} <ArrowRight className="ml-2 h-4 w-4" /></Button></div></>}</CardContent></Card></main></div>;
}

export default function Home() { return <AppRouter />; }

function AdminManagementTools() {
  const productsQuery = trpc.admin.products.useQuery(undefined, { retry: false });
  const [productTitle, setProductTitle] = useState("");
  const [productCategory, setProductCategory] = useState<"case_study" | "objective_test" | "marking" | "resource">("objective_test");
  const [productDescription, setProductDescription] = useState("");
  const [productFeaturedImage, setProductFeaturedImage] = useState("");
  const [productPrice, setProductPrice] = useState("149");
  const [accessDays, setAccessDays] = useState("30");
  const [examProductId, setExamProductId] = useState("");
  const [examTitle, setExamTitle] = useState("");
  const [examType, setExamType] = useState<"case_study" | "objective_test">("objective_test");
  const [examDuration, setExamDuration] = useState("45");
  const [questionExamId, setQuestionExamId] = useState("");
  const [questionTopic, setQuestionTopic] = useState("");
  const [questionPrompt, setQuestionPrompt] = useState("");
  const [questionOptions, setQuestionOptions] = useState("");
  const [questionCorrect, setQuestionCorrect] = useState("0");
  const [questionType, setQuestionType] = useState<"single_choice" | "multiple_choice" | "dropdown" | "numerical" | "text_input">("single_choice");
  const [questionExplanation, setQuestionExplanation] = useState("");
  const [questionAttachment, setQuestionAttachment] = useState<{ name: string; type: string; data: string } | null>(null);
  const [resourceProductId, setResourceProductId] = useState("");
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceKind, setResourceKind] = useState<"pre_seen" | "formulae" | "printable_pdf" | "feedback" | "course_material" | "reference">("reference");
  const [resourceFile, setResourceFile] = useState<{ name: string; type: string; data: string } | null>(null);
  const createProduct = trpc.admin.createProduct.useMutation({ onSuccess: () => { toast.success("Product created as draft"); productsQuery.refetch(); setProductTitle(""); setProductFeaturedImage(""); }, onError: (error) => toast.error(error.message) });
  const updateAccess = trpc.admin.updateAccessDays.useMutation({ onSuccess: () => { toast.success("Access period updated"); productsQuery.refetch(); }, onError: (error) => toast.error(error.message) });
  const updatePrice = trpc.admin.updatePrice.useMutation({ onSuccess: () => { toast.success("Product pricing updated"); productsQuery.refetch(); }, onError: (error) => toast.error(error.message) });
  const createExam = trpc.admin.createMockExam.useMutation({ onSuccess: () => toast.success("Exam created as draft"), onError: (error) => toast.error(error.message) });
  const createQuestion = trpc.admin.createObjectiveQuestion.useMutation({ onSuccess: () => { toast.success("Objective question created as draft"); setQuestionPrompt(""); setQuestionAttachment(null); }, onError: (error) => toast.error(error.message) });
  const uploadResource = trpc.admin.uploadResource.useMutation({ onSuccess: () => { toast.success("Resource uploaded as draft"); setResourceFile(null); }, onError: (error) => toast.error(error.message) });
  const provisionDemo = trpc.admin.provisionDemoLearner.useMutation({ onSuccess: (result) => toast.success(`Demo learner ready with ${result.productCount} products · expires ${new Date(result.expiresAt).toLocaleDateString()}`), onError: (error) => toast.error(error.message) });
  const productRows = productsQuery.data ?? [];
  return <Card className="mt-7 border-[#00e5ff]/30 bg-[#120730]"><CardHeader><CardTitle className="text-white">Site administration & content studio</CardTitle><p className="text-sm leading-6 text-white/50">Create products and exam records, set subscription duration, add original questions, and upload protected resources. New records are drafts until an administrator publishes them.</p></CardHeader><CardContent className="grid gap-5 lg:grid-cols-2">
    <div className="space-y-3 rounded-xl border border-white/10 bg-[#18093c]/60 p-4"><div className="font-bold text-white">Create store product</div><Input value={productTitle} onChange={(event) => setProductTitle(event.target.value)} placeholder="Product title" className="border-white/10 bg-[#0c0524] text-white" /><select value={productCategory} onChange={(event) => setProductCategory(event.target.value as typeof productCategory)} className="h-10 w-full rounded-lg border border-white/10 bg-[#0c0524] px-3 text-sm text-white"><option value="objective_test">Objective test</option><option value="case_study">Case study</option><option value="marking">Instructor marking</option><option value="resource">Resource</option></select><Input value={productDescription} onChange={(event) => setProductDescription(event.target.value)} placeholder="Description" className="border-white/10 bg-[#0c0524] text-white" /><Input value={productFeaturedImage} onChange={(event) => setProductFeaturedImage(event.target.value)} placeholder="Featured image URL (https://...)" className="border-white/10 bg-[#0c0524] text-white" /><div className="grid grid-cols-2 gap-2"><Input type="number" value={productPrice} onChange={(event) => setProductPrice(event.target.value)} placeholder="Price ZAR" className="border-white/10 bg-[#0c0524] text-white" /><Input type="number" value={accessDays} onChange={(event) => setAccessDays(event.target.value)} placeholder="Access days" className="border-white/10 bg-[#0c0524] text-white" /></div><Button className="aft-button" disabled={createProduct.isPending || !productTitle.trim()} onClick={() => createProduct.mutate({ title: productTitle, category: productCategory, description: productDescription, featuredImageUrl: productFeaturedImage || undefined, priceCents: Math.round(Number(productPrice) * 100), accessDays: Number(accessDays) || 30 })}>Create draft product</Button></div>
    <div className="space-y-3 rounded-xl border border-white/10 bg-[#18093c]/60 p-4"><div className="font-bold text-white">Set subscription period</div><p className="text-xs text-[#c4b5fd]">Existing and new exam products can use an administrator-controlled access window. New defaults are 30 days.</p>{productRows.slice(0, 8).map(({ product }) => <div key={product.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 p-2"><span className="min-w-0 flex-1 truncate text-sm text-white">{product.title}</span><div className="flex items-center gap-2"><select aria-label={`Pricing mode for ${product.title}`} defaultValue={product.priceCents === 0 ? "free" : "paid"} className="h-8 rounded-lg border border-white/10 bg-[#0c0524] px-2 text-xs text-white" onChange={(event) => { const priceCents = event.target.value === "free" ? 0 : Math.max(100, product.priceCents || 14900); updatePrice.mutate({ productId: product.id, priceCents }); }}><option value="free">Free</option><option value="paid">Paid</option></select>{product.priceCents > 0 && <Input aria-label={`Price for ${product.title}`} defaultValue={String((product.priceCents / 100).toFixed(2))} type="number" min="1" step="0.01" className="h-8 w-20 border-white/10 bg-[#0c0524] text-white" onBlur={(event) => { const priceCents = Math.round(Number(event.target.value) * 100); if (priceCents !== product.priceCents) updatePrice.mutate({ productId: product.id, priceCents }); }} />}<Input aria-label={`Access days for ${product.title}`} defaultValue={String(product.accessDays)} type="number" min="1" max="3650" className="h-8 w-20 border-white/10 bg-[#0c0524] text-white" onBlur={(event) => { const days = Number(event.target.value); if (days !== product.accessDays) updateAccess.mutate({ productId: product.id, accessDays: days }); }} /><span className="text-xs text-white/50">days</span></div></div>)}</div>
    <div className="space-y-3 rounded-xl border border-white/10 bg-[#18093c]/60 p-4"><div className="font-bold text-white">Create exam record</div><select value={examProductId} onChange={(event) => setExamProductId(event.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-[#0c0524] px-3 text-sm text-white"><option value="">Select product</option>{productRows.map(({ product }) => <option key={product.id} value={product.id}>{product.title}</option>)}</select><Input value={examTitle} onChange={(event) => setExamTitle(event.target.value)} placeholder="Exam title" className="border-white/10 bg-[#0c0524] text-white" /><div className="grid grid-cols-2 gap-2"><select value={examType} onChange={(event) => setExamType(event.target.value as typeof examType)} className="h-10 rounded-lg border border-white/10 bg-[#0c0524] px-3 text-sm text-white"><option value="objective_test">Objective test</option><option value="case_study">Case study</option></select><Input type="number" value={examDuration} onChange={(event) => setExamDuration(event.target.value)} placeholder="Minutes" className="border-white/10 bg-[#0c0524] text-white" /></div><Button variant="outline" className="border-[#00e5ff] text-white" disabled={createExam.isPending || !examProductId || !examTitle.trim()} onClick={() => createExam.mutate({ productId: Number(examProductId), title: examTitle, examType, totalDurationSeconds: Math.max(60, Number(examDuration) * 60) })}>Create draft exam</Button></div>
    <div className="space-y-3 rounded-xl border border-white/10 bg-[#18093c]/60 p-4"><div className="font-bold text-white">Add objective question</div><Input value={questionExamId} onChange={(event) => setQuestionExamId(event.target.value)} placeholder="Objective exam ID" className="border-white/10 bg-[#0c0524] text-white" /><Input value={questionTopic} onChange={(event) => setQuestionTopic(event.target.value)} placeholder="Topic" className="border-white/10 bg-[#0c0524] text-white" /><Textarea value={questionPrompt} onChange={(event) => setQuestionPrompt(event.target.value)} placeholder="Original AFT question" className="border-white/10 bg-[#0c0524] text-white" /><Textarea value={questionOptions} onChange={(event) => setQuestionOptions(event.target.value)} placeholder="Options, one per line" className="border-white/10 bg-[#0c0524] text-white" /><div className="grid gap-2 sm:grid-cols-3"><select value={questionType} onChange={(event) => setQuestionType(event.target.value as typeof questionType)} className="h-10 rounded-lg border border-white/10 bg-[#0c0524] px-3 text-sm text-white" aria-label="Question type"><option value="single_choice">Single choice</option><option value="multiple_choice">Multiple choice</option><option value="dropdown">Dropdown</option><option value="numerical">Numerical input</option><option value="text_input">Text input</option></select><Input type="number" value={questionCorrect} onChange={(event) => setQuestionCorrect(event.target.value)} placeholder="Correct option index" className="border-white/10 bg-[#0c0524] text-white" /><select value="medium" className="h-10 rounded-lg border border-white/10 bg-[#0c0524] px-3 text-sm text-white" aria-label="Difficulty"><option>medium</option><option>easy</option><option>hard</option></select></div><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="block w-full text-sm text-[#c4b5fd]" aria-label="Question image attachment" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setQuestionAttachment({ name: file.name, type: file.type, data: String(reader.result) }); reader.readAsDataURL(file); }} /><Button variant="outline" className="border-[#00e5ff] text-white" disabled={createQuestion.isPending || !questionExamId || !questionPrompt.trim()} onClick={() => createQuestion.mutate({ mockExamId: Number(questionExamId), topic: questionTopic || "General", prompt: questionPrompt, options: questionOptions.split("\n").map((value) => value.trim()).filter(Boolean), correct: Number(questionCorrect) || 0, questionType, explanation: questionExplanation || undefined, difficulty: "medium", attachmentBase64: questionAttachment?.data, attachmentFileName: questionAttachment?.name, attachmentMimeType: questionAttachment?.type })}>Save question draft</Button></div>
    <div className="space-y-3 rounded-xl border border-[#00ff88]/30 bg-[#102b36]/40 p-4 lg:col-span-2"><div className="font-bold text-white">Demo learner access</div><p className="text-sm leading-6 text-[#c4b5fd]">Provision or refresh the isolated AFT Demo Learner account with every published Case Study and Objective test product. Demo access lasts 60 days and does not affect real learner accounts.</p><Button className="aft-button" disabled={provisionDemo.isPending} onClick={() => provisionDemo.mutate()}>{provisionDemo.isPending ? "Provisioning…" : "Provision 60-day demo account"}</Button></div>
    <div className="space-y-3 rounded-xl border border-white/10 bg-[#18093c]/60 p-4 lg:col-span-2"><div className="font-bold text-white">Upload protected exam/resource file</div><div className="grid gap-2 md:grid-cols-3"><select value={resourceProductId} onChange={(event) => setResourceProductId(event.target.value)} className="h-10 rounded-lg border border-white/10 bg-[#0c0524] px-3 text-sm text-white"><option value="">Select product</option>{productRows.map(({ product }) => <option key={product.id} value={product.id}>{product.title}</option>)}</select><Input value={resourceTitle} onChange={(event) => setResourceTitle(event.target.value)} placeholder="Resource title" className="border-white/10 bg-[#0c0524] text-white" /><select value={resourceKind} onChange={(event) => setResourceKind(event.target.value as typeof resourceKind)} className="h-10 rounded-lg border border-white/10 bg-[#0c0524] px-3 text-sm text-white"><option value="reference">Reference material</option><option value="pre_seen">Pre-seen</option><option value="formulae">Formulae + tables</option><option value="printable_pdf">Printable PDF</option><option value="feedback">Feedback guide</option></select></div><input type="file" accept=".pdf,.doc,.docx,.txt" className="block w-full text-sm text-[#c4b5fd]" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setResourceFile({ name: file.name, type: file.type, data: String(reader.result) }); reader.readAsDataURL(file); }} /><Button variant="outline" className="border-[#00e5ff] text-white" disabled={uploadResource.isPending || !resourceProductId || !resourceFile} onClick={() => resourceFile && uploadResource.mutate({ productId: Number(resourceProductId), title: resourceTitle, kind: resourceKind, fileName: resourceFile.name, mimeType: resourceFile.type, base64: resourceFile.data })}>{uploadResource.isPending ? "Uploading…" : "Upload as draft"}</Button></div>
  </CardContent></Card>;
}
