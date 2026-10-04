import { useEffect, useMemo, useRef } from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  RemoveFormatting,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";
import { normalizeAuthoredHtml, sanitizeAuthoredHtml } from "@shared/richText";

type DocumentEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
};

/**
 * Word-style editor for store descriptions. It stores HTML in the existing description string,
 * while the shared rich-text parser sanitizes and renders that markup in the store and previews.
 */
export function DocumentEditor({ value, onChange, placeholder, ariaLabel = "Product description" }: DocumentEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const html = useMemo(() => sanitizeAuthoredHtml(normalizeAuthoredHtml(value)), [value]);
  const toolButton = "inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-white/10 bg-[#0c0524] px-2 text-white/80 transition hover:border-[#00ff88]/50 hover:text-[#00ff88]";

  useEffect(() => {
    const editor = editorRef.current;
    // Imported/saved content is sanitized before it reaches the editable DOM. Don't replace the
    // active DOM while typing, because doing so would move the caret on every keystroke.
    if (editor && document.activeElement !== editor && editor.innerHTML !== html) editor.innerHTML = html;
  }, [html]);

  const commit = (editor: HTMLDivElement) => {
    const safeHtml = sanitizeAuthoredHtml(editor.innerHTML);
    if (safeHtml !== editor.innerHTML) editor.innerHTML = safeHtml;
    onChange(safeHtml);
  };

  const exec = (command: string, commandValue?: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(command, false, commandValue);
    commit(editor);
  };

  const button = (title: string, icon: React.ReactNode, action: () => void, text?: string) => (
    <button
      key={title}
      type="button"
      className={toolButton}
      title={title}
      aria-label={title}
      onMouseDown={(event) => event.preventDefault()}
      onClick={action}
    >
      {icon ?? text}
    </button>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0c0524]">
      <div className="flex flex-wrap items-center gap-1 border-b border-white/10 bg-[#18093c]/60 px-2 py-1.5" role="toolbar" aria-label="Product description formatting">
        {button("Undo", <Undo2 className="h-4 w-4" />, () => exec("undo"))}
        {button("Redo", <Redo2 className="h-4 w-4" />, () => exec("redo"))}
        <span className="mx-1 h-5 w-px bg-white/10" />
        {button("Bold", <Bold className="h-4 w-4" />, () => exec("bold"))}
        {button("Italic", <Italic className="h-4 w-4" />, () => exec("italic"))}
        {button("Underline", <Underline className="h-4 w-4" />, () => exec("underline"))}
        {button("Strikethrough", <Strikethrough className="h-4 w-4" />, () => exec("strikeThrough"))}
        <span className="mx-1 h-5 w-px bg-white/10" />
        {button("Paragraph", null, () => exec("formatBlock", "<p>"), "¶")}
        {button("Heading 1", <Heading1 className="h-4 w-4" />, () => exec("formatBlock", "<h1>"))}
        {button("Heading 2", <Heading2 className="h-4 w-4" />, () => exec("formatBlock", "<h2>"))}
        {button("Heading 3", <Heading3 className="h-4 w-4" />, () => exec("formatBlock", "<h3>"))}
        <span className="mx-1 h-5 w-px bg-white/10" />
        {button("Bulleted list", <List className="h-4 w-4" />, () => exec("insertUnorderedList"))}
        {button("Numbered list", <ListOrdered className="h-4 w-4" />, () => exec("insertOrderedList"))}
        <span className="mx-1 h-5 w-px bg-white/10" />
        {button("Align left", <AlignLeft className="h-4 w-4" />, () => exec("justifyLeft"))}
        {button("Align centre", <AlignCenter className="h-4 w-4" />, () => exec("justifyCenter"))}
        {button("Align right", <AlignRight className="h-4 w-4" />, () => exec("justifyRight"))}
        {button("Justify", <AlignJustify className="h-4 w-4" />, () => exec("justifyFull"))}
        <span className="mx-1 h-5 w-px bg-white/10" />
        {button("Clear formatting", <RemoveFormatting className="h-4 w-4" />, () => exec("removeFormat"))}
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label={ariaLabel}
        aria-multiline="true"
        aria-placeholder={placeholder}
        data-placeholder={placeholder}
        onInput={(event) => commit(event.currentTarget)}
        className="document-editor-body min-h-28 cursor-text px-3 py-2 text-sm leading-6 text-white outline-none [&:empty:before]:pointer-events-none [&:empty:before]:text-white/35 [&:empty:before]:content-[attr(data-placeholder)]"
      />
      <style>{`.document-editor-body p{margin:.25rem 0}.document-editor-body h1,.document-editor-body h2,.document-editor-body h3{margin:.6rem 0;font-weight:700;line-height:1.3}.document-editor-body h1{font-size:1.5rem}.document-editor-body h2{font-size:1.25rem}.document-editor-body h3{font-size:1.1rem}.document-editor-body ul{list-style:disc;margin:.4rem 0;padding-left:1.5rem}.document-editor-body ol{list-style:decimal;margin:.4rem 0;padding-left:1.5rem}.document-editor-body li{display:list-item;margin:.1rem 0}.document-editor-body hr{margin:.75rem 0;border-color:rgba(255,255,255,.2)}.document-editor-body>*:first-child{margin-top:0}`}</style>
    </div>
  );
}
