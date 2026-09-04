import { useRef, useState } from "react";
import {
  Bold,
  BookOpen,
  Calculator,
  CreditCard,
  FileText,
  GraduationCap,
  ImageUp,
  Italic,
  Layers3,
  List,
  ListChecks,
  ListOrdered,
  Mail,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Sparkles,
  TimerReset,
  Trash2,
  Underline,
  UploadCloud,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type BundleFile = { fileName: string; mimeType: string; base64: string };

type AttachSlotProps = {
  label: string;
  icon: React.ReactNode;
  hint: string;
  accept: string;
  value: BundleFile | null;
  onChange: (file: BundleFile | null) => void;
  note?: string;
};

function AttachSlot({ label, icon, hint, accept, value, onChange, note }: AttachSlotProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="rounded-xl border border-white/10 bg-[#18093c]/60 p-4">
      <div className="flex items-center gap-2 font-bold text-white">{icon} <span>{label}</span></div>
      <p className="mt-1 text-xs leading-5 text-[#c4b5fd]">{hint}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" className="h-9 border-[#00e5ff] px-3 text-xs text-[#00e5ff]" onClick={() => fileRef.current?.click()}>
          <UploadCloud className="mr-1 h-3.5 w-3.5" /> Choose file
        </Button>
        <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => onChange({ fileName: file.name, mimeType: file.type, base64: String(reader.result) });
          reader.readAsDataURL(file);
        }} />
        {value && (
          <>
            <span className="inline-flex max-w-full items-center gap-1 truncate rounded-lg bg-[#102b36] px-2 py-1 text-xs text-[#00ff88]">
              <FileText className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{value.fileName}</span>
            </span>
            <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-[#ff8278]" onClick={() => onChange(null)}>
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </Button>
          </>
        )}
      </div>
      {note && <p className="mt-2 text-[11px] leading-5 text-white/40">{note}</p>}
    </div>
  );
}

function readFile(file: File): Promise<BundleFile | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ fileName: file.name, mimeType: file.type, base64: String(reader.result) });
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

const emailStyle = "border-white/10 bg-[#0c0524] text-white";

function RichTextEditor({ value, onChange, placeholder }: { value: string; onChange: (html: string) => void; placeholder?: string }) {
  const editorRef = useRef<HTMLDivElement>(null);

  const exec = (command: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(command, false);
    onChange(editor.innerHTML);
  };

  const onInput = () => {
    const editor = editorRef.current;
    if (editor) onChange(editor.innerHTML);
  };

  const toolButton = "inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-[#0c0524] text-white/80 transition hover:border-[#00ff88]/50 hover:text-[#00ff88]";

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0c0524]">
      <div className="flex flex-wrap items-center gap-1 border-b border-white/10 bg-[#18093c]/60 px-2 py-1.5">
        <button type="button" className={toolButton} onMouseDown={(event) => event.preventDefault()} onClick={() => exec("bold")} title="Bold" aria-label="Bold"><Bold className="h-4 w-4" /></button>
        <button type="button" className={toolButton} onMouseDown={(event) => event.preventDefault()} onClick={() => exec("italic")} title="Italic" aria-label="Italic"><Italic className="h-4 w-4" /></button>
        <button type="button" className={toolButton} onMouseDown={(event) => event.preventDefault()} onClick={() => exec("underline")} title="Underline" aria-label="Underline"><Underline className="h-4 w-4" /></button>
        <span className="mx-1 h-5 w-px bg-white/10" />
        <button type="button" className={toolButton} onMouseDown={(event) => event.preventDefault()} onClick={() => exec("insertUnorderedList")} title="Bullet list" aria-label="Bullet list"><List className="h-4 w-4" /></button>
        <button type="button" className={toolButton} onMouseDown={(event) => event.preventDefault()} onClick={() => exec("insertOrderedList")} title="Numbered list" aria-label="Numbered list"><ListOrdered className="h-4 w-4" /></button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={onInput}
        data-placeholder={placeholder}
        className="email-editor min-h-40 cursor-text px-3 py-2 text-sm leading-6 text-white outline-none [&:empty:before]:content-[attr(data-placeholder)] [&:empty:before]:text-white/30"
        dangerouslySetInnerHTML={{ __html: value }}
      />
      <style>{`.email-editor ul{list-style:disc;padding-left:1.5rem;margin:0.25rem 0;} .email-editor ol{list-style:decimal;padding-left:1.5rem;margin:0.25rem 0;}`}</style>
    </div>
  );
}

type QuestionDraft = {
  topic: string;
  prompt: string;
  questionType: "single_choice" | "multiple_choice" | "dropdown" | "numerical" | "text_input";
  options: string;
  correct: string;
  explanation: string;
  rationale: string;
  attachment: BundleFile | null;
};

const emptyQuestion = (): QuestionDraft => ({
  topic: "",
  prompt: "",
  questionType: "single_choice",
  options: "",
  correct: "0",
  explanation: "",
  rationale: "",
  attachment: null,
});

