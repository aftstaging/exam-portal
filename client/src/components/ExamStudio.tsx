import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  BookOpen,
  Calculator,
  Clock3,
  CreditCard,
  FileText,
  GraduationCap,
  ImageUp,
  Italic,
  Layers3,
  List,
  ListChecks,
  ListOrdered,
  Loader2,
  Mail,
  MapPin,
  Menu,
  Package,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Trash2,
  Underline,
  UploadCloud,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { StructuredText } from "@/components/StructuredText";

type BundleFile = { fileName: string; mimeType: string; base64: string };
type ExistingFile = { fileName: string; keepUrl: string };
type EditableFile = BundleFile | ExistingFile | null;

type AttachSlotProps = {
  label: string;
  icon: React.ReactNode;
  hint: string;
  accept: string;
  value: EditableFile;
  onChange: (file: EditableFile) => void;
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

type ImportedPdfDraft = {
  fileName: string;
  isSolutionsDocument: boolean;
  title?: string;
  examType: "case_study" | "objective_test";
  intro?: string;
  description?: string;
  priceCents: number;
  accessDays: number;
  totalDurationSeconds: number;
  emailFrom?: string;
  emailTo?: string;
  emailSubject?: string;
  emailText?: string;
  preModeratedPdf?: BundleFile | null;
  preSeen?: BundleFile | null;
  formulae?: BundleFile | null;
  reference?: BundleFile | null;
  feedbackFile?: BundleFile | null;
  caseStudySections?: { sectionNumber: number; title: string; introduction?: string; scenario?: string; question?: string; durationSeconds: number; emailFrom?: string; emailTo?: string; emailSubject?: string; emailText?: string; emailImage?: EditableFile; reference?: EditableFile }[];
  objectiveQuestions?: { topic: string; prompt: string; options: string[]; correct: number; questionType: "single_choice" | "multiple_choice" | "dropdown" | "numerical" | "text_input"; explanation?: string; rationale?: string[] }[];
  notes: string[];
};

function PdfImportSlot({ label, icon, hint, busy, attached, onAttach, onRemove }: {
  label: string;
  icon: React.ReactNode;
  hint: string;
  busy?: boolean;
  attached?: string | null;
  onAttach: (file: File) => void;
  onRemove?: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="rounded-xl border border-[#00e5ff]/40 bg-[#18093c]/60 p-4">
      <div className="flex items-center gap-2 font-bold text-white">{icon} <span>{label}</span></div>
      <p className="mt-1 text-xs leading-5 text-[#c4b5fd]">{hint}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" className="h-9 border-[#00e5ff] px-3 text-xs text-[#00e5ff]" disabled={Boolean(busy)} onClick={() => fileRef.current?.click()}>
          {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="mr-1 h-3.5 w-3.5" />} {busy ? "Reading PDF…" : "Choose PDF"}
        </Button>
        <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          onAttach(file);
        }} />
        {attached && (
          <>
            <span className="inline-flex max-w-full items-center gap-1 truncate rounded-lg bg-[#102b36] px-2 py-1 text-xs text-[#00ff88]">
              <FileText className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{attached}</span>
            </span>
            {onRemove && (
              <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-[#ff8278]" onClick={onRemove}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
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

  const setHtml = useCallback(() => {
    const editor = editorRef.current;
    if (editor && editor.innerHTML !== value) editor.innerHTML = value;
  }, [value]);

  useEffect(() => {
    if (document.activeElement !== editorRef.current) setHtml();
  }, [setHtml]);

  const toolButton = "inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-[#0c0524] text-white/80 transition hover:border-[#00ff88]/50 hover:text-[#00ff88]";

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0c0524]">
      <div className="flex flex-wrap items-center gap-1 border-b border-white/10 bg-[#18093c]/60 px-2 py-1.5">
        <button type="button" className={toolButton} onMouseDown={(event) => event.preventDefault()} onClick={() => exec("bold")} title="Bold" aria-label="Bold"><Bold className="h-4 w-4" /></button>
        <button type="button" className={toolButton} onMouseDown={(event) => event.preventDefault()} onClick={() => exec("italic")} title="Italic" aria-label="Italic"><Italic className="h-4 w-4" /></button>
        <button type="button" className={toolButton} onMouseDown={(event) => event.preventDefault()} onClick={() => exec("underline")} title="Underline" aria-label="Underline"><Underline className="h-4 w-4" /></button>
        <span className="mx-1 h-5 w-px bg-white/10" />
        <button type="button" className={toolButton} onMouseDown={(event) => event.preventDefault()} onClick={() => exec("justifyLeft")} title="Align left" aria-label="Align left"><AlignLeft className="h-4 w-4" /></button>
        <button type="button" className={toolButton} onMouseDown={(event) => event.preventDefault()} onClick={() => exec("justifyCenter")} title="Align centre" aria-label="Align centre"><AlignCenter className="h-4 w-4" /></button>
        <button type="button" className={toolButton} onMouseDown={(event) => event.preventDefault()} onClick={() => exec("justifyRight")} title="Align right" aria-label="Align right"><AlignRight className="h-4 w-4" /></button>
        <button type="button" className={toolButton} onMouseDown={(event) => event.preventDefault()} onClick={() => exec("justifyFull")} title="Justify" aria-label="Justify"><AlignJustify className="h-4 w-4" /></button>
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
      />
      <style>{`.email-editor ul{list-style:disc;padding-left:1.5rem;margin:0.25rem 0;} .email-editor ol{list-style:decimal;padding-left:1.5rem;margin:0.25rem 0;} .email-editor p{margin:0.25rem 0;} .email-editor div[align="center"],.email-editor [style*="text-align:center"]{text-align:center;} .email-editor [style*="text-align:right"]{text-align:right;} .email-editor [style*="text-align:justify"]{text-align:justify;}`}</style>
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
  attachment: EditableFile;
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

function FormattingTextarea({ value, onChange, placeholder, label, className = "min-h-16", hint = "Formatting: **bold**, *italic*, ## heading, ● bullet (start a line with - or ●), 1. numbered." }: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label: string;
  className?: string;
  hint?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const applyFormat = (prefix: string, suffix = "") => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart, selectionEnd, value: current } = el;
    const selected = current.slice(selectionStart, selectionEnd);
    const wrapped = selected
      ? `${prefix}${selected}${suffix}`
      : `${prefix}${suffix ? "text" : "text"}${suffix}`;
    const next = current.slice(0, selectionStart) + wrapped + current.slice(selectionEnd);
    const cursor = selectionStart + prefix.length + (selected ? selected.length + suffix.length : (suffix ? suffix.length : 4));
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  };

  const toolButton = "inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-[#0c0524] text-white/80 transition hover:border-[#00ff88]/50 hover:text-[#00ff88]";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1">
        <label className="mr-1 text-xs font-semibold text-[#c4b5fd]">{label}</label>
        <button type="button" className={toolButton} title="Bold (**text**)" aria-label="Bold" onClick={() => applyFormat("**", "**")}><Bold className="h-4 w-4" /></button>
        <button type="button" className={toolButton} title="Italic (*text*)" aria-label="Italic" onClick={() => applyFormat("*", "*")}><Italic className="h-4 w-4" /></button>
        <button type="button" className={toolButton} title="Heading (## text)" aria-label="Heading" onClick={() => applyFormat("## ", "")}><Menu className="h-4 w-4" /></button>
        <button type="button" className={toolButton} title="Bullet list (● item)" aria-label="Bullet list" onClick={() => applyFormat("● ", "")}><List className="h-4 w-4" /></button>
        <button type="button" className={toolButton} title="Numbered list (1. item)" aria-label="Numbered list" onClick={() => applyFormat("1. ", "")}><ListOrdered className="h-4 w-4" /></button>
        <span className="ml-auto text-[10px] italic leading-4 text-white/35">{hint}</span>
      </div>
      <textarea ref={ref} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={`mt-1 w-full rounded-lg border border-white/10 bg-[#0c0524] text-white ${className}`} />
    </div>
  );
}

type SectionDraft = {
  title: string;
  duration: string;
  introduction: string;
  extraNotes: string;
  question: string;
  emailMode: "compose" | "file";
  emailFrom: string;
  emailTo: string;
  emailSubject: string;
  emailText: string;
  emailImage: EditableFile;
  reference: EditableFile;
};

const emptySection = (number: number): SectionDraft => ({
  title: `Task ${number}`,
  duration: "45",
  introduction: "",
  extraNotes: "",
  question: "",
  emailMode: "compose",
  emailFrom: "",
  emailTo: "",
  emailSubject: "",
  emailText: "",
  emailImage: null,
  reference: null,
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
        <FormattingTextarea label="Introduction / instructions" value={section.introduction} onChange={(value) => set({ introduction: value })} placeholder="Brief for this task — weighting, instructions, what candidates must do…" className="min-h-16" />
      </div>
      <div>
        <label className="text-xs font-semibold text-[#c4b5fd]">Extra notes (optional)</label>
        <Input value={section.extraNotes} onChange={(event) => set({ extraNotes: event.target.value })} placeholder="Advance information / notes specific to this task…" className="mt-1 border-white/10 bg-[#0c0524] text-white" aria-label={`Extra notes ${index + 1}`} />
      </div>
      <div>
        <FormattingTextarea label="Task / question" value={section.question} onChange={(value) => set({ question: value })} placeholder="The task candidates must answer…" className="min-h-16" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0c0524]/60">
        <div className="flex items-center justify-between border-b border-white/10 bg-[#102b36]/40 px-3 py-2">
          <span className="text-xs font-bold uppercase tracking-[.14em] text-[#00e5ff]">Task email attachment</span>
          <div className="flex items-center gap-1">
            <div className="flex rounded-lg border border-white/10 bg-[#0c0524] p-0.5">
              <button type="button" className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${section.emailMode === "compose" ? "bg-[#102b36] text-[#00ff88]" : "text-white/50 hover:text-white"}`} onClick={() => set({ emailMode: "compose" })}>Compose</button>
              <button type="button" className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${section.emailMode === "file" ? "bg-[#102b36] text-[#00ff88]" : "text-white/50 hover:text-white"}`} onClick={() => set({ emailMode: "file" })}>File (image / PDF)</button>
            </div>
            {(section.emailFrom || section.emailTo || section.emailSubject || section.emailText || section.emailImage) && (
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[#ff8278]" onClick={() => set({ emailMode: "compose", emailFrom: "", emailTo: "", emailSubject: "", emailText: "", emailImage: null })}><Trash2 className="h-3.5 w-3.5" /> Clear</Button>
            )}
          </div>
        </div>
        {section.emailMode === "compose" ? (
          <>
            <div className="grid gap-px bg-white/10 sm:grid-cols-2">
              <label className="flex items-center gap-2 bg-[#0c0524] px-3 py-2">
                <span className="w-11 shrink-0 text-[11px] font-semibold text-[#c4b5fd]">From</span>
                <Input value={section.emailFrom} onChange={(event) => set({ emailFrom: event.target.value })} placeholder="sender@accountantstomorrow.co.za" className={emailStyle} aria-label={`Email from ${index + 1}`} />
              </label>
              <label className="flex items-center gap-2 bg-[#0c0524] px-3 py-2">
                <span className="w-11 shrink-0 text-[11px] font-semibold text-[#c4b5fd]">To</span>
                <Input value={section.emailTo} onChange={(event) => set({ emailTo: event.target.value })} placeholder="learner@example.com" className={emailStyle} aria-label={`Email to ${index + 1}`} />
              </label>
            </div>
            <div className="border-t border-white/10">
              <label className="flex items-center gap-2 bg-[#0c0524] px-3 py-2">
                <span className="w-11 shrink-0 text-[11px] font-semibold text-[#c4b5fd]">Subject</span>
                <Input value={section.emailSubject} onChange={(event) => set({ emailSubject: event.target.value })} placeholder="e.g. Advance information for this task" className="h-9 border-none bg-transparent px-0 text-white shadow-none" aria-label={`Email subject ${index + 1}`} />
              </label>
            </div>
            <div className="border-t border-white/10">
              <p className="bg-[#0c0524] px-3 pt-2 text-[11px] font-semibold text-[#c4b5fd]">Message</p>
              <div className="bg-[#0c0524] p-2">
                <RichTextEditor value={section.emailText} onChange={(value) => set({ emailText: value })} placeholder="Type or paste the email message for this task…" />
              </div>
            </div>
          </>
        ) : (
          <div className="p-3">
            <AttachSlot label="Email attachment file" icon={<ImageUp className="h-4 w-4 text-[#00e5ff]" />} hint="Attach the email as an image or a PDF file for this task." accept=".pdf,application/pdf,image/png,image/jpeg,image/webp" value={section.emailImage} onChange={(file) => set({ emailImage: file })} note="PDF, PNG, JPEG or WebP, up to 10 MB." />
          </div>
        )}
      </div>
      <AttachSlot label="Reference material" icon={<MapPin className="h-4 w-4 text-[#00e5ff]" />} hint="Permitted reference documents specific to this task." accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" value={section.reference} onChange={(file) => set({ reference: file })} note="Document, PDF, PNG or JPG." />
      </div>
    </div>
  );
}

function ExamPreviewDraft({ onClose, isCaseStudy, title, intro, description, examType, duration, price, accessDays, sections, feedbackText, questions }: {
  onClose: () => void;
  isCaseStudy: boolean;
  title: string;
  intro: string;
  description: string;
  examType: string;
  duration: string;
  price: string;
  accessDays: string;
  sections: SectionDraft[];
  feedbackText: string;
  questions: QuestionDraft[];
}) {
  const sortedSections = [...sections].filter((section) => section.title.trim());
  const sortedQuestions = questions.filter((question) => question.prompt.trim());
  const minutes = Math.max(1, Number(duration) || 45);
  return (
    <div className="exam-shell fixed inset-0 z-50 overflow-y-auto bg-[#0c0524]" onClick={onClose}>
      <div className="min-h-full bg-[#0c0524]" onClick={(event) => event.stopPropagation()}>
        <div className="exam-topbar">
          <div className="exam-brand-tools">
            <span className="text-xs font-bold uppercase tracking-[.18em] text-[#00e5ff]">AFT · Learner-shell preview</span>
          </div>
          <button type="button" className="exam-top-action" onClick={onClose}><X className="h-4 w-4" /> Close preview</button>
        </div>

        <div className="exam-titlebar">
          <div className="flex items-center gap-3"><Menu className="h-5 w-5" /><span className="max-w-xl truncate">{title || "Untitled exam"}</span></div>
          <div className="flex items-center gap-2 font-semibold"><Clock3 className="h-5 w-5" /> {minutes} minutes</div>
        </div>

        <div className="exam-sessionbar">
          <div className="text-xs font-semibold uppercase tracking-[.14em] text-white/45">Section chips</div>
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            {isCaseStudy ? (
              <>
                {sortedSections.length === 0 && <span className="text-white/45">No sections configured yet</span>}
                {sortedSections.map((section, index) => <span key={index} className="rounded-full border border-[#00e5ff]/40 bg-[#18093c] px-3 py-1 text-xs text-[#00e5ff]">{section.title.split("—")[0]?.trim() || `Task ${index + 1}`}</span>)}
                {sortedSections.length > 0 && <span className="rounded-full border border-[#00ff88] bg-[#102b36] px-3 py-1 text-xs text-[#00ff88]">Done</span>}
              </>
            ) : (
              <span className="rounded-full border border-[#f4c44e]/50 bg-[#2b2410] px-3 py-1 text-xs text-[#f4c44e]">Objective test · {sortedQuestions.length} question{sortedQuestions.length === 1 ? "" : "s"}</span>
            )}
          </div>
        </div>

        <main className="container exam-container py-7">
          <div className="mx-auto max-w-5xl">
            <div className="mb-5 flex justify-end"><Badge className="rounded-full bg-[#102b36] px-3 py-1 text-[#00ff88]">Read-only draft preview</Badge></div>

            <Card className="exam-card">
              <CardHeader className="border-b border-white/10 px-8 py-7">
                <Badge className="w-fit bg-[#102b36] text-[#00e5ff]">{examType === "case_study" ? "Case study" : "Objective test"} · draft</Badge>
                <CardTitle className="mt-3 text-3xl text-white">{title || "Untitled exam"}</CardTitle>
                <p className="max-w-2xl text-[#c4b5fd]">This is how the exam presents to learners once published. {intro ? intro : "No introduction has been configured yet."}</p>
              </CardHeader>
              <CardContent className="px-8 py-7">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-white/10 bg-[#18093c]/50 p-4"><div className="text-[11px] font-bold uppercase tracking-wider text-white/45">Exam type</div><div className="mt-1 font-bold text-white capitalize">{examType.replace("_", " ")}</div></div>
                  <div className="rounded-xl border border-white/10 bg-[#18093c]/50 p-4"><div className="text-[11px] font-bold uppercase tracking-wider text-white/45">Duration</div><div className="mt-1 font-bold text-white">{duration} minutes</div></div>
                  <div className="rounded-xl border border-white/10 bg-[#18093c]/50 p-4"><div className="text-[11px] font-bold uppercase tracking-wider text-white/45">Price</div><div className="mt-1 font-bold text-white">R{(Number(price || 0)).toFixed(0)}</div></div>
                  <div className="rounded-xl border border-white/10 bg-[#18093c]/50 p-4"><div className="text-[11px] font-bold uppercase tracking-wider text-white/45">Access</div><div className="mt-1 font-bold text-white">{accessDays} days</div></div>
                </div>

                {description && <p className="mt-7 text-sm leading-6 text-[#c4b5fd]"><span className="font-semibold text-white/70">Store description: </span>{description}</p>}

                {isCaseStudy && sortedSections.length > 0 && (
                  <div className="mt-7 space-y-6">
                    <p className="eyebrow">Timed sections · {sortedSections.length} task{sortedSections.length === 1 ? "" : "s"}</p>
                    {sortedSections.map((section, index) => (
                      <Card key={index} className="exam-card">
                        <CardContent className="p-7">
                          <div className="flex flex-wrap items-start justify-between gap-5">
                            <div><p className="eyebrow">Task {index + 1} of {sortedSections.length}</p><h1 className="mt-2 text-2xl font-bold text-white">{section.title || `Task ${index + 1}`}</h1></div>
                            <Badge className="shrink-0 bg-[#102b36] text-[#00ff88]">{section.duration || "45"} minutes</Badge>
                          </div>
                          {(section.introduction || section.question || section.extraNotes) && (
                            <StructuredText className="mt-5 text-base leading-8 text-[#c4b5fd]" text={section.introduction || section.question || section.extraNotes} />
                          )}
                          {section.extraNotes && (section.introduction || section.question) && (
                            <div className="mt-4 rounded-xl border border-[#00e5ff]/30 bg-[#18093c] p-5">
                              <div className="text-xs font-bold uppercase tracking-[.16em] text-[#00e5ff]">Extra notes</div>
                              <StructuredText className="mt-2 text-sm leading-6 text-[#c4b5fd]" text={section.extraNotes} />
                            </div>
                          )}
                          {section.question && section.extraNotes && (
                            <div className="mt-4 rounded-xl border border-[#00ff88]/40 bg-[#102b36] p-5">
                              <div className="text-xs font-bold uppercase tracking-[.16em] text-[#00ff88]">Task</div>
                              <StructuredText className="mt-2 text-sm leading-6 text-[#c4b5fd]" text={section.question} />
                            </div>
                          )}
                          {(section.emailFrom || section.emailTo || section.emailSubject || section.emailText) && (
                            <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
                              <div className="bg-[#102b36] px-4 py-2 text-xs font-bold uppercase tracking-[.16em] text-[#00e5ff]">Email attachment</div>
                              <div className="grid gap-px bg-white/10 sm:grid-cols-2">
                                <div className="bg-[#0c0524] px-4 py-2 text-sm text-[#c4b5fd]"><span className="text-white/45">From:</span> {section.emailFrom || "—"}</div>
                                <div className="bg-[#0c0524] px-4 py-2 text-sm text-[#c4b5fd]"><span className="text-white/45">To:</span> {section.emailTo || "—"}</div>
                              </div>
                              <div className="border-t border-white/10 bg-[#0c0524] px-4 py-2 text-sm font-semibold text-white">Subject: {section.emailSubject || "—"}</div>
                              <div className="border-t border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-6 text-[#c4b5fd]" dangerouslySetInnerHTML={{ __html: section.emailText }} />
                            </div>
                          )}
                          {(section.emailImage || section.reference) && (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {section.emailImage && <Badge className="bg-[#102b36] text-[#00e5ff]">Email image: {section.emailImage.fileName}</Badge>}
                              {section.reference && <Badge className="bg-[#102b36] text-[#00ff88]">Reference: {section.reference.fileName}</Badge>}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {!isCaseStudy && sortedQuestions.length > 0 && (
                  <div className="mt-7 space-y-4">
                    <p className="eyebrow">Objective questions · {sortedQuestions.length}</p>
                    {sortedQuestions.map((question, index) => {
                      const qtype = question.questionType;
                      const needsOptions = qtype !== "numerical" && qtype !== "text_input";
                      const options = question.options.split("\n").map((line) => line.trim()).filter(Boolean);
                      return (
                        <Card key={index} className="exam-card">
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between gap-3"><span className="font-bold text-white">Q{index + 1} · {question.topic || "General"}</span><Badge className="bg-[#102b36] text-[#00e5ff]">{qtype.replace("_", " ")}</Badge></div>
                            <p className="mt-3 text-base leading-7 text-[#c4b5fd]">{question.prompt}</p>
                            {needsOptions && options.length > 0 && (
                              <ul className="mt-3 space-y-1">{options.map((option, optionIndex) => <li key={optionIndex} className="rounded-lg bg-[#0c0524] px-3 py-2 text-sm text-[#c4b5fd]">{String.fromCharCode(65 + optionIndex)}. {option}</li>)}</ul>
                            )}
                            <p className="mt-3 text-xs text-[#00ff88]">Correct: {question.correct}</p>
                            {question.explanation && <p className="mt-2 text-sm leading-6 text-[#c4b5fd]"><span className="font-semibold text-white/70">Explanation: </span>{question.explanation}</p>}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}

                {isCaseStudy && feedbackText && (
                  <div className="mt-7 rounded-xl border border-white/10 bg-[#18093c]/50 p-5">
                    <p className="eyebrow">Feedback / suggested solutions</p>
                    <p className="mt-2 whitespace-pre-wrap leading-7 text-[#c4b5fd]">{feedbackText}</p>
                  </div>
                )}

                {isCaseStudy && sortedSections.length === 0 && <p className="mt-7 text-sm text-white/45">No sections added yet.</p>}
                {!isCaseStudy && sortedQuestions.length === 0 && <p className="mt-7 text-sm text-white/45">No questions added yet.</p>}

                <div className="mt-8 flex justify-end border-t border-white/10 pt-5">
                  <Button className="aft-button" onClick={onClose}>Close preview</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function ExamStudio({ onCreated, onCancelled, editExamId }: { onCreated: () => void; onCancelled?: () => void; editExamId?: number }) {
  const isEditMode = Boolean(editExamId);
  const [title, setTitle] = useState("");
  const [examType, setExamType] = useState<"case_study" | "objective_test">("case_study");
  const [duration, setDuration] = useState("45");
  const [intro, setIntro] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("199");
  const [accessDays, setAccessDays] = useState("30");
  const [featuredImage, setFeaturedImage] = useState<BundleFile | null>(null);
  const [featuredImageUrl, setFeaturedImageUrl] = useState("");
  const [preModeratedPdf, setPreModeratedPdf] = useState<EditableFile>(null);
  const [preSeen, setPreSeen] = useState<EditableFile>(null);
  const [formulae, setFormulae] = useState<EditableFile>(null);
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion()]);
  const [sections, setSections] = useState<SectionDraft[]>([emptySection(1)]);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackFile, setFeedbackFile] = useState<EditableFile>(null);
  const [feedbackTouched, setFeedbackTouched] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [parseNotes, setParseNotes] = useState<string[]>([]);
  const [parsedFileName, setParsedFileName] = useState<string | null>(null);

  const createBundle = trpc.admin.createExamBundle.useMutation({
    onSuccess: (result) => {
      toast.success("Exam created as draft");
      setCreatedId(result.mockExamId);
      onCreated();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateBundle = trpc.admin.updateExamBundle.useMutation({
    onSuccess: () => {
      toast.success("Exam updated");
      onCreated();
    },
    onError: (error) => toast.error(error.message),
  });

  const applyImportedDraft = (draft: ImportedPdfDraft) => {
    if (draft.isSolutionsDocument) {
      if (draft.feedbackFile) {
        setFeedbackFile(draft.feedbackFile);
        setFeedbackTouched(true);
      }
      setParsedFileName(draft.fileName);
      return;
    }
    setTitle(draft.title ?? title);
    setExamType(draft.examType);
    setDuration(String(Math.max(1, Math.round(draft.totalDurationSeconds / 60))));
    setIntro(draft.intro ?? "");
    setDescription(draft.description ?? "");
    setPrice(String(Math.round((draft.priceCents ?? 0) / 100)));
    setAccessDays(String(draft.accessDays ?? 30));
    setPreModeratedPdf(draft.preModeratedPdf ?? null);
    setPreSeen(draft.preSeen ?? null);
    setFormulae(draft.formulae ?? null);
    if (draft.examType === "objective_test") {
      setQuestions((draft.objectiveQuestions?.length
        ? draft.objectiveQuestions.map((q) => ({
            topic: q.topic ?? "General",
            prompt: q.prompt ?? "",
            questionType: q.questionType ?? "single_choice",
            options: (q.options ?? []).join("\n"),
            correct: String(q.correct ?? 0),
            explanation: q.explanation ?? "",
            rationale: (q.rationale ?? []).join("\n"),
            attachment: null,
          }))
        : [emptyQuestion()]));
    } else {
      setSections((draft.caseStudySections?.length
        ? draft.caseStudySections.map((s) => ({
            title: s.title || `Task ${s.sectionNumber}`,
            duration: String(Math.max(1, Math.round((s.durationSeconds ?? 2700) / 60))),
            introduction: s.introduction ?? "",
            extraNotes: s.scenario ?? "",
            question: s.question ?? "",
            emailMode: s.emailImage && !s.emailText ? "file" : "compose",
            emailFrom: s.emailFrom ?? "",
            emailTo: s.emailTo ?? "",
            emailSubject: s.emailSubject ?? "",
            emailText: s.emailText ?? "",
            emailImage: s.emailImage ?? null,
            reference: s.reference ?? null,
          }))
        : [emptySection(1)]));
      setFeedbackFile(draft.feedbackFile ?? null);
      setFeedbackTouched(Boolean(draft.feedbackFile));
    }
    setParsedFileName(draft.fileName);
  };

  const importFromPdf = trpc.exams.createFromPdf.useMutation({
    onSuccess: (draft) => {
      setParseNotes(draft.notes ?? []);
      applyImportedDraft(draft);
      if (draft.isSolutionsDocument) {
        toast.success("Suggested answers PDF attached to the exam feedback slot");
      } else {
        toast.success("Exam built from the PDF — review the extracted fields below and save as a draft");
      }
    },
    onError: (error) => {
      setParseNotes([]);
      toast.error(error.message);
    },
  });

  const handleQuestionPaper = async (file: File) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setParseNotes([]);
      toast.error("The question paper must be a PDF file");
      return;
    }
    const data = await readFile(file);
    if (!data) {
      setParseNotes([]);
      toast.error("Could not read the selected PDF");
      return;
    }
    importFromPdf.mutate({ fileName: data.fileName, mimeType: data.mimeType, base64: data.base64 });
  };

  const handleSolutionsPdf = async (file: File) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("The solutions file must be a PDF");
      return;
    }
    const data = await readFile(file);
    if (!data) {
      toast.error("Could not read the selected PDF");
      return;
    }
    setFeedbackFile(data);
    setFeedbackTouched(true);
    toast.success("Suggested answers PDF attached to the exam feedback slot");
  };

  const detail = trpc.admin.examBundleDetail.useQuery(
    { mockExamId: editExamId as number },
    { enabled: isEditMode, retry: false },
  );

  const loadedRef = useRef(false);
  useEffect(() => {
    loadedRef.current = false;
  }, [editExamId]);
  useEffect(() => {
    if (!detail.data || loadedRef.current) return;
    loadedRef.current = true;
    const { mockExam, product, sections: detailSections, questions: detailQuestions, email, resources, feedbackText: detailFeedbackText } = detail.data;
    setTitle(mockExam.title ?? "");
    setExamType(mockExam.examType);
    setDuration(String(Math.max(1, Math.round((mockExam.totalDurationSeconds ?? 2700) / 60))));
    setIntro(mockExam.intro ?? "");
    setDescription(product.description ?? "");
    setPrice(String(Math.round((product.priceCents ?? 0) / 100)));
    setAccessDays(String(product.accessDays ?? 30));
    setFeaturedImageUrl(product.featuredImageUrl ?? "");
    const existingFile = (resource?: typeof resources[number]): ExistingFile | null => (resource?.fileUrl ? { fileName: resource.title, keepUrl: resource.fileUrl } : null);
    setPreModeratedPdf(existingFile(resources.find((r) => r.kind === "printable_pdf")));
    setPreSeen(existingFile(resources.find((r) => r.kind === "pre_seen")));
    setFormulae(existingFile(resources.find((r) => r.kind === "formulae")));
    if (mockExam.examType === "objective_test") {
      const validTypes: QuestionDraft["questionType"][] = ["single_choice", "multiple_choice", "dropdown", "numerical", "text_input"];
      setQuestions(detailQuestions.length
        ? detailQuestions.map((q) => {
            let options: string[] = [];
            try { const parsed = JSON.parse(q.optionsJson); if (Array.isArray(parsed)) options = parsed.map(String); } catch { /* ignore */ }
            let answerText = "";
            try { const parsed = JSON.parse(q.answerJson); answerText = Array.isArray(parsed) ? parsed.join(",") : String(parsed); } catch { answerText = String(q.answerJson ?? ""); }
            let rationale = "";
            try { const parsed = JSON.parse(q.rationaleJson ?? "null"); if (Array.isArray(parsed)) rationale = parsed.filter(Boolean).join("\n"); } catch { /* ignore */ }
            return {
              topic: q.topic ?? "",
              prompt: q.prompt ?? "",
              questionType: validTypes.includes(q.questionType) ? q.questionType : "single_choice",
              options: options.join("\n"),
              correct: answerText,
              explanation: q.explanation ?? "",
              rationale,
              attachment: q.attachmentUrl ? { fileName: q.attachmentFileName || "question-image", keepUrl: q.attachmentUrl } : null,
            };
          })
        : [emptyQuestion()]);
    } else {
      const draftSections: SectionDraft[] = detailSections.length
        ? detailSections.map((s) => ({
            title: s.title,
            duration: String(Math.max(1, Math.round(s.durationSeconds / 60))),
            introduction: s.introduction ?? "",
            extraNotes: s.scenario ?? "",
            question: s.question ?? "",
            emailMode: "compose",
            emailFrom: (s.email as { from?: string } | null | undefined)?.from ?? "",
            emailTo: (s.email as { to?: string } | null | undefined)?.to ?? "",
            emailSubject: (s.email as { subject?: string } | null | undefined)?.subject ?? "",
            emailText: (s.email as { html?: string } | null | undefined)?.html ?? "",
            emailImage: s.emailImage ? { fileName: s.emailImage.fileName, keepUrl: s.emailImage.keepUrl } : null,
            reference: s.reference ? { fileName: s.reference.fileName, keepUrl: s.reference.keepUrl } : null,
          }))
        : [emptySection(1)];
      draftSections.forEach((section) => {
        section.emailMode = section.emailImage && !section.emailText ? "file" : "compose";
      });
      if (email) {
        const target = draftSections[0];
        if (target) {
          target.emailFrom = target.emailFrom || email.from || "";
          target.emailTo = target.emailTo || email.to || "";
          target.emailSubject = target.emailSubject || email.subject || "";
          target.emailText = target.emailText || email.html || "";
        }
      }
      draftSections.forEach((section) => {
        section.emailMode = section.emailImage && !section.emailText ? "file" : "compose";
      });
      setSections(draftSections);
      const fb = resources.find((r) => r.kind === "feedback");
      if (fb && fb.fileUrl && !fb.fileUrl.trim().startsWith("{")) {
        setFeedbackFile(existingFile(fb));
        setFeedbackText("");
      } else if (detailFeedbackText) {
        setFeedbackText(detailFeedbackText);
        setFeedbackFile(null);
      } else {
        setFeedbackText("");
        setFeedbackFile(null);
      }
      setFeedbackTouched(false);
    }
  }, [detail.data]);

  const isCaseStudy = examType === "case_study";

  const switchExamType = (next: "case_study" | "objective_test") => {
    if (next === examType) return;
    setExamType(next);
    // route cleanly between the two modules: clear the other module's fields
    if (next === "case_study") {
      setQuestions([emptyQuestion()]);
    } else {
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
    setPreSeen(null);
    setFormulae(null);
    setQuestions([emptyQuestion()]);
    setSections([emptySection(1)]);
    setFeedbackText("");
    setFeedbackFile(null);
    setCreatedId(null);
    setParseNotes([]);
    setParsedFileName(null);
  };

  const parsePurposeQuestion = (question: QuestionDraft) => {
    const options = question.options.split("\n").map((line) => line.trim()).filter(Boolean);
    const needsOptions = question.questionType !== "numerical" && question.questionType !== "text_input";
    const correctRaw = question.correct.trim();
    const qtype = question.questionType;
    let correctValue: number | number[] = 0;
    if (qtype === "multiple_choice") {
      correctValue = correctRaw.split(/[,;\s]+/).map((part) => Number(part)).filter((value) => Number.isFinite(value));
      correctValue = correctValue.length ? correctValue : [0];
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
    if (createBundle.isPending || updateBundle.isPending) return;
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
              scenario: section.extraNotes.trim() || undefined,
              question: section.question.trim() || undefined,
              durationSeconds: Math.max(60, Math.round(Number(section.duration || 45) * 60)),
              emailFrom: section.emailFrom.trim() || undefined,
              emailTo: section.emailTo.trim() || undefined,
              emailSubject: section.emailSubject.trim() || undefined,
              emailText: section.emailText.trim() || undefined,
              emailImage: section.emailImage && "keepUrl" in section.emailImage ? (isEditMode ? section.emailImage : undefined) : section.emailImage ?? undefined,
              reference: section.reference && "keepUrl" in section.reference ? (isEditMode ? section.reference : undefined) : section.reference ?? undefined,
            }))
            .filter((section) => section.title.trim())
        : undefined;
    if (examType === "case_study" && bundleSections && bundleSections.length === 0) {
      return toast.error("Add at least one case-study section (task)");
    }
    const createSections = (bundleSections ?? []).map((s) => ({
      ...s,
      emailImage: s.emailImage && "keepUrl" in s.emailImage ? undefined : s.emailImage,
      reference: s.reference && "keepUrl" in s.reference ? undefined : s.reference,
    }));
    const common = {
      title: title.trim(),
      examType,
      intro: intro.trim() || undefined,
      description: description.trim() || undefined,
      priceCents: Math.max(0, Math.round(Number(price || 0) * 100)),
      accessDays: Math.max(1, Number(accessDays) || 30),
      totalDurationSeconds: Math.max(60, Math.round(Number(duration || 45) * 60)),
      featuredImageUrl: featuredImageUrl.trim() || undefined,
      featuredImage: featuredImage ?? undefined,
      caseStudySections: bundleSections,
      objectiveQuestions: bundleQuestions,
    };
    if (isEditMode) {
      const feedbackActive = feedbackTouched;
      const payload: Parameters<typeof updateBundle.mutate>[0] = {
        ...common,
        mockExamId: editExamId as number,
        preModeratedPdf: preModeratedPdf ?? undefined,
        preSeen: preSeen ?? undefined,
        formulae: formulae ?? undefined,
        feedbackText: examType === "case_study" ? (feedbackActive ? feedbackText.trim() || null : undefined) : undefined,
        feedbackFile: examType === "case_study" ? (feedbackActive ? feedbackFile ?? null : undefined) : undefined,
      };
      updateBundle.mutate(payload);
      return;
    }
    const createQuestions: NonNullable<Parameters<typeof createBundle.mutate>[0]["objectiveQuestions"]> = (bundleQuestions ?? []).map((q) =>
      q.attachment && "keepUrl" in q.attachment
        ? { ...q, attachment: undefined }
        : q.attachment && "base64" in q.attachment
          ? { ...q, attachment: q.attachment }
          : { ...q, attachment: undefined },
    );
    const payload: Parameters<typeof createBundle.mutate>[0] = {
      ...common,
      caseStudySections: createSections,
      objectiveQuestions: createQuestions,
      featuredImageUrl: featuredImageUrl.trim() || undefined,
      preModeratedPdf: preModeratedPdf && "keepUrl" in preModeratedPdf ? undefined : preModeratedPdf ?? undefined,
      preSeen: preSeen && "keepUrl" in preSeen ? undefined : preSeen ?? undefined,
      formulae: formulae && "keepUrl" in formulae ? undefined : formulae ?? undefined,
      feedbackText: examType === "case_study" ? feedbackText.trim() || undefined : undefined,
      feedbackFile: examType === "case_study" ? (feedbackFile && "keepUrl" in feedbackFile ? undefined : feedbackFile ?? undefined) : undefined,
    };
    createBundle.mutate(payload);
  };

  return (
    <div className="space-y-6">
      <Card className="mt-6 border-[#00e5ff]/30 bg-[#120730]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white"><GraduationCap className="h-5 w-5 text-[#00ff88]" /> {isEditMode ? `Edit exam${editExamId != null ? ` #${editExamId}` : ""}` : "Create an exam"}</CardTitle>
          <p className="text-sm leading-6 text-white/50">{isEditMode ? "Edit this exam and its store listing, pricing, subscription period, featured image, and protected resources. The current publish status is preserved — a published exam stays published after saving." : "Create a case study or objective test together with its store listing, pricing, subscription period, featured image, and protected resources — all in one place. New exams are saved as drafts until an administrator publishes them."}</p>
        </CardHeader>
        <CardContent className="space-y-7">
          {isEditMode && detail.isLoading && (
            <div className="rounded-xl border border-[#00e5ff]/30 bg-[#102b36]/40 p-4 text-sm text-[#00e5ff]">Loading exam details…</div>
          )}
          {isEditMode && detail.isError && (
            <div className="rounded-xl border border-[#ff8278]/40 bg-[#2b1010]/40 p-4 text-sm text-[#ff8278]">Could not load this exam. It may have been deleted.</div>
          )}
          {isEditMode && detail.data && detail.data.product.status !== "published" && (
            <div className="rounded-xl border border-[#f4c44e]/50 bg-[#2b2410]/60 p-4">
              <p className="text-sm font-bold text-[#f4c44e]">This exam is not published — hidden from learners</p>
              <p className="mt-1 text-xs leading-5 text-white/60">The linked product "<span className="text-[#f4c44e]">{detail.data.product.title}</span>" has status <span className="text-[#f4c44e]">{detail.data.product.status}</span>. Attachments you save here will only appear in the learner portal once the product and its resources are published. If a published version of this exam already exists in the catalogue, edit that version instead.</p>
            </div>
          )}

          {/* Import from PDF */}
          <section>
            <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[.14em] text-[#00e5ff]"><UploadCloud className="h-4 w-4" /> Import from PDF</div>
            <div className="rounded-2xl border border-[#00e5ff]/30 bg-[#102b36]/40 p-4 sm:p-5">
              <p className="text-sm leading-6 text-[#c4b5fd]">Knock out <strong className="text-white">both steps</strong> by uploading your pre-moderated exam paper as a PDF: the structured draft below is extracted automatically and this whole form is filled in for you. Review, tweak, then save as a draft.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <PdfImportSlot
                  label="Question paper (PDF)"
                  icon={<FileText className="h-4 w-4 text-[#00e5ff]" />}
                  hint="Builds the whole exam from this file — title, exam type, timing, case-study tasks / objective questions, email, and permitted resources."
                  busy={importFromPdf.isPending}
                  attached={parsedFileName}
                  onAttach={(file) => void handleQuestionPaper(file)}
                  onRemove={() => { setParsedFileName(null); setParseNotes([]); }}
                />
                <PdfImportSlot
                  label="Suggested answers / solutions (PDF, optional)"
                  icon={<GraduationCap className="h-4 w-4 text-[#00ff88]" />}
                  hint="Attach the marking guide, suggested answers or solutions PDF to the exam feedback slot — shown to learners after submission."
                  attached={feedbackFile?.fileName ?? null}
                  onAttach={(file) => void handleSolutionsPdf(file)}
                  onRemove={() => { setFeedbackFile(null); setFeedbackTouched(true); }}
                />
              </div>
              {importFromPdf.isPending && (
                <p className="mt-3 flex items-center gap-2 text-sm text-[#00e5ff]"><Loader2 className="h-4 w-4 animate-spin" /> Reading the PDF and extracting the exam structure…</p>
              )}
              {parsedFileName && !importFromPdf.isPending && (
                <div className="mt-3 rounded-xl border border-[#00ff88]/40 bg-[#102b36] px-4 py-3">
                  <p className="flex items-center gap-2 text-sm font-bold text-[#00ff88]"><ShieldCheck className="h-4 w-4" /> {"Draft extracted from"} {parsedFileName} — review the fields below before saving. Nothing is published automatically; saving always creates a draft.</p>
                  {parseNotes.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {parseNotes.map((note, index) => <li key={index} className="flex items-start gap-2 text-xs leading-5 text-[#f4c44e]"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {note}</li>)}
                    </ul>
                  )}
                </div>
              )}
              {importFromPdf.isError && (
                <p className="mt-3 rounded-xl border border-[#ff8278]/40 bg-[#2b1010]/40 px-4 py-3 text-sm text-[#ff8278]">{importFromPdf.error?.message ?? "Could not import this PDF."}</p>
              )}
            </div>
          </section>

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
            <FormattingTextarea label="Exam introduction / instructions" value={intro} onChange={setIntro} placeholder="Exam introduction / instructions" className="mt-1 min-h-20" />
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

          {/* Conditional body: case-study → section/task builder; objective test → question builder */}
          {isCaseStudy ? (
            <>
              <section>
                <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[.14em] text-[#00ff88]"><Layers3 className="h-4 w-4" /> Sections / tasks & timing</div>
                <p className="mb-3 text-xs leading-5 text-white/50">
                  Add each case-study task in order. Each section has its own title, time limit, instructions, optional extra notes, task wording, email attachment (composed manually or attached as an image / PDF) and reference material (like the example Cartn Mock Exams with four 45-minute tasks). Pre-seen and formulae + tables stay exam-wide below.
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
                    <Textarea value={feedbackText} onChange={(event) => { setFeedbackText(event.target.value); setFeedbackTouched(true); }} placeholder="Paste or type the marking guide / suggested solutions…" className="mt-2 min-h-28 border-white/10 bg-[#0c0524] text-white" />
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-white">Or attach a feedback document</p>
                    <AttachSlot label="Feedback document" icon={<FileText className="h-4 w-4 text-[#00e5ff]" />} hint="Suggested solutions / answers and marking guide." accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" value={feedbackFile} onChange={(file) => { setFeedbackFile(file); setFeedbackTouched(true); }} note="PDF, document, PNG or JPG." />
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

          {/* Resources for case studies only */}
          {isCaseStudy && (
            <section>
              <div className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[.14em] text-[#00ff88]"><Layers3 className="h-4 w-4" /> Case study resources</div>
              <div className="grid gap-3 md:grid-cols-2">
                <AttachSlot label="Pre-seen" icon={<BookOpen className="h-4 w-4 text-[#00e5ff]" />} hint="The scenario / advance information pdf — shared across every task." accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" value={preSeen} onChange={setPreSeen} note="Document, PDF, PNG or JPG." />
                <AttachSlot label="Formulae + tables" icon={<Calculator className="h-4 w-4 text-[#00e5ff]" />} hint="Formulae sheets and statistical tables — shared across every task." accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" value={formulae} onChange={setFormulae} note="Document, PDF, PNG or JPG." />
              </div>
            </section>
          )}

          <Separator />

          <div className="flex flex-wrap items-center justify-end gap-3">
            {createdId && <Badge className="bg-[#102b36] text-[#00ff88]">Exam draft #{createdId} created</Badge>}
            {isEditMode && onCancelled && (
              <Button variant="outline" className="border-white/15 text-white/70" onClick={onCancelled} disabled={updateBundle.isPending}><RefreshCw className="mr-2 h-4 w-4" /> Back to exams</Button>
            )}
            <Button variant="outline" className="border-[#00e5ff] text-[#00e5ff]" onClick={() => setPreviewOpen(true)} disabled={!title.trim()}><Sparkles className="mr-2 h-4 w-4" /> Preview</Button>
            {!isEditMode && <Button variant="outline" className="border-white/15 text-white/70" onClick={reset} disabled={createBundle.isPending}><RefreshCw className="mr-2 h-4 w-4" /> Reset</Button>}
            <Button className="aft-button" disabled={createBundle.isPending || updateBundle.isPending || !title.trim()} onClick={() => void submit()}>
              {(createBundle.isPending || updateBundle.isPending) ? "Saving…" : isEditMode ? "Save changes" : isCaseStudy ? "Create case study exam" : "Create objective test exam"} <CreditCard className="ml-2 h-4 w-4" />
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
          sections={sections}
          feedbackText={feedbackText}
          questions={questions}
        />
      )}
    </div>
  );
}
