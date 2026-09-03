import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Flag, PackageOpen, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PublicHeader } from "@/components/PortalHeader";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { calculateExamExpression } from "@shared/examCalculator";
import { ObjectiveAnswer, objectiveAnswerMatches, parseObjectiveQuestion, scoreObjectiveAnswers, selectObjectiveQuestions } from "@shared/objectiveTest";

type Stage = "course" | "extra-instructions" | "customize" | "mock-instructions" | "welcome" | "quiz";

function shuffleQuestions<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function ObjectiveTestsPanel() {
  const mockExamsQuery = trpc.catalogue.mockExams.useQuery(undefined, { retry: false });
  const questionQuery = trpc.catalogue.objectiveQuestions.useQuery(undefined, { retry: false });
  const [stage, setStage] = useState<Stage>("course");
  const [timed, setTimed] = useState(true);
  const [topic, setTopic] = useState("All topics");
  const [questionCount, setQuestionCount] = useState<number | "all">(20);
  const [quizQuestions, setQuizQuestions] = useState<ReturnType<typeof parseObjectiveQuestion>[]>([]);
  const [question, setQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, ObjectiveAnswer>>({});
  const [flags, setFlags] = useState<Set<number>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [seconds, setSeconds] = useState(90 * 60);
  const requestedMockExamId = typeof window === "undefined" ? 0 : Number(new URLSearchParams(window.location.search).get("mockExamId") || 0);
  const objectiveMocks = useMemo(() => (mockExamsQuery.data ?? []).filter((item) => item.mockExam.examType === "objective_test"), [mockExamsQuery.data]);
  const selectedMock = objectiveMocks.find((item) => item.mockExam.id === requestedMockExamId) ?? objectiveMocks[0];
  const selectedMockExamId = selectedMock?.mockExam.id ?? 0;
  const rawQuestions = useMemo(() => (questionQuery.data ?? []).filter((item) => item.mockExamId === selectedMockExamId), [questionQuery.data, selectedMockExamId]);
  const allQuestions = useMemo(() => rawQuestions.map((item) => parseObjectiveQuestion(item)), [rawQuestions]);
  const topics = useMemo(() => ["All topics", ...Array.from(new Set(allQuestions.map((item) => item.topic)))], [allQuestions]);
  const questions = selectObjectiveQuestions(allQuestions, topic, questionCount);
  const activeQuestions = stage === "quiz" ? quizQuestions : questions;
  const current = activeQuestions[question];
  const score = useMemo(() => scoreObjectiveAnswers(activeQuestions, answers), [activeQuestions, answers]);
  const title = selectedMock?.mockExam.title ?? "AFT Objective Test Practice";
  const resetAttempt = () => { setAnswers({}); setFlags(new Set()); setSubmitted(false); setQuestion(0); setSeconds(90 * 60); };
  const begin = (next: Stage) => { resetAttempt(); if (next === "quiz") setQuizQuestions(shuffleQuestions(selectObjectiveQuestions(allQuestions, topic, questionCount))); setStage(next); };
  const toggleFlag = () => setFlags((old) => { const next = new Set(old); next.has(question) ? next.delete(question) : next.add(question); return next; });
  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  useEffect(() => {
    if (stage !== "quiz" || !timed || submitted || seconds <= 0 || !activeQuestions.length) return;
    const timer = window.setInterval(() => setSeconds((value) => { if (value <= 1) { window.clearInterval(timer); setSubmitted(true); toast.info("Time is up. Your practice set has been submitted for review."); return 0; } return value - 1; }), 1000);
    return () => window.clearInterval(timer);
  }, [stage, timed, submitted, seconds, activeQuestions.length]);

  if (mockExamsQuery.isLoading || questionQuery.isLoading) return <Shell><div className="h-72 animate-pulse rounded-2xl border border-white/10 bg-[#120730]" /></Shell>;
  if (!selectedMock) return <Shell><EmptyState /></Shell>;

  if (stage === "quiz") return <QuizScreen title={title} questions={questions} current={current} question={question} setQuestion={setQuestion} answers={answers} setAnswers={setAnswers} flags={flags} toggleFlag={toggleFlag} timed={timed} time={time} submitted={submitted} setSubmitted={setSubmitted} score={score} onReset={() => begin("customize")} />;

  return <Shell>
    {stage === "course" && <CourseOverview title={title} questionCount={allQuestions.length} onExtra={() => setStage("extra-instructions")} onMock={() => setStage("mock-instructions")} />}
    {stage === "extra-instructions" && <InstructionScreen title={`${title}: Test Yourself Extra`} label="Question bank" copy="This custom AFT practice test lets you choose 20 or 60 questions and the topic areas you want to cover from the larger bank. When you finish, your score, percentage, correct answers, and explanations will be shown. Revisit the activity to start a fresh practice set; previous answers are not saved." action="Customize test" onAction={() => setStage("customize")} onBack={() => setStage("course")} />}
    {stage === "customize" && <CustomizeScreen topics={topics} topic={topic} setTopic={(value) => { setTopic(value); setQuestion(0); }} questionCount={questionCount} setQuestionCount={(value) => { setQuestionCount(value); setQuestion(0); }} timed={timed} setTimed={setTimed} time={time} onStart={() => begin("quiz")} onBack={() => setStage("extra-instructions")} />}
    {stage === "mock-instructions" && <InstructionScreen title={`${title}: Mock Exam`} label="Online mock" copy="Complete this AFT-created online mock under timed conditions and without study materials where possible. On completion, review your score, percentage, correct answers, and feedback so you can identify topics to revisit." action="Continue" onAction={() => setStage("welcome")} onBack={() => setStage("course")} />}
    {stage === "welcome" && <WelcomeScreen title={title} onStart={() => begin("quiz")} onBack={() => setStage("mock-instructions")} />}
  </Shell>;
}

function Shell({ children }: { children: React.ReactNode }) { return <div data-assessment="objective-test" className="min-h-screen bg-[#0c0524]"><PublicHeader onLogin={() => toast.info("Login flow is connected to the account portal.")} /><main className="container py-8 sm:py-10">{children}</main></div>; }

function CourseOverview({ title, questionCount, onExtra, onMock }: { title: string; questionCount: number; onExtra: () => void; onMock: () => void }) { return <div className="mx-auto max-w-4xl"><div className="grid gap-5 rounded-2xl border border-[#00e5ff]/35 bg-gradient-to-br from-[#18093c] via-[#140832] to-[#0f062a] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.28)] sm:p-6 lg:grid-cols-[1.08fr_.92fr] lg:items-end"><div><p className="eyebrow">Objective test course</p><h1 className="mt-3 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-4xl">{title}</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-[#c4b5fd]">Build exam confidence with a focused AFT practice course. Choose a 20- or 60-question practice set from the larger bank, or take the online mock in realistic conditions.</p><div className="mt-5 flex flex-wrap gap-2"><Badge className="bg-[#102b36] text-[#00ff88]">Management</Badge><Badge variant="outline" className="border-[#00e5ff] text-[#00e5ff]">{questionCount} published questions</Badge></div></div><div className="rounded-xl border border-white/10 bg-[#0c0524]/60 p-4"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#00ff88]">Course summary</p><p className="mt-2 text-sm leading-6 text-[#c4b5fd]">Practice topic areas, select your question count, and review explanations after submission. These are original AFT-created practice materials, not official CIMA questions.</p></div></div><div className="mt-6 border-b border-white/10 pb-3"><p className="eyebrow">Dashboard</p><h2 className="mt-1 text-xl font-bold text-white">Assessments</h2></div><div className="mt-4 grid gap-4 md:grid-cols-2"><AssessmentCard eyebrow="Question bank" title="Test Yourself Extra" text="Build your own test by selecting question count and topic areas." action="Open assessment" onClick={onExtra} /><AssessmentCard eyebrow="Online mock" title={`${title} · Online mock`} text={`Complete the selected ${title} mock under timed conditions, then review your score and feedback.`} action="Open assessment" onClick={onMock} /></div></div>; }

function AssessmentCard({ eyebrow, title, text, action, onClick }: { eyebrow: string; title: string; text: string; action: string; onClick: () => void }) { return <Card className="border-[#00e5ff]/30 bg-[#120730] shadow-[0_12px_32px_rgba(0,0,0,0.18)]"><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#00ff88]">{eyebrow}</p><h3 className="mt-2 text-xl font-bold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-[#c4b5fd]">{text}</p></div><PackageOpen className="h-7 w-7 text-[#00e5ff]" /></div><Button className="mt-6 aft-button" onClick={onClick}>{action}<ChevronRight className="ml-2 h-4 w-4" /></Button></CardContent></Card>; }

function InstructionScreen({ title, label, copy, action, onAction, onBack }: { title: string; label: string; copy: string; action: string; onAction: () => void; onBack: () => void }) { return <div className="mx-auto max-w-4xl"><button className="mb-6 text-sm font-bold text-[#00e5ff]" onClick={onBack}>← Back to course</button><Card className="border-[#00e5ff]/30 bg-[#120730]"><CardContent className="p-7 sm:p-10"><Badge className="bg-[#102b36] text-[#00ff88]">{label}</Badge><h1 className="mt-5 text-4xl font-black text-white">{title}</h1><p className="mt-5 max-w-3xl text-base leading-8 text-[#c4b5fd]">{copy}</p><div className="mt-8 rounded-2xl border border-white/10 bg-[#18093c]/70 p-5"><p className="font-bold text-white">Before you begin</p><p className="mt-2 text-sm leading-7 text-[#c4b5fd]">Select Start or Continue in the bottom-right action area. Your current practice screen will be a fresh attempt and the final screen will provide feedback.</p></div><div className="mt-8 flex justify-end"><Button className="aft-button" onClick={onAction}>{action}<ChevronRight className="ml-2 h-4 w-4" /></Button></div></CardContent></Card></div>; }

function WelcomeScreen({ title, onStart, onBack }: { title: string; onStart: () => void; onBack: () => void }) { return <div className="mx-auto flex min-h-[560px] max-w-4xl items-center"><Card className="w-full border-[#00e5ff]/30 bg-[#120730]"><CardContent className="p-8 text-center sm:p-14"><Badge className="bg-[#102b36] text-[#00ff88]">Welcome to your online mock</Badge><h1 className="mt-6 text-4xl font-black text-white sm:text-5xl">Ready to begin?</h1><p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-[#c4b5fd]">{title} will open in the AFT assessment workspace. Work through each question, use the question navigator to move around, and submit when you are ready.</p><div className="mt-9 flex flex-wrap justify-center gap-3"><Button variant="outline" className="border-[#00e5ff] text-white" onClick={onBack}>Back</Button><Button className="aft-button" onClick={onStart}>Start mock exam <ChevronRight className="ml-2 h-4 w-4" /></Button></div></CardContent></Card></div>; }

function CustomizeScreen({ topics, topic, setTopic, questionCount, setQuestionCount, timed, setTimed, time, onStart, onBack }: { topics: string[]; topic: string; setTopic: (value: string) => void; questionCount: number | "all"; setQuestionCount: (value: number | "all") => void; timed: boolean; setTimed: (value: boolean) => void; time: string; onStart: () => void; onBack: () => void }) { return <div className="mx-auto max-w-5xl"><button className="mb-6 text-sm font-bold text-[#00e5ff]" onClick={onBack}>← Back to instructions</button><div className="grid gap-5"><Card className="border-white/10 bg-[#120730]"><CardHeader><CardTitle className="text-white">Customize your test</CardTitle><p className="text-sm text-[#c4b5fd]">Choose your question bank and exam conditions.</p></CardHeader><CardContent className="space-y-5"><label className="block text-sm font-bold text-white">Topic<select value={topic} onChange={(event) => setTopic(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#18093c] px-3 text-sm font-normal text-white">{topics.map((item) => <option key={item}>{item}</option>)}</select></label><label className="block text-sm font-bold text-white">Number of questions<Input type="number" aria-label="Number of questions" min={1} max={100} value={questionCount === "all" ? 60 : questionCount} onChange={(event) => { const value = Math.max(1, Math.min(100, Number(event.target.value))); setQuestionCount(Number.isNaN(value) ? 1 : value); }} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#18093c] px-3 text-sm font-normal text-white" /></label><div className="flex items-center justify-between rounded-xl bg-[#102b36] p-4"><div><div className="font-bold text-white">Timed mode</div><div className="text-xs text-[#c4b5fd]">{timed ? `${time} starting time` : "No countdown"}</div></div><button aria-label="Toggle timed mode" onClick={() => setTimed(!timed)} className={`h-6 w-11 rounded-full p-1 ${timed ? "bg-[#00ff88]" : "bg-[#24105c]"}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${timed ? "translate-x-5" : ""}`} /></button></div><Button className="w-full aft-button" onClick={onStart}>Start test <ChevronRight className="ml-2 h-4 w-4" /></Button></CardContent></Card></div></div>; }

function QuizScreen({ title, questions, current, question, setQuestion, answers, setAnswers, flags, toggleFlag, timed, time, submitted, setSubmitted, score, onReset }: { title: string; questions: ReturnType<typeof parseObjectiveQuestion>[]; current?: ReturnType<typeof parseObjectiveQuestion>; question: number; setQuestion: (value: number) => void; answers: Record<number, ObjectiveAnswer>; setAnswers: React.Dispatch<React.SetStateAction<Record<number, ObjectiveAnswer>>>; flags: Set<number>; toggleFlag: () => void; timed: boolean; time: string; submitted: boolean; setSubmitted: (value: boolean) => void; score: number; onReset: () => void }) {
  const [panel, setPanel] = useState<null | "calculator" | "scratchpad" | "navigation">(null);
  if (!current) return <EmptyState />;
  const darkControl = "bg-[#18093c] text-white hover:bg-[#24105c]";
  return <div data-objective-workspace="reference-style" className="objective-reference-workspace flex min-h-screen items-start bg-[#0c0524] px-3 py-4 text-[#18212b] sm:items-center sm:px-6 sm:py-8 lg:px-10">
    <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-2xl border border-[#00e5ff]/35 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
    <header className="flex min-h-[60px] items-center justify-between bg-[#18093c] px-4 py-3 text-white shadow-sm sm:px-6">
      <div className="text-xl font-semibold tracking-tight">Question {question + 1}</div>
      <div className="text-right text-sm leading-5 sm:text-base"><div>{question + 1} of {questions.length}</div><div>Time remaining: {timed ? formatRemainingTime(time) : "Untimed"}</div></div>
    </header>
    <main className="min-h-[430px] px-4 py-5 sm:min-h-[460px] sm:px-6 sm:py-6 lg:min-h-[500px] lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="text-xs font-semibold uppercase tracking-[.16em] text-slate-500">{title}</div>
          <div className="text-xs text-slate-500">{current.topic}</div>
        </div>
        <div className="max-w-4xl">
          <h1 className="text-lg font-semibold leading-7 text-[#18212b] sm:text-xl">{current.prompt}</h1>
          {current.attachmentUrl && <img src={current.attachmentUrl} alt={current.attachmentFileName || "Question illustration"} className="mt-5 max-h-72 max-w-full rounded border border-slate-200 object-contain" />}
          <div className="mt-6"><AnswerControl current={current} question={question} answers={answers} setAnswers={setAnswers} /></div>
          <div className="mt-12 text-right text-xs font-medium text-slate-600">AFT-OT-{String(question + 1).padStart(4, "0")}</div>
        </div>
        {submitted && <div className="mt-8 max-w-5xl"><ResultPanel questions={questions} answers={answers} score={score} onReset={onReset} onReview={() => setSubmitted(false)} /></div>}
      </div>
    </main>
    <footer className="flex min-h-[66px] flex-wrap items-center justify-between gap-3 border-t border-slate-300 bg-[#d9d9d9] px-4 py-3 sm:px-6">
      <button className={`${darkControl} inline-flex h-8 items-center px-3 text-xs font-semibold`} onClick={() => setSubmitted(true)}>↪ End Assessment</button>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button className={`${darkControl} h-8 px-3 text-xs font-semibold`} onClick={() => setPanel("calculator")}>Calculator</button>
        <button className={`${darkControl} h-8 px-3 text-xs font-semibold`} onClick={() => setPanel("scratchpad")}>✎ Scratch Pad</button>
        <button className={`${darkControl} h-8 px-3 text-xs font-semibold`} onClick={toggleFlag} title={flags.has(question) ? "Remove flag" : "Flag for review"}>{flags.has(question) ? "⚑ Flagged" : "⚑ Flag"}</button>
        <button className={`${darkControl} h-8 px-3 text-xs font-semibold`} onClick={() => setPanel("navigation")}>Navigation</button>
        <button className={`${darkControl} h-8 px-3 text-xs font-semibold disabled:opacity-40`} disabled={question === 0} onClick={() => setQuestion(Math.max(0, question - 1))}>‹ Back</button>
        {question < questions.length - 1 ? <button className="h-8 bg-[#18093c] px-4 text-xs font-semibold text-white hover:bg-[#24105c]" onClick={() => setQuestion(Math.min(questions.length - 1, question + 1))}>Next ›</button> : <button className="h-8 bg-[#18093c] px-4 text-xs font-semibold text-white hover:bg-[#24105c]" onClick={() => { setSubmitted(true); toast.success("Practice set submitted"); }}>Submit ›</button>}
      </div>
    </footer>
    </div>
    {panel === "calculator" && <CalculatorModal onClose={() => setPanel(null)} />}
    {panel === "scratchpad" && <ScratchPadModal onClose={() => setPanel(null)} />}
    {panel === "navigation" && <NavigationModal questions={questions} question={question} setQuestion={(value) => { setQuestion(value); setPanel(null); }} answers={answers} flags={flags} onClose={() => setPanel(null)} />}
  </div>;
}

function CalculatorModal({ onClose }: { onClose: () => void }) {
  const [expression, setExpression] = useState("");
  const [display, setDisplay] = useState("0");
  const [notes, setNotes] = useState("");
  const press = (value: string) => {
    if (value === "C") { setExpression(""); setDisplay("0"); return; }
    if (value === "⌫") { const next = expression.slice(0, -1); setExpression(next); setDisplay(next || "0"); return; }
    if (value === "=") { try { const result = calculateExamExpression(expression); setExpression(result); setDisplay(result); } catch { setDisplay("Invalid calculation"); } return; }
    const next = `${expression}${value}`;
    setExpression(next);
    setDisplay(next);
  };
  return <ModalShell title="Calculator" onClose={onClose}>
    <div className="exam-calculator" style={{ background: "transparent" }}>
      <div className="exam-calculator-display">{display}</div>
      <div className="exam-calculator-grid">{["C", "⌫", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "0", ".", "(", ")", "="].map((key) => <button key={key} type="button" onClick={() => press(key)} className={key === "=" ? "exam-calculator-key exam-calculator-equals" : key === "C" ? "exam-calculator-key exam-calculator-clear" : "exam-calculator-key"}>{key}</button>)}</div>
    </div>
    <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Calculator working notes (not saved to your submission)" className="mt-4 min-h-20 w-full resize-none border-slate-300 bg-white text-[#18212b] placeholder:text-slate-400" />
  </ModalShell>;
}

function ScratchPadModal({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  return <ModalShell title="Scratch Pad" onClose={onClose}>
    <Textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Take notes here for this assessment. Content is kept for the current session only and is not submitted." className="min-h-56 w-full resize-none border-slate-300 bg-white text-[#18212b] placeholder:text-slate-400" />
    <div className="mt-2 text-right text-xs text-slate-500">{text.length} characters</div>
  </ModalShell>;
}

function NavigationModal({ questions, question, setQuestion, answers, flags, onClose }: { questions: ReturnType<typeof parseObjectiveQuestion>[]; question: number; setQuestion: (value: number) => void; answers: Record<number, ObjectiveAnswer>; flags: Set<number>; onClose: () => void }) {
  const hasAnswer = (index: number) => answers[index] !== undefined && !(Array.isArray(answers[index]) && (answers[index] as unknown[]).length === 0);
  const answeredCount = questions.filter((_, index) => hasAnswer(index)).length;
  return <ModalShell title="Question navigation" onClose={onClose}>
    <div className="mb-4 flex flex-wrap gap-4 text-xs text-slate-600">
      <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-sm border border-slate-300 bg-white" /> Not answered</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-sm border border-slate-300 bg-[#c9e7ff]" /> Answered</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-sm border border-slate-300 bg-[#ffe3a3]" /> Flagged</span>
      <span className="ml-auto font-semibold">{answeredCount} of {questions.length} answered</span>
    </div>
    <div className="grid max-h-64 grid-cols-6 gap-2 overflow-y-auto pr-1 sm:grid-cols-8">
      {questions.map((item, index) => {
        const answered = hasAnswer(index);
        const flagged = flags.has(index);
        const active = index === question;
        return <button key={index} type="button" onClick={() => setQuestion(index)} className={`flex h-9 items-center justify-center rounded border text-sm font-semibold ${active ? "border-[#0877bd] bg-[#0877bd] text-white" : flagged ? "border-[#e0a800] bg-[#ffe3a3] text-[#18212b]" : answered ? "border-[#3a9bdc] bg-[#c9e7ff] text-[#18212b]" : "border-slate-300 bg-white text-[#18212b] hover:border-[#0877bd]"} ${flagged && active ? "!border-[#0877bd] !bg-[#0877bd] !text-white" : ""}`}>{index + 1}</button>;
      })}
    </div>
  </ModalShell>;
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c0524]/70 p-4" onClick={onClose}>
    <div className="w-full max-w-lg rounded-lg border border-slate-300 bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-[#18212b]">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-7 w-7 items-center justify-center rounded border border-slate-300 text-slate-500 hover:bg-slate-100">✕</button>
      </div>
      {children}
    </div>
  </div>;
}

function formatRemainingTime(value: string) {
  const [minutesPart, secondsPart] = value.split(":").map(Number);
  const minutes = Number.isFinite(minutesPart) ? minutesPart : 0;
  const seconds = Number.isFinite(secondsPart) ? secondsPart : 0;
  const hours = Math.floor(minutes / 60);
  const remainderMinutes = minutes % 60;
  const parts = [] as string[];
  if (hours) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (remainderMinutes || hours) parts.push(`${remainderMinutes} minute${remainderMinutes === 1 ? "" : "s"}`);
  parts.push(`${seconds} second${seconds === 1 ? "" : "s"}`);
  return parts.join(", ");
}

function AnswerControl({ current, question, answers, setAnswers }: { current: ReturnType<typeof parseObjectiveQuestion>; question: number; answers: Record<number, ObjectiveAnswer>; setAnswers: React.Dispatch<React.SetStateAction<Record<number, ObjectiveAnswer>>> }) {
  const value = answers[question];
  const selected = Array.isArray(value) ? value : [];
  const choose = (index: number) => setAnswers((old) => ({ ...old, [question]: current.questionType === "multiple_choice" ? (selected.includes(index) ? selected.filter((item) => item !== index) : [...selected, index]) : index }));
  return <div className="space-y-4">
    {current.attachmentUrl && <img src={current.attachmentUrl} alt={current.attachmentFileName || "Question illustration"} className="max-h-80 max-w-full rounded border border-slate-200 object-contain" />}
    {current.questionType === "text_input" || current.questionType === "numerical" ? <Input value={typeof value === "string" ? value : ""} onChange={(event) => setAnswers((old) => ({ ...old, [question]: event.target.value }))} inputMode={current.questionType === "numerical" ? "decimal" : "text"} placeholder={current.questionType === "numerical" ? "Enter a number" : "Enter your answer"} className="h-10 max-w-xl rounded-none border-slate-400 bg-white text-[#18212b] placeholder:text-slate-400" /> : current.questionType === "dropdown" ? <select value={typeof value === "number" ? value : ""} onChange={(event) => setAnswers((old) => ({ ...old, [question]: Number(event.target.value) }))} className="h-10 w-full max-w-xl rounded-none border border-slate-400 bg-white px-3 text-sm text-[#18212b]"><option value="">Select an answer</option>{current.options.map((option, index) => <option key={option} value={index}>{option}</option>)}</select> : <div className="space-y-2">{current.options.map((option, index) => { const isSelected = current.questionType === "multiple_choice" ? selected.includes(index) : value === index; return <button type="button" key={option} onClick={() => choose(index)} className={`flex w-full max-w-xl items-center gap-3 rounded-none border-0 px-1 py-0.5 text-left text-sm leading-6 ${isSelected ? "font-semibold text-[#0877bd]" : "text-[#18212b] hover:text-[#0877bd]"}`}><span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border ${isSelected ? "border-[#0877bd]" : "border-slate-300"}`}>{isSelected && <span className="h-2 w-2 rounded-full bg-[#0877bd]" />}</span>{option}</button>; })}</div>}
  </div>;
}

function ResultPanel({ questions, answers, score, onReset, onReview }: { questions: ReturnType<typeof parseObjectiveQuestion>[]; answers: Record<number, ObjectiveAnswer>; score: number; onReset: () => void; onReview: () => void }) { return <div className="mt-7 rounded-xl border border-[#00ff88]/40 bg-[#102b36] p-5"><div className="text-2xl font-bold text-white">{score}/{questions.length} correct</div><p className="mt-1 text-sm text-[#c4b5fd]">Percentage: {questions.length ? Math.round((score / questions.length) * 100) : 0}%. Review the explanations below.</p><div className="mt-5 space-y-3">{questions.map((item, index) => <div key={index} className="rounded-lg border border-white/10 bg-[#18093c] p-4"><div className="flex items-center justify-between gap-3"><span className="font-bold text-white">Question {index + 1}</span><Badge className={objectiveAnswerMatches(answers[index], item.correct) ? "bg-[#102b36] text-[#00ff88]" : "bg-[#2f274e] text-[#00e5ff]"}>{objectiveAnswerMatches(answers[index], item.correct) ? "Correct" : "Review"}</Badge></div><p className="mt-2 text-sm text-[#c4b5fd]">{item.explanation}</p></div>)}</div><div className="mt-5 flex flex-wrap gap-2"><Button variant="outline" className="border-[#00e5ff] text-white" onClick={onReview}>Review answers</Button><Button className="aft-button" onClick={onReset}><RotateCcw className="mr-2 h-4 w-4" /> New test</Button></div></div>; }

function EmptyState() { return <Card className="mx-auto max-w-3xl border-[#00e5ff]/30 bg-[#120730]"><CardContent className="flex min-h-[360px] flex-col items-center justify-center p-10 text-center"><PackageOpen className="h-10 w-10 text-[#00e5ff]" /><h2 className="mt-5 text-2xl font-bold text-white">Objective test unavailable</h2><p className="mt-2 max-w-md text-[#c4b5fd]">No published Objective test is attached to this product yet. Please return to the store or contact an administrator.</p></CardContent></Card>; }