function QuestionEditor({ question, index, onChange, onRemove }: { question: QuestionDraft; index: number; onChange: (question: QuestionDraft) => void; onRemove: () => void }) {
  const set = (patch: Partial<QuestionDraft>) => onChange({ ...question, ...patch });
  return (
    <div className="space-y-3 rounded-xl border border-[#00e5ff]/30 bg-[#18093c]/50 p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#f4c44e]"><ListChecks className="h-4 w-4" /> Question {index + 1}</span>
        <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-[#ff8278]" onClick={onRemove} disabled={index === 0}><Trash2 className="h-3.5 w-3.5" /> Remove</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_0.7fr_1fr]">
        <div>
          <label className="text-xs font-semibold text-[#c4b5fd]">Topic</label>
          <Input value={question.topic} onChange={(event) => set({ topic: event.target.value })} placeholder="e.g. Financial statements" className="mt-1 border-white/10 bg-[#0c0524] text-white" aria-label={`Topic for question ${index + 1}`} />
        </div>
        <div>
          <label className="text-xs font-semibold text-[#c4b5fd]">Question type</label>
          <select value={question.questionType} onChange={(event) => set({ questionType: event.target.value as QuestionDraft["questionType"] })} className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-[#0c0524] px-3 text-sm text-white" aria-label={`Question type ${index + 1}`}>
            <option value="single_choice">Single choice</option>
            <option value="multiple_choice">Multiple choice</option>
            <option value="dropdown">Dropdown</option>
            <option value="numerical">Numerical input</option>
            <option value="text_input">Text input</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-[#c4b5fd]">Correct answer {question.questionType === "multiple_choice" ? "(comma-separated indices)" : "(option index / value)"}</label>
          <Input value={question.correct} onChange={(event) => set({ correct: event.target.value })} placeholder="0" className="mt-1 border-white/10 bg-[#0c0524] text-white" aria-label={`Correct answer ${index + 1}`} />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-[#c4b5fd]">Question</label>
        <Textarea value={question.prompt} onChange={(event) => set({ prompt: event.target.value })} placeholder="Type the question text…" className="mt-1 min-h-16 border-white/10 bg-[#0c0524] text-white" aria-label={`Question prompt ${index + 1}`} />
      </div>
      {question.questionType !== "numerical" && question.questionType !== "text_input" && (
        <>
          <div>
            <label className="text-xs font-semibold text-[#c4b5fd]">Options (one per line)</label>
            <Textarea value={question.options} onChange={(event) => set({ options: event.target.value })} placeholder="Option A&#10;Option B&#10;Option C&#10;Option D" className="mt-1 min-h-16 border-white/10 bg-[#0c0524] text-white" aria-label={`Options ${index + 1}`} />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#c4b5fd]">Feedback per option (optional, one per line, aligned with options — leave blank for none)</label>
            <Textarea value={question.rationale} onChange={(event) => set({ rationale: event.target.value })} placeholder="Why each option is correct or wrong…" className="mt-1 min-h-14 border-[#f4c44e]/30 bg-[#0c0524] text-white" aria-label={`Feedback ${index + 1}`} />
          </div>
        </>
      )}
      <div>
        <label className="text-xs font-semibold text-[#c4b5fd]">Feedback on the answer (explanation shown after answering)</label>
        <Textarea value={question.explanation} onChange={(event) => set({ explanation: event.target.value })} placeholder="Explain the correct answer…" className="mt-1 min-h-14 border-white/10 bg-[#0c0524] text-white" aria-label={`Explanation ${index + 1}`} />
      </div>
      <AttachSlot label="Question attachment (image)" icon={<ImageUp className="h-4 w-4 text-[#00e5ff]" />} hint="Optional PNG, JPEG, WebP or GIF image for the question." accept="image/png,image/jpeg,image/webp,image/gif" value={question.attachment} onChange={(file) => set({ attachment: file })} note="Image only, up to 10 MB." />
    </div>
  );
}

type SectionDraft = {
  title: string;
  duration: string;
  introduction: string;
  scenario: string;
  question: string;
};

const emptySection = (number: number): SectionDraft => ({
  title: `Task ${number}`,
  duration: "45",
  introduction: "",
  scenario: "",
  question: "",
});

function SectionEditor({ section, index, onChange, onRemove }: { section: SectionDraft; index: number; onChange: (section: SectionDraft) => void; onRemove: () => void }) {
  const set = (patch: Partial<SectionDraft>) => onChange({ ...section, ...patch });
  return (
    <div className="space-y-3 rounded-xl border border-[#f4c44e]/30 bg-[#18093c]/50 p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#00ff88]"><Layers3 className="h-4 w-4" /> Task {index + 1}</span>
        <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-[#ff8278]" onClick={onRemove} disabled={index === 0}><Trash2 className="h-3.5 w-3.5" /> Remove</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-[1.6fr_0.7fr]">
        <div>
          <label className="text-xs font-semibold text-[#c4b5fd]">Section title</label>
          <Input value={section.title} onChange={(event) => set({ title: event.target.value })} placeholder="e.g. Task 1 — Risks and negotiations" className="mt-1 border-white/10 bg-[#0c0524] text-white" aria-label={`Section title ${index + 1}`} />
        </div>
        <div>
          <label className="text-xs font-semibold text-[#c4b5fd]">Duration (minutes)</label>
          <Input type="number" min="1" value={section.duration} onChange={(event) => set({ duration: event.target.value })} placeholder="45" className="mt-1 border-white/10 bg-[#0c0524] text-white" aria-label={`Section duration ${index + 1}`} />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-[#c4b5fd]">Introduction / instructions</label>
        <Textarea value={section.introduction} onChange={(event) => set({ introduction: event.target.value })} placeholder="Brief for this task — weighting, instructions, what candidates must do…" className="mt-1 min-h-16 border-white/10 bg-[#0c0524] text-white" aria-label={`Section introduction ${index + 1}`} />
      </div>
      <div>
        <label className="text-xs font-semibold text-[#c4b5fd]">Scenario (optional)</label>
        <Textarea value={section.scenario} onChange={(event) => set({ scenario: event.target.value })} placeholder="Case scenario / advance information specific to this task…" className="mt-1 min-h-16 border-white/10 bg-[#0c0524] text-white" aria-label={`Section scenario ${index + 1}`} />
      </div>
      <div>
        <label className="text-xs font-semibold text-[#c4b5fd]">Task / question</label>
        <Textarea value={section.question} onChange={(event) => set({ question: event.target.value })} placeholder="The task candidates must answer…" className="mt-1 min-h-16 border-white/10 bg-[#0c0524] text-white" aria-label={`Section question ${index + 1}`} />
      </div>
    </div>
  );
}

function ExamPreviewDraft({ onClose, isCaseStudy, title, intro, description, examType, duration, price, accessDays, emailFrom, emailTo, emailSubject, emailText, sections, feedbackText, questions }: {
  onClose: () => void;
  isCaseStudy: boolean;
  title: string;
  intro: string;
  description: string;
  examType: string;
  duration: string;
  price: string;
  accessDays: string;
  emailFrom: string;
  emailTo: string;
  emailSubject: string;
  emailText: string;
  sections: SectionDraft[];
  feedbackText: string;
  questions: QuestionDraft[];
}) {
  const sortedSections = [...sections].filter((section) => section.title.trim());
  const sortedQuestions = questions.filter((question) => question.prompt.trim());
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#120730]/85 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-auto my-8 w-full max-w-4xl rounded-2xl border border-white/10 bg-[#0c0524] p-6 sm:p-8" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="eyebrow">Exam preview · {examType === "case_study" ? "Case study" : "Objective test"}</p>
            <h2 className="mt-2 text-3xl font-black text-white">{title || "Untitled exam"}</h2>
            <p className="mt-1 text-sm text-white/45">Preview shows your draft exactly as learners will see it once published.</p>
          </div>
          <Button variant="outline" className="border-[#00ff88] text-[#00ff88]" onClick={onClose}>Close preview</Button>
        </div>

        <div className="mt-6 space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-[#18093c]/50 p-4"><div className="text-[11px] font-bold uppercase tracking-wider text-white/45">Exam type</div><div className="mt-1 font-bold text-white capitalize">{examType.replace("_", " ")}</div></div>
            <div className="rounded-xl border border-white/10 bg-[#18093c]/50 p-4"><div className="text-[11px] font-bold uppercase tracking-wider text-white/45">Duration</div><div className="mt-1 font-bold text-white">{duration} minutes</div></div>
            <div className="rounded-xl border border-white/10 bg-[#18093c]/50 p-4"><div className="text-[11px] font-bold uppercase tracking-wider text-white/45">Price</div><div className="mt-1 font-bold text-white">R{(Number(price || 0)).toFixed(0)}</div></div>
            <div className="rounded-xl border border-white/10 bg-[#18093c]/50 p-4"><div className="text-[11px] font-bold uppercase tracking-wider text-white/45">Access</div><div className="mt-1 font-bold text-white">{accessDays} days</div></div>
          </div>

          {intro && <section><h3 className="mb-2 text-sm font-bold uppercase tracking-[.14em] text-[#00ff88]">Introduction</h3><p className="whitespace-pre-wrap leading-7 text-[#c4b5fd]">{intro}</p></section>}
          {description && <section><h3 className="mb-2 text-sm font-bold uppercase tracking-[.14em] text-[#00ff88]">Store description</h3><p className="whitespace-pre-wrap leading-7 text-[#c4b5fd]">{description}</p></section>}

          {isCaseStudy && (emailFrom || emailTo || emailSubject || emailText) && (
            <section>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-[.14em] text-[#00ff88]">Email attachment</h3>
              <div className="overflow-hidden rounded-xl border border-white/10">
                <div className="grid gap-px bg-white/10 sm:grid-cols-2">
                  <div className="bg-[#0c0524] px-4 py-2 text-sm text-[#c4b5fd]"><span className="text-white/45">From:</span> {emailFrom || "—"}</div>
                  <div className="bg-[#0c0524] px-4 py-2 text-sm text-[#c4b5fd]"><span className="text-white/45">To:</span> {emailTo || "—"}</div>
                </div>
                <div className="border-t border-white/10 bg-[#0c0524] px-4 py-2 text-sm font-semibold text-white">Subject: {emailSubject || "—"}</div>
                <div className="border-t border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-6 text-[#c4b5fd]" dangerouslySetInnerHTML={{ __html: emailText }} />
              </div>
            </section>
          )}

          {isCaseStudy && sortedSections.length > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-[.14em] text-[#00ff88]">Sections / tasks ({sortedSections.length})</h3>
              <div className="space-y-3">
                {sortedSections.map((section, index) => (
                  <div key={index} className="rounded-xl border border-white/10 bg-[#18093c]/50 p-4">
                    <div className="flex items-center justify-between gap-3"><span className="font-bold text-white">{section.title || `Task ${index + 1}`}</span><Badge className="bg-[#102b36] text-[#00ff88]">{section.duration || "45"} min</Badge></div>
                    {section.introduction && <p className="mt-3 text-sm leading-6 text-[#c4b5fd]"><span className="font-semibold text-white/70">Introduction: </span>{section.introduction}</p>}
                    {section.scenario && <p className="mt-2 text-sm leading-6 text-[#c4b5fd]"><span className="font-semibold text-white/70">Scenario: </span>{section.scenario}</p>}
                    {section.question && <p className="mt-2 text-sm leading-6 text-[#c4b5fd]"><span className="font-semibold text-white/70">Question: </span>{section.question}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {!isCaseStudy && sortedQuestions.length > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-[.14em] text-[#00ff88]">Questions ({sortedQuestions.length})</h3>
              <div className="space-y-3">
                {sortedQuestions.map((question, index) => {
                  const qtype = question.questionType;
                  const needsOptions = qtype !== "numerical" && qtype !== "text_input";
                  const options = question.options.split("\n").map((line) => line.trim()).filter(Boolean);
                  return (
                    <div key={index} className="rounded-xl border border-white/10 bg-[#18093c]/50 p-4">
                      <div className="flex items-center justify-between gap-3"><span className="font-bold text-white">Q{index + 1} · {question.topic || "General"}</span><Badge className="bg-[#102b36] text-[#00e5ff]">{qtype.replace("_", " ")}</Badge></div>
                      <p className="mt-3 text-sm leading-6 text-[#c4b5fd]">{question.prompt}</p>
                      {needsOptions && options.length > 0 && (
                        <ul className="mt-3 space-y-1">{options.map((option, optionIndex) => <li key={optionIndex} className="rounded-lg bg-[#0c0524] px-3 py-2 text-sm text-[#c4b5fd]">{String.fromCharCode(65 + optionIndex)}. {option}</li>)}</ul>
                      )}
                      <p className="mt-3 text-xs text-[#00ff88]">Correct: {question.correct}</p>
                      {question.explanation && <p className="mt-2 text-sm leading-6 text-[#c4b5fd]"><span className="font-semibold text-white/70">Explanation: </span>{question.explanation}</p>}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {isCaseStudy && feedbackText && (
            <section><h3 className="mb-2 text-sm font-bold uppercase tracking-[.14em] text-[#00ff88]">Feedback / solutions</h3><p className="whitespace-pre-wrap leading-7 text-[#c4b5fd]">{feedbackText}</p></section>
          )}

          {!isCaseStudy && sortedQuestions.length === 0 && <p className="text-sm text-white/45">No questions added yet.</p>}
          {isCaseStudy && sortedSections.length === 0 && <p className="text-sm text-white/45">No sections added yet.</p>}
        </div>

        <div className="mt-8 flex justify-end border-t border-white/10 pt-5">
          <Button className="aft-button" onClick={onClose}>Close preview</Button>
        </div>
      </div>
    </div>
  );
}

export default function ExamStudio({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [examType, setExamType] = useState<"case_study" | "objective_test">("case_study");
  const [duration, setDuration] = useState("45");
  const [intro, setIntro] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("199");
  const [accessDays, setAccessDays] = useState("30");
  const [featuredImage, setFeaturedImage] = useState<BundleFile | null>(null);
  const [featuredImageUrl, setFeaturedImageUrl] = useState("");
  const [preModeratedPdf, setPreModeratedPdf] = useState<BundleFile | null>(null);
  const [emailFrom, setEmailFrom] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailText, setEmailText] = useState("");
  const [emailImage, setEmailImage] = useState<BundleFile | null>(null);
  const [reference, setReference] = useState<BundleFile | null>(null);
  const [preSeen, setPreSeen] = useState<BundleFile | null>(null);
  const [formulae, setFormulae] = useState<BundleFile | null>(null);
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion()]);
  const [sections, setSections] = useState<SectionDraft[]>([emptySection(1)]);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackFile, setFeedbackFile] = useState<BundleFile | null>(null);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const createBundle = trpc.admin.createExamBundle.useMutation({
    onSuccess: (result) => {
      toast.success("Exam created as draft");
      setCreatedId(result.mockExamId);
      onCreated();
    },
    onError: (error) => toast.error(error.message),
  });

  const isCaseStudy = examType === "case_study";

  const switchExamType = (next: "case_study" | "objective_test") => {
    if (next === examType) return;
    setExamType(next);
    // route cleanly between the two modules: clear the other module's fields
    if (next === "case_study") {
      setQuestions([emptyQuestion()]);
    } else {
      setEmailFrom("");
      setEmailTo("");
      setEmailSubject("");
      setEmailText("");
      setEmailImage(null);
      setSections([emptySection(1)]);
      setFeedbackText("");
      setFeedbackFile(null);
    }
  };

  const reset = () => {
    setTitle("");
    setExamType("case_study");
    setDuration("45");
    setIntro("");
    setDescription("");
    setPrice("199");
    setAccessDays("30");
    setFeaturedImage(null);
    setFeaturedImageUrl("");
    setPreModeratedPdf(null);
    setEmailFrom("");
    setEmailTo("");
    setEmailSubject("");
    setEmailText("");
    setEmailImage(null);
    setReference(null);
    setPreSeen(null);
    setFormulae(null);
    setQuestions([emptyQuestion()]);
    setSections([emptySection(1)]);
    setFeedbackText("");
    setFeedbackFile(null);
    setCreatedId(null);
  };

  const parsePurposeQuestion = (question: QuestionDraft) => {
    const options = question.options.split("\n").map((line) => line.trim()).filter(Boolean);
    const needsOptions = question.questionType !== "numerical" && question.questionType !== "text_input";
    const correctRaw = question.correct.trim();
    const qtype = question.questionType;
    let correctValue = 0;
    if (qtype === "multiple_choice") {
      correctValue = 0;
    } else if (needsOptions) {
      correctValue = Math.max(0, Number(correctRaw.split(",")[0]) || 0);
    } else {
      correctValue = Number(correctRaw) || 0;
    }
    let rationale: string[] = [];
    if (needsOptions) {
      rationale = question.rationale.split("\n").map((line) => line.trim());
      while (rationale.length < options.length) rationale.push("");
    }
    return {
      topic: question.topic.trim() || "General",
      prompt: question.prompt.trim(),
      questionType: question.questionType,
      options,
      correct: correctValue,
      explanation: question.explanation.trim() || undefined,
      rationale: needsOptions ? rationale.slice(0, options.length) : undefined,
      attachment: question.attachment ?? undefined,
    };
  };

  const submit = async () => {
    if (!title.trim()) return toast.error("Enter an exam title");
    if (createBundle.isPending) return;
    const bundleQuestions =
      examType === "objective_test"
        ? questions
            .map(parsePurposeQuestion)
            .filter((question) => question.prompt && (question.questionType === "numerical" || question.questionType === "text_input" || question.options.length >= 2))
        : undefined;
    if (examType === "objective_test" && bundleQuestions && bundleQuestions.length === 0) {
      return toast.error("Add at least one objective question with a prompt and options");
    }
    const bundleSections =
      examType === "case_study"
        ? sections
            .map((section, index) => ({
              sectionNumber: index + 1,
              title: section.title.trim() || `Task ${index + 1}`,
              introduction: section.introduction.trim() || undefined,
              scenario: section.scenario.trim() || undefined,
              question: section.question.trim() || undefined,
              durationSeconds: Math.max(60, Math.round(Number(section.duration || 45) * 60)),
            }))
            .filter((section) => section.title.trim())
        : undefined;
    if (examType === "case_study" && bundleSections && bundleSections.length === 0) {
      return toast.error("Add at least one case-study section (task)");
    }
    const payload: Parameters<typeof createBundle.mutate>[0] = {
      title: title.trim(),
      examType,
      intro: intro.trim() || undefined,
      description: description.trim() || undefined,
      priceCents: Math.max(0, Math.round(Number(price || 0) * 100)),
      accessDays: Math.max(1, Number(accessDays) || 30),
      totalDurationSeconds: Math.max(60, Math.round(Number(duration || 45) * 60)),
      featuredImageUrl: featuredImageUrl.trim() || undefined,
      featuredImage: featuredImage ?? undefined,
      preModeratedPdf: preModeratedPdf ?? undefined,
      preSeen: preSeen ?? undefined,
      formulae: formulae ?? undefined,
      reference: reference ?? undefined,
      emailFrom: examType === "case_study" && emailFrom.trim() ? emailFrom.trim() : undefined,
      emailTo: examType === "case_study" && emailTo.trim() ? emailTo.trim() : undefined,
      emailSubject: examType === "case_study" && emailSubject.trim() ? emailSubject.trim() : undefined,
      emailText: examType === "case_study" ? emailText.trim() || undefined : undefined,
      emailImage: examType === "case_study" ? emailImage ?? undefined : undefined,
      caseStudySections: bundleSections,
      feedbackText: examType === "case_study" ? feedbackText.trim() || undefined : undefined,
      feedbackFile: examType === "case_study" ? feedbackFile ?? undefined : undefined,
      objectiveQuestions: bundleQuestions,
    };
    createBundle.mutate(payload);
  };

  return (
    <div className="space-y-6">
      <Card className="mt-6 border-[#00e5ff]/30 bg-[#120730]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white"><GraduationCap className="h-5 w-5 text-[#00ff88]" /> Create an exam</CardTitle>
          <p className="text-sm leading-6 text-white/50">Create a case study or objective test together with its store listing, pricing, subscription period, featured image, and protected resources — all in one place. New exams are saved as drafts until an administrator publishes them.</p>
        </CardHeader>
        <CardContent className="space-y-7">
          {/* Exam details */}
          <section>
            <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[.14em] text-[#00ff88]"><Sparkles className="h-4 w-4" /> Exam details</div>
            <div className="grid gap-3 md:grid-cols-[1.4fr_0.7fr_0.7fr]">
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Exam title" className="border-white/10 bg-[#0c0524] text-white" aria-label="Exam title" />
              <select value={examType} onChange={(event) => switchExamType(event.target.value as typeof examType)} className="h-10 rounded-lg border border-white/10 bg-[#0c0524] px-3 text-sm text-white" aria-label="Exam type">
                <option value="case_study">Case study</option>
                <option value="objective_test">Objective test</option>
              </select>
              <div className="relative">
                <TimerReset className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <Input type="number" min="1" value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="Minutes" className="border-white/10 bg-[#0c0524] pl-9 text-white" aria-label="Time (minutes)" />
              </div>
            </div>
            <Textarea value={intro} onChange={(event) => setIntro(event.target.value)} placeholder="Exam introduction / instructions" className="mt-3 min-h-20 border-white/10 bg-[#0c0524] text-white" />
          </section>

          {/* Active module banner - switches when the exam type changes */}
          <div className={`flex items-center gap-3 rounded-xl border p-4 ${isCaseStudy ? "border-[#00ff88]/40 bg-[#102b36]/50" : "border-[#f4c44e]/40 bg-[#2b2410]/50"}`}>
            <ListChecks className={`h-6 w-6 shrink-0 ${isCaseStudy ? "text-[#00ff88]" : "text-[#f4c44e]"}`} />
            <div>
              <p className={`text-sm font-bold ${isCaseStudy ? "text-[#00ff88]" : "text-[#f4c44e]"}`}>{isCaseStudy ? "Case study module" : "Objective test module"}</p>
              <p className="mt-0.5 text-xs leading-5 text-white/55">
                {isCaseStudy
                  ? "Build a case-study exam with its email brief and pre-seen/supporting resources below."
                  : "Build an objective test with topics, questions, answers, question types, attachments, and feedback below."}
              </p>
            </div>
          </div>

          {/* Store & pricing */}
          <section>
            <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[.14em] text-[#00ff88]"><Package className="h-4 w-4" /> Store listing, price & subscription</div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-[#c4b5fd]">Price (ZAR)</label>
                <Input type="number" min="0" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="0" className="mt-1 border-white/10 bg-[#0c0524] text-white" aria-label="Price" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#c4b5fd]">Subscription duration (days)</label>
                <Input type="number" min="1" max="3650" value={accessDays} onChange={(event) => setAccessDays(event.target.value)} placeholder="30" className="mt-1 border-white/10 bg-[#0c0524] text-white" aria-label="Access days" />
              </div>
            </div>
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Product description shown on the store" className="mt-3 min-h-16 border-white/10 bg-[#0c0524] text-white" />
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold text-white"><ImageUp className="h-4 w-4 text-[#00e5ff]" /> Featured image</span>
                {(featuredImage || featuredImageUrl) && (
                  <div className="flex items-center gap-2">
                    <img src={featuredImage ? featuredImage.base64 : featuredImageUrl} alt="Featured preview" className="h-14 w-24 rounded-lg object-cover" />
                    <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-[#ff8278]" onClick={() => { setFeaturedImage(null); setFeaturedImageUrl(""); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                )}
              </div>
              <div className="grid gap-2 md:grid-cols-[auto_1fr]">
                <Button type="button" size="sm" variant="outline" className="h-10 border-[#00e5ff] px-4 text-xs text-[#00e5ff]" onClick={async () => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/png,image/jpeg";
                  input.onchange = async () => {
                    const file = input.files?.[0];
                    if (!file) return;
                    if (file.type !== "image/png" && file.type !== "image/jpeg") return toast.error("Featured image must be a PNG or JPEG");
                    const data = await readFile(file);
                    if (data) { setFeaturedImage(data); setFeaturedImageUrl(""); }
                  };
                  input.click();
                }}><UploadCloud className="mr-1 h-3.5 w-3.5" /> Upload image (PNG/JPEG)</Button>
                <Input value={featuredImageUrl} onChange={(event) => { setFeaturedImageUrl(event.target.value); if (event.target.value) setFeaturedImage(null); }} placeholder="Or paste an image URL (https://…)" className="border-white/10 bg-[#0c0524] text-white" />
              </div>
            </div>
          </section>

          {/* Pre-moderated PDF / document (source of truth) */}
          <section>
            <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[.14em] text-[#00ff88]"><FileText className="h-4 w-4" /> Pre-moderated exam paper (PDF or document, optional)</div>
            <div className="rounded-xl border border-[#00e5ff]/30 bg-[#102b36]/40 p-4">
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[#00ff88]" />
                <div className="text-sm leading-6 text-[#c4b5fd]">
                  <p className="font-semibold text-white">Upload an already-formatting exam paper as a PDF or a Word/OpenDocument file.</p>
                  <p className="mt-1">If you provide a file, it is stored as the protected printable question paper and used as the source of truth for the exam.</p>
                  <div className="mt-2 rounded-lg border border-white/10 bg-[#0c0524]/60 p-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-white/70">How to format your paper</p>
                    <ul className="mt-1 list-inside list-disc space-y-1 text-xs leading-5 text-[#c4b5fd]">
                      <li>Use a single PDF or document, landscape or portrait, clearly named.</li>
                      <li>Start with the exam title, exam type, and total time on the first page.</li>
                      <li>For case studies, add the pre-seen scenario and each section's task in order.</li>
                      <li>For objective tests, add each question, its options, and any required formulae tables.</li>
                      <li>Keep file size under 20 MB.</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <AttachSlot label="Pre-moderated paper" icon={<FileText className="h-4 w-4 text-[#00e5ff]" />} hint={isCaseStudy ? "Optional PDF of the exam paper." : "Attach the exam as a PDF or document."} accept={isCaseStudy ? ".pdf" : ".pdf,.doc,.docx,.odt,.txt"} value={preModeratedPdf} onChange={setPreModeratedPdf} note={isCaseStudy ? "PDF only, up to 20 MB." : "PDF or document, up to 20 MB."} />
              </div>
              {isCaseStudy && !preModeratedPdf && (
                <p className="mt-2 flex items-center gap-2 rounded-lg bg-[#102b36] px-3 py-2 text-xs text-[#00ff88]"><Sparkles className="h-4 w-4" /> No PDF provided — we'll auto-generate a branded AFT printable PDF for this case-study exam.</p>
              )}
            </div>
          </section>

          {/* Conditional body: case-study → email attachment; objective test → question builder */}
          {isCaseStudy ? (
            <>
              <section>
                <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[.14em] text-[#00ff88]"><Mail className="h-4 w-4" /> Email attachment · case study</div>
                <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-[#18093c]/60">
                    <div className="grid gap-px bg-white/10 lg:grid-cols-2">
                      <label className="flex items-center gap-2 bg-[#0c0524] px-3">
                        <span className="w-12 shrink-0 text-xs font-semibold text-[#c4b5fd]">From</span>
                        <Input value={emailFrom} onChange={(event) => setEmailFrom(event.target.value)} placeholder="sender@accountantstomorrow.co.za" className={emailStyle} aria-label="Email from" />
                      </label>
                      <label className="flex items-center gap-2 bg-[#0c0524] px-3">
                        <span className="w-12 shrink-0 text-xs font-semibold text-[#c4b5fd]">To</span>
                        <Input value={emailTo} onChange={(event) => setEmailTo(event.target.value)} placeholder="learner@example.com" className={emailStyle} aria-label="Email to" />
                      </label>
                    </div>
                    <div className="border-t border-white/10">
                      <label className="flex items-center gap-2 bg-[#0c0524] px-3 py-2">
                        <span className="w-12 shrink-0 text-xs font-semibold text-[#c4b5fd]">Subject</span>
                        <Input value={emailSubject} onChange={(event) => setEmailSubject(event.target.value)} placeholder="e.g. Advance information for your case-study task" className="h-9 border-none bg-transparent px-0 text-white shadow-none" aria-label="Email subject" />
                      </label>
                    </div>
                    <div className="border-t border-white/10">
                      <p className="bg-[#0c0524] px-3 pt-2 text-xs font-semibold text-[#c4b5fd]">Message</p>
                      <div className="bg-[#0c0524] p-2">
                        <RichTextEditor value={emailText} onChange={setEmailText} placeholder="Type or paste the email message. Use the toolbar to format — bold, italic, underline, bullet and numbered lists…" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-white">Or attach an email image</p>
                    <AttachSlot label="Email image" icon={<ImageUp className="h-4 w-4 text-[#00e5ff]" />} hint="A PNG or JPEG screenshot of the email." accept="image/png,image/jpeg" value={emailImage} onChange={setEmailImage} note="PNG / JPEG only, up to 10 MB." />
                    <p className="rounded-lg border border-white/10 bg-[#18093c]/40 px-3 py-2 text-xs leading-5 text-white/45">
                      Compose the email exactly as learners would receive it. The From, To, Subject and Message are saved with the exam bundle.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[.14em] text-[#00ff88]"><Layers3 className="h-4 w-4" /> Sections / tasks & timing</div>
                <p className="mb-3 text-xs leading-5 text-white/50">
                  Add each case-study task in order. Each section has its own title, time limit, instructions, optional scenario and task wording (like the example Cartn Mock Exams with four 45-minute tasks).
                </p>
                <div className="space-y-4">
                  {sections.map((section, index) => (
                    <SectionEditor
                      key={index}
                      section={section}
                      index={index}
                      onChange={(updated) => setSections((list) => list.map((s, i) => (i === index ? updated : s)))}
                      onRemove={() => setSections((list) => (list.length > 1 ? list.filter((_, i) => i !== index) : list))}
                    />
                  ))}
                </div>
                <Button type="button" variant="outline" className="mt-4 border-[#00e5ff] text-[#00e5ff]" onClick={() => setSections((list) => [...list, emptySection(list.length + 1)])}>
                  <Plus className="mr-2 h-4 w-4" /> Add section
                </Button>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[.14em] text-[#00ff88]"><FileText className="h-4 w-4" /> Exam feedback</div>
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-[#18093c]/60 p-4">
                    <p className="text-sm font-semibold text-white">Type the feedback / suggested solutions</p>
                    <Textarea value={feedbackText} onChange={(event) => setFeedbackText(event.target.value)} placeholder="Paste or type the marking guide / suggested solutions…" className="mt-2 min-h-28 border-white/10 bg-[#0c0524] text-white" />
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-white">Or attach a feedback document</p>
                    <AttachSlot label="Feedback document" icon={<FileText className="h-4 w-4 text-[#00e5ff]" />} hint="Suggested solutions / answers and marking guide." accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" value={feedbackFile} onChange={setFeedbackFile} note="PDF, document, PNG or JPG." />
                  </div>
                </div>
              </section>
            </>
          ) : (
            <section>
              <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[.14em] text-[#00ff88]"><ListChecks className="h-4 w-4" /> Objective test — questions by topic</div>
              <p className="mb-3 text-xs leading-5 text-white/50">
                Build the objective test's topics and questions. Each question can be single choice, multiple choice, dropdown, numerical or text input, with options, the correct answer, per-option feedback, and an explanation shown after answering. You can also attach an image to a question.
              </p>
              <div className="space-y-4">
                {questions.map((question, index) => (
                  <QuestionEditor
                    key={index}
                    question={question}
                    index={index}
                    onChange={(updated) => setQuestions((list) => list.map((q, i) => (i === index ? updated : q)))}
                    onRemove={() => setQuestions((list) => (list.length > 1 ? list.filter((_, i) => i !== index) : list))}
                  />
                ))}
              </div>
              <Button type="button" variant="outline" className="mt-4 border-[#00e5ff] text-[#00e5ff]" onClick={() => setQuestions((list) => [...list, emptyQuestion()])}>
                <Plus className="mr-2 h-4 w-4" /> Add question
              </Button>
            </section>
          )}

          {/* Resources for objective tests */}
          <section>
            <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[.14em] text-[#00ff88]"><Layers3 className="h-4 w-4" /> {isCaseStudy ? "Case study resources" : "Objective test resources"}</div>
            <div className="grid gap-3 md:grid-cols-3">
              <AttachSlot label="Pre-seen" icon={<BookOpen className="h-4 w-4 text-[#00e5ff]" />} hint="The scenario / advance information pdf." accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" value={preSeen} onChange={setPreSeen} note="Document, PDF, PNG or JPG." />
              <AttachSlot label="Formulae + tables" icon={<Calculator className="h-4 w-4 text-[#00e5ff]" />} hint="Formulae sheets and statistical tables." accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" value={formulae} onChange={setFormulae} note="Document, PDF, PNG or JPG." />
              <AttachSlot label="Reference material" icon={<MapPin className="h-4 w-4 text-[#00e5ff]" />} hint="Permitted reference documents." accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" value={reference} onChange={setReference} note="Document, PDF, PNG or JPG." />
            </div>
          </section>

          <Separator />

          <div className="flex flex-wrap items-center justify-end gap-3">
            {createdId && <Badge className="bg-[#102b36] text-[#00ff88]">Exam draft #{createdId} created</Badge>}
            <Button variant="outline" className="border-[#00e5ff] text-[#00e5ff]" onClick={() => setPreviewOpen(true)} disabled={!title.trim()}><Sparkles className="mr-2 h-4 w-4" /> Preview</Button>
            <Button variant="outline" className="border-white/15 text-white/70" onClick={reset} disabled={createBundle.isPending}><RefreshCw className="mr-2 h-4 w-4" /> Reset</Button>
            <Button className="aft-button" disabled={createBundle.isPending || !title.trim()} onClick={() => void submit()}>
              {createBundle.isPending ? "Creating…" : isCaseStudy ? "Create case study exam" : "Create objective test exam"} <CreditCard className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
      {previewOpen && (
        <ExamPreviewDraft
          onClose={() => setPreviewOpen(false)}
          isCaseStudy={isCaseStudy}
          title={title}
          intro={intro}
          description={description}
          examType={examType}
          duration={duration}
          price={price}
          accessDays={accessDays}
          emailFrom={emailFrom}
          emailTo={emailTo}
          emailSubject={emailSubject}
          emailText={emailText}
          sections={sections}
          feedbackText={feedbackText}
          questions={questions}
        />
      )}
    </div>
  );
}
