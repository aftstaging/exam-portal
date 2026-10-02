/**
 * One parser for author-supplied rich text, shared by the exam shell and the printable PDF writer.
 *
 * ## Why this module exists
 *
 * Authored exam content used to be interpreted twice, by two independent parsers: the browser
 * rendered it through `StructuredText` and the PDF writer rendered it through `parseRichHtml`.
 * The two understood different things, and the gap is what put raw `<table>` markup on the
 * learner's screen and `**` asterisks on the printed page:
 *
 *   - `StructuredText` split the field into *lines* before it looked for a table, so a table
 *     that shared a line with a sentence was never recognised and its markup printed literally.
 *   - The PDF writer only understood `<strong>`, so the `**bold**` marker syntax the studio
 *     taught printed as literal asterisks.
 *
 * Both are now consequences of a single grammar. An author types into a rich text editor that
 * emits HTML; this module turns that HTML into a flat list of `RichBlock`s; the screen renderer
 * and the PDF writer each draw the same blocks. Neither can disagree with the other about what
 * the content means, because neither is deciding.
 *
 * ## The two input dialects
 *
 * Content in the database was written by two different editors over the life of the product:
 * marker text (`**bold**`, `## heading`, `● bullet`) and real HTML. Both are still accepted, and
 * `normalizeAuthoredHtml` upgrades the first to the second. The marker form is read line by
 * line, which is the only way it is unambiguous; the HTML form is parsed structurally, so it
 * does not care where the author pressed return.
 */

/** A contiguous stretch of text sharing one emphasis state. */
export type RichRun = {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
};

export type RichAlign = "left" | "center" | "right" | "justify";

/** The block kinds the exam shell and the PDF writer both know how to draw. */
export type RichBlockKind = "paragraph" | "heading" | "listItem" | "table" | "rule";

export type RichTable = {
  rows: RichBlock[][][];
  headerRow: boolean;
};

export type RichBlock = {
  kind: RichBlockKind;
  runs: RichRun[];
  /**
   * The alignment the author asked for, or `undefined` when they asked for none.
   *
   * The distinction is load-bearing for the printable page. Body prose with no declared
   * alignment has always been justified there, and that is the right default for a document
   * meant to look typeset; an author who picks left-aligned means it and must be able to say
   * so, which they cannot if "not specified" and "left" are the same value.
   */
  align?: RichAlign;
  /** Heading level, 1-6. Only meaningful when `kind` is `"heading"`. */
  level: number;
  /** Nesting depth for list items, 0 for a top-level bullet. */
  depth: number;
  /** The bullet glyph or ordinal drawn in the hanging indent, for `kind === "listItem"`. */
  marker: string | null;
  /** True for a list that counts rather than one that bullets. */
  ordered: boolean;
  table?: RichTable;
};

/* ------------------------------------------------------------------ *
 * Sanitising
 *
 * Authored content is injected into the page and printed, so it is filtered against an
 * allowlist before anything reads it. A tag that is not listed is unwrapped rather than
 * dropped, so an author who pastes from a word processor keeps the words and loses only the
 * markup they did not ask for.
 * ------------------------------------------------------------------ */

/** Tags kept as-is. Everything structural or presentational that a word processor emits. */
const ALLOWED_TAGS = new Set([
  "p", "div", "br", "hr",
  "strong", "b", "em", "i", "u", "s", "strike", "del", "ins", "sub", "sup", "small", "mark", "span", "font",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "dl", "dt", "dd",
  "blockquote", "pre", "code",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "col", "colgroup",
  "a", "img", "figure", "figcaption",
]);

/** Tags whose entire contents are discarded, not just their markup. */
const VOID_CONTENT_TAGS = new Set(["script", "style", "iframe", "object", "embed", "noscript", "template", "svg", "math"]);

/** Tags that never have a closing partner. */
const VOID_TAGS = new Set(["br", "hr", "img", "col"]);

/** Attributes kept on an allowed tag. `on*` handlers and URLs are handled separately. */
const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "title", "width", "height"]),
  td: new Set(["colspan", "rowspan", "align", "valign", "style"]),
  th: new Set(["colspan", "rowspan", "align", "valign", "scope", "style"]),
  table: new Set(["align", "style", "border", "cellpadding", "cellspacing", "width"]),
  col: new Set(["span", "width", "style"]),
  colgroup: new Set(["span", "width", "style"]),
  font: new Set(["color", "face", "size"]),
  span: new Set(["style", "class"]),
  div: new Set(["style", "class", "align"]),
  p: new Set(["style", "class", "align"]),
  ol: new Set(["start", "type", "style", "class"]),
  ul: new Set(["style", "class"]),
  li: new Set(["style", "class", "value"]),
  h1: new Set(["style", "align"]), h2: new Set(["style", "align"]), h3: new Set(["style", "align"]),
  h4: new Set(["style", "align"]), h5: new Set(["style", "align"]), h6: new Set(["style", "align"]),
  tr: new Set(["style", "align"]), thead: new Set(["style"]), tbody: new Set(["style"]),
  blockquote: new Set(["style"]), pre: new Set(["style"]), hr: new Set(["style"]),
  caption: new Set(["style", "align"]), b: new Set(["style"]), strong: new Set(["style"]),
  i: new Set(["style"]), em: new Set(["style"]), u: new Set(["style"]), s: new Set(["style"]),
  strike: new Set(["style"]), del: new Set(["style"]), ins: new Set(["style"]),
};

const TAG_PATTERN = /<\/?([a-z][a-z0-9]*)((?:"[^"]*"|'[^']*'|[^>])*)>/gi;
const COMMENT_PATTERN = /<!--[\s\S]*?-->/g;

/** Only these URL schemes may appear in an `href` or `src`. */
const SAFE_URL = /^(https?:|mailto:|tel:|data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,)/i;

/**
 * Strips markup an author did not ask for and any script an author (or a paste) could smuggle in.
 *
 * Kept deliberately conservative: it rewrites attributes rather than deleting elements, because
 * a tag that carries text cannot be dropped without losing the text. `<script>` and friends lose
 * their contents too, since their contents are code rather than prose.
 */
export function sanitizeAuthoredHtml(source: string | null | undefined): string {
  if (!source) return "";
  let html = source.replace(COMMENT_PATTERN, "");
  // `forEach` rather than `for...of`: the project compiles at an ES5 target, where iterating a
  // Set directly needs `downlevelIteration`.
  VOID_CONTENT_TAGS.forEach((tag) => {
    html = html.replace(new RegExp(`<${tag}\\b[\\s\\S]*?(<\\/${tag}\\s*>|$)`, "gi"), "");
  });

  let out = "";
  let cursor = 0;
  TAG_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG_PATTERN.exec(html))) {
    out += html.slice(cursor, match.index);
    cursor = match.index + match[0].length;

    const name = match[1]!.toLowerCase();
    if (!ALLOWED_TAGS.has(name)) continue; // unwrapped: the text survives, the tag does not

    const closing = match[0]!.startsWith("</");
    if (closing) {
      if (!VOID_TAGS.has(name)) out += `</${name}>`;
      continue;
    }
    const attributes = filterAttributes(name, match[2] ?? "");
    out += attributes ? `<${name} ${attributes}>` : `<${name}>`;
  }
  out += html.slice(cursor);
  return out;
}

/** Keeps only allowlisted attributes, dropping event handlers and unsafe URLs. */
function filterAttributes(tag: string, raw: string): string {
  const allowed = ALLOWED_ATTRIBUTES[tag];
  if (!allowed) return "";
  const kept: string[] = [];
  const pattern = /([a-z][a-z0-9:-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw))) {
    const name = match[1]!.toLowerCase();
    if (!allowed.has(name)) continue;
    const value = match[3] ?? match[4] ?? match[5] ?? "";
    if ((name === "href" || name === "src") && !SAFE_URL.test(value.trim())) continue;
    // `style` is filtered rather than trusted: an authored colour or alignment is legitimate,
    // but `url(...)` in a background is a way to reach the network, and `expression` is script.
    if (name === "style" && /url\s*\(|expression|javascript:|@import/i.test(value)) continue;
    if (name === "class") continue; // the portal's own styling is applied by the renderer, not the author
    kept.push(`${name}="${value.replace(/"/g, "&quot;")}"`);
  }
  return kept.join(" ");
}

/* ------------------------------------------------------------------ *
 * Legacy marker text
 * ------------------------------------------------------------------ */

const MARKER_BOLD = /\*\*([^*\n]+)\*\*/g;
const MARKER_ITALIC = /(?<![*\w])\*([^*\n]+)\*(?!\*)/g;
const MARKER_UNDERLINE = /__([^_\n]+)__/g;
const MARKER_STRIKE = /~~([^~\n]+)~~/g;

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Turns the marker syntax the older studio taught into the HTML this module parses.
 *
 * `**bold**` becomes `<strong>`, a line starting `## ` becomes a heading, and a line starting
 * `● ` or `1. ` becomes a list. Markup that is already HTML is passed through untouched, so a
 * field that mixes the two — a table surrounded by marker prose, which is exactly what the
 * exam studio produced — is upgraded in one pass without losing either part.
 *
 * Table markup is lifted out before the line pass so its newlines are never mistaken for
 * paragraph breaks, and put back in place afterwards.
 */
export function normalizeAuthoredHtml(source: string | null | undefined): string {
  if (!source) return "";
  const raw = source.replace(/\r\n?/g, "\n");

  const lifted = liftTables(raw, false);
  const tables = lifted.tables;
  const withPlaceholders = lifted.html;

  const lines = withPlaceholders.split("\n");
  const out: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const closeList = () => {
    if (listType) out.push(`</${listType}>`);
    listType = null;
  };

  for (const line of lines) {
    const table = /^\u0000AFT_TABLE_(\d+)\u0000$/.exec(line.trim());
    if (table) {
      closeList();
      out.push(tables[Number(table[1])] ?? "");
      continue;
    }
    if (!line.trim()) {
      closeList();
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      const level = Math.min(6, heading[1]!.length);
      out.push(`<h${level}>${inlineMarkers(heading[2]!)}</h${level}>`);
      continue;
    }

    const bullet = /^\s*[•●▪◦\-*]\s+(.*)$/.exec(line);
    if (bullet) {
      if (listType !== "ul") {
        closeList();
        out.push("<ul>");
        listType = "ul";
      }
      out.push(`<li>${inlineMarkers(bullet[1]!)}</li>`);
      continue;
    }

    const numbered = /^\s*(\d{1,3})[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      if (listType !== "ol") {
        closeList();
        out.push("<ol>");
        listType = "ol";
      }
      out.push(`<li>${inlineMarkers(numbered[2]!)}</li>`);
      continue;
    }

    closeList();
    out.push(wrapProse(inlineMarkers(line)));
  }
  closeList();
  // A table that shared its line with prose is still only a placeholder at this point, because
  // the lift above is what kept the table's own newlines from being read as paragraph breaks.
  // Restoring in place rather than only for a table that occupied a line of its own is what
  // keeps an inline table from being silently dropped.
  return out.join("\n").replace(/\u0000AFT_TABLE_(\d+)\u0000/g, (_match, index: string) => tables[Number(index)] ?? "");
}

/** A line that already opens a block element carries its own structure and is not re-wrapped. */
const BLOCK_LINE = /^\s*<\/?(?:p|div|h[1-6]|ul|ol|li|table|thead|tbody|tr|th|td|blockquote|pre|hr)\b/i;

/**
 * Wraps a converted line as a paragraph unless it already is one.
 *
 * Bare lines have to be wrapped because the parser only breaks a block on a tag, so two
 * consecutive unwrapped lines would otherwise merge into a single paragraph. A line that opens
 * a block already is one, and wrapping it would nest the element inside a paragraph.
 */
function wrapProse(line: string): string {
  return BLOCK_LINE.test(line) ? line : `<p>${line}</p>`;
}

/**
 * Converts the inline emphasis markers in one line, leaving any real markup on the line alone.
 *
 * The line is walked as alternating tag and text segments rather than tested as a whole for
 * "is this HTML or is this markers". That global test cannot work on a field that mixes the two,
 * which is the normal shape of exam content: a sentence in `**bold**`, a table, and a phrase
 * wrapped in `<u>` all in one field. Deciding per segment means each part is handled on its own
 * terms — a `**` in prose becomes emphasis, the same `**` typed inside a tag attribute stays
 * text, and a `<u>` that is already markup is left exactly as the author wrote it.
 *
 * Text segments are not fully escaped, because content that is already HTML carries entities
 * (`&amp;`) that a second pass would turn into `&amp;amp;`. Only a `<` that does not open a tag
 * is escaped, which is the one case that could otherwise be read as markup.
 */
function inlineMarkers(line: string): string {
  let out = "";
  let cursor = 0;
  TAG_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG_PATTERN.exec(line))) {
    if (match.index > cursor) out += markerSegment(line.slice(cursor, match.index));
    out += match[0];
    cursor = match.index + match[0].length;
  }
  if (cursor < line.length) out += markerSegment(line.slice(cursor));
  return out;
}

/** A `<` that does not open a tag or a comment, and so is literal text. */
const STRAY_LESS_THAN = /<(?![/!a-zA-Z])/g;

function markerSegment(text: string): string {
  return text
    .replace(STRAY_LESS_THAN, "&lt;")
    .replace(MARKER_BOLD, "<strong>$1</strong>")
    .replace(MARKER_ITALIC, "<em>$1</em>")
    .replace(MARKER_UNDERLINE, "<u>$1</u>")
    .replace(MARKER_STRIKE, "<s>$1</s>");
}

/* ------------------------------------------------------------------ *
 * Parsing
 * ------------------------------------------------------------------ */

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", "#160": " ", hellip: "...",
  mdash: "—", ndash: "–", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", bull: "•",
  middot: "·", times: "×", divide: "÷", minus: "−", plusmn: "±", deg: "°", eacute: "é",
  egrave: "è", agrave: "à", ccedil: "ç", uuml: "ü", ouml: "ö", auml: "ä", szlig: "ß",
  laquo: "«", raquo: "»", copy: "©", reg: "®", trade: "™", euro: "€", pound: "£", sect: "§",
  para: "¶", dagger: "†", permil: "‰", prime: "′", Prime: "″", ensp: " ", emsp: " ", thinsp: " ",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/gi, (match, entity: string) => {
    if (entity === "#39") return "'";
    const named = NAMED_ENTITIES[entity] ?? NAMED_ENTITIES[entity.toLowerCase()];
    if (named !== undefined) return named;
    const codePoint = entity.toLowerCase().startsWith("#x")
      ? Number.parseInt(entity.slice(2), 16)
      : entity.startsWith("#")
        ? Number.parseInt(entity.slice(1), 10)
        : Number.NaN;
    if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return match;
    try {
      return String.fromCodePoint(codePoint);
    } catch {
      return match;
    }
  });
}

const ENTITIES = /&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/gi;

const escapeForRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Joins consecutive parts that share an emphasis state, so a run is not split per token. */
function pushRun(runs: RichRun[], text: string, style: Omit<RichRun, "text">): void {
  if (!text) return;
  const last = runs[runs.length - 1];
  if (last && last.bold === style.bold && last.italic === style.italic && last.underline === style.underline && last.strike === style.strike) {
    last.text += text;
    return;
  }
  runs.push({ text, ...style });
}

type InlineStyle = Omit<RichRun, "text">;

const PLAIN: InlineStyle = { bold: false, italic: false, underline: false, strike: false };

/**
 * Reads the alignment out of a `style` attribute or an `align` attribute.
 *
 * Returns `undefined` when neither declares one, which the callers preserve rather than
 * collapsing to `"left"`, so "the author said nothing" stays distinguishable from "the author
 * said left".
 */
function readAlign(attributes: string): RichAlign | undefined {
  const style = /text-align\s*:\s*(left|center|right|justify)/i.exec(attributes)?.[1]?.toLowerCase();
  if (style) return style as RichAlign;
  const attr = /align\s*=\s*["']?(left|center|right|justify)/i.exec(attributes)?.[1]?.toLowerCase();
  return attr as RichAlign | undefined;
}

/** Counts the indentation a block is nested by, from a `margin-left` or `padding-left` in pixels. */
function readIndent(attributes: string): number {
  const match = /(?:margin-left|padding-left)\s*:\s*(\d+(?:\.\d+)?)px/i.exec(attributes);
  if (!match) return 0;
  return Math.min(4, Math.max(0, Math.round(Number(match[1]) / 24)));
}

const BLOCK_TAGS = new Set(["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "li", "td", "th", "caption"]);

/**
 * Turns author HTML into a flat list of renderable blocks.
 *
 * The scan is a single pass over the source with an explicit stack of inline emphasis and list
 * state, which is what lets a table cell hold a paragraph, a list item hold a bold run, and a
 * paragraph hold a `<br>` — none of which a line-splitting reader can do. Tables are lifted out
 * and spliced back at their authored position so prose and tables interleave in source order.
 */
/** The placeholder token standing in for the `index`th table while the rest of a field is scanned. */
function tableToken(index: number): string {
  return `\u0000AFT_TABLE_${index}\u0000`;
}

/** The markup between a `<table>` and its `</table>`, which is the part a row is read from. */
function tableInner(markup: string): string {
  const open = markup.indexOf(">");
  const close = markup.toLowerCase().lastIndexOf("</table");
  if (open === -1 || close === -1 || close < open) return "";
  return markup.slice(open + 1, close);
}

/**
 * Sets the outermost tables aside and leaves a placeholder where each one stood.
 *
 * The obvious version of this is a single non-greedy `<table…</table>` replacement, and it is
 * wrong twice over. It stops at the *first* `</table>`, so a table holding another table is cut
 * in half and the tail of the outer one is left behind as stray text. And it matches a table
 * sitting inside a paragraph in a way that is easy to lose track of. The nesting is counted
 * instead, so only whole outermost tables are lifted and a nested one travels inside the markup
 * of the cell that holds it, where it is parsed again on its own terms.
 *
 * @param wrap Whether each placeholder becomes a paragraph of its own, which is what the block
 *   scanner needs. The normaliser leaves the token bare so its own line pass can see it.
 */
function liftTables(html: string, wrap: boolean): { html: string; tables: string[] } {
  const tables: string[] = [];
  const pattern = /<(\/?)table\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  let depth = 0;
  let start = 0;
  let cursor = 0;
  let out = "";
  while ((match = pattern.exec(html))) {
    if (match[1] !== "/") {
      if (depth === 0) start = match.index;
      depth += 1;
      continue;
    }
    depth -= 1;
    if (depth > 0) continue;
    depth = 0;
    out += html.slice(cursor, start);
    const token = tableToken(tables.length);
    out += wrap ? `<p>${token}</p>` : token;
    tables.push(html.slice(start, match.index + match[0].length));
    cursor = match.index + match[0].length;
  }
  return { html: out + html.slice(cursor), tables };
}

export function parseRichHtml(source: string | null | undefined): RichBlock[] {
  if (!source) return [];
  const html = sanitizeAuthoredHtml(normalizeAuthoredHtml(source));

  const tables: RichTable[] = [];
  const lifted = liftTables(html, true);
  const withPlaceholders = lifted.html;
  for (const markup of lifted.tables) tables.push(parseTable(tableInner(markup)));

  const blocks: RichBlock[] = [];
  let runs: RichRun[] = [];
  let style: InlineStyle = { ...PLAIN };
  const styleStack: InlineStyle[] = [];
  let align: RichAlign | undefined;
  const alignStack: (RichAlign | undefined)[] = [];
  let indent = 0;
  const indentStack: number[] = [];
  let headingLevel = 0;
  const headingStack: number[] = [];
  let listDepth = 0;
  const listStack: { ordered: boolean; counter: number }[] = [];
  let marker: string | null = null;
  let kind: RichBlockKind = "paragraph";

  const flush = () => {
    // The runs are drained before the block is emitted. `normalizeRuns` builds a fresh array,
    // so clearing the accumulator here cannot disturb the block just pushed, and leaving it in
    // place would make every block carry the whole document up to that point.
    const collected = runs;
    runs = [];
    if (!collected.length) return; // nothing was emitted, so the marker is still owed to the text
    const normalized = normalizeRuns(collected);
    if (!normalized.length) return;
    // The marker belongs to the block it opens; consuming it here is what stops a nested block
    // tag from repeating the bullet on a continuation, and is why the empty flush above must
    // leave it alone: `<li><p>Wrapped item</p></li>` opens a paragraph before any text exists,
    // and an early clear there would drop the bullet entirely.
    const collectedMarker = marker;
    marker = null;
    blocks.push({
      kind: listDepth > 0 || collectedMarker !== null ? "listItem" : headingLevel > 0 ? "heading" : "paragraph",
      runs: normalized,
      align,
      level: headingLevel || 3,
      // `listDepth` counts the lists the item sits inside, so an item in a single top-level list
      // reports 1. The drawn indent is `depth * NEST_INDENT`, so a top-level bullet has to be 0
      // or the whole list starts one step in from the left margin.
      depth: Math.max(0, listDepth - 1),
      marker: collectedMarker,
      ordered: listStack[listDepth - 1]?.ordered ?? false,
    });
  };

  let cursor = 0;
  TAG_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG_PATTERN.exec(withPlaceholders))) {
    if (match.index > cursor) pushRun(runs, decodeEntities(withPlaceholders.slice(cursor, match.index)), style);
    cursor = match.index + match[0].length;

    const tag = match[1]!.toLowerCase();
    const attributes = match[2] ?? "";
    const closing = match[0]!.startsWith("</");
    const selfClosing = /\/\s*$/.test(attributes);

    if (tag === "table") {
      // The table itself was lifted out; this only sees the placeholder paragraph around it.
      continue;
    }

    if (tag === "br") {
      if (runs.length) pushRun(runs, "\n", style);
      continue;
    }
    if (tag === "hr") {
      flush();
      blocks.push({ kind: "rule", runs: [], level: 3, depth: 0, marker: null, ordered: false });
      continue;
    }
    if (tag === "img") {
      // Images inside authored prose are not laid out by the PDF writer, and the exam shell
      // already offers a first-class attachment slot for them, so the alt text is kept as a
      // caption rather than dropping the reference silently.
      const alt = /alt\s*=\s*"([^"]*)"/i.exec(attributes)?.[1];
      if (alt) pushRun(runs, decodeEntities(alt), { ...style, italic: true });
      continue;
    }

    if (closing) {
      if (tag === "strong" || tag === "b") style = styleStack.pop() ?? { ...PLAIN };
      else if (tag === "em" || tag === "i") style = styleStack.pop() ?? { ...PLAIN };
      else if (tag === "u" || tag === "ins") style = styleStack.pop() ?? { ...PLAIN };
      else if (tag === "s" || tag === "strike" || tag === "del") style = styleStack.pop() ?? { ...PLAIN };
      else if (tag === "ul" || tag === "ol") {
        flush();
        listStack.pop();
        listDepth = Math.max(0, listDepth - 1);
      } else if (tag === "li") flush();
      else if (/^h[1-6]$/.test(tag)) {
        flush();
        headingLevel = headingStack.pop() ?? 0;
      } else if (tag === "p" || tag === "div" || tag === "blockquote" || tag === "pre" || tag === "caption") {
        flush();
        align = alignStack.pop();
      } else if (BLOCK_TAGS.has(tag)) flush();
      continue;
    }

    // Opening tags.
    if (tag === "strong" || tag === "b") {
      styleStack.push({ ...style });
      style = { ...style, bold: true };
    } else if (tag === "em" || tag === "i") {
      styleStack.push({ ...style });
      style = { ...style, italic: true };
    } else if (tag === "u" || tag === "ins") {
      styleStack.push({ ...style });
      style = { ...style, underline: true };
    } else if (tag === "s" || tag === "strike" || tag === "del") {
      styleStack.push({ ...style });
      style = { ...style, strike: true };
    } else if (tag === "ul" || tag === "ol") {
      flush();
      if (tag === "ol") {
        const start = Number(/start\s*=\s*"?(\d+)/i.exec(attributes)?.[1] ?? 1);
        listStack.push({ ordered: true, counter: Number.isFinite(start) ? start - 1 : 0 });
      } else listStack.push({ ordered: false, counter: 0 });
      listDepth += 1;
    } else if (tag === "li") {
      flush();
      const parent = listStack[listDepth - 1];
      if (parent?.ordered) {
        parent.counter += 1;
        marker = `${parent.counter}.`;
      } else marker = listDepth > 1 ? "◦" : "•";
    } else if (/^h[1-6]$/.test(tag)) {
      flush();
      headingStack.push(headingLevel);
      headingLevel = Number(tag[1]);
    } else if (BLOCK_TAGS.has(tag)) {
      flush();
      alignStack.push(align);
      align = readAlign(attributes);
      indentStack.push(indent);
      indent = Math.max(indent, readIndent(attributes));
    }
    if (tag === "span" || tag === "font") {
      // A colour or a face is dropped rather than guessed at, but the emphasis a span carries
      // through its parent style is kept, so nothing an author wrapped is lost.
      const face = /face\s*=\s*"([^"]*)"/i.exec(attributes)?.[1];
      if (face && !style.bold && !style.italic && !style.underline) {
        styleStack.push({ ...style });
        style = { ...style, italic: true };
      }
    }
  }
  if (cursor < withPlaceholders.length) pushRun(runs, decodeEntities(withPlaceholders.slice(cursor)), style);
  flush();

  return blocks.map((block) => {
    if (block.runs.length === 1 && block.runs[0]!.text.startsWith("\u0000AFT_TABLE_")) {
      const placeholder = /^\u0000AFT_TABLE_(\d+)\u0000$/.exec(block.runs[0]!.text);
      const table = placeholder ? tables[Number(placeholder[1])] : undefined;
      if (table) {
        return { kind: "table" as const, runs: [], level: 3, depth: 0, marker: null, ordered: false, table };
      }
    }
    return block;
  });
}

/**
 * Collapses whitespace between words and strips the leading space of a block.
 *
 * Only the block's own two edges are trimmed. A run in the middle of the block keeps its edge
 * space, because that space *is* the gap between the word before it and the word after it: in
 * "Read the **instructions** carefully" the space belongs to the end of the plain run and the
 * start of the italic one. Trimming every run turned that sentence into
 * "Read theinstructionscarefully".
 */
function normalizeRuns(runs: RichRun[]): RichRun[] {
  const out: RichRun[] = [];
  for (const run of runs) {
    const text = run.text.replace(/[^\S\n]+/g, " ").replace(/ ?\n ?/g, "\n");
    pushRun(out, text, run);
  }
  if (out.length) {
    out[0]!.text = out[0]!.text.replace(/^[ \t\n\r]+/, "");
    const last = out.length - 1;
    out[last]!.text = out[last]!.text.replace(/[ \t\n\r]+$/, "");
  }
  // A run left holding nothing is dropped, which is also what discards the newline that sat
  // between two block elements: such a line is a separator in the markup, not a paragraph an
  // author wrote, and keeping it put an empty line on the page between every pair of blocks. A
  // run holding a single space is kept, because that space is the gap between two words.
  return out.filter((run) => run.text.length > 0);
}

/** Splits a table's inner HTML into rows of cells, each cell parsed into its own blocks. */
function parseTable(inner: string): RichTable {
  const rows: RichBlock[][][] = [];
  let headerRow = false;
  let rowIndex = 0;
  for (const row of splitElements(inner, "tr")) {
    const cells: RichBlock[][] = [];
    let sawHeader = false;
    for (const cell of splitElements(row.content, "th|td")) {
      if (cell.tag === "th") sawHeader = true;
      const parsed = parseRichHtml(cell.content).map((block) => ({
        ...block,
        align: block.align ?? readAlign(cell.attributes),
      }));
      cells.push(parsed.length ? parsed : [{ kind: "paragraph" as const, runs: [], level: 3, depth: 0, marker: null, ordered: false }]);
    }
    if (!cells.length) cells.push([]);
    if (rowIndex === 0 && sawHeader) headerRow = true;
    rows.push(cells);
    rowIndex += 1;
  }
  return { rows, headerRow };
}

type SplitElement = { tag: string; attributes: string; content: string };

/**
 * Splits a fragment into the elements named by `names`, keeping only the outermost ones.
 *
 * A regular expression cannot do this. A cell that holds a nested table has a `<td>` of its own
 * inside it, and `<td>([\s\S]*?)<\/td>` would close on that inner tag and cut the outer cell in
 * half; the row above it has the same problem with `</tr>`. The nesting is counted instead, so a
 * table in a cell is carried intact and parsed in the cell's own right.
 */
function splitElements(inner: string, names: string): SplitElement[] {
  const found: SplitElement[] = [];
  const pattern = new RegExp(`<(/?)(${names})\\b([^>]*)>`, "gi");
  let match: RegExpExecArray | null;
  let depth = 0;
  let tag = "";
  let attributes = "";
  let contentStart = 0;
  while ((match = pattern.exec(inner))) {
    if (match[1] === "/") {
      depth -= 1;
      if (depth <= 0) {
        depth = 0;
        found.push({ tag, attributes, content: inner.slice(contentStart, match.index) });
      }
      continue;
    }
    if (depth === 0) {
      tag = match[2]!.toLowerCase();
      attributes = match[3] ?? "";
      contentStart = match.index + match[0].length;
    }
    depth += 1;
  }
  return found;
}

/* ------------------------------------------------------------------ *
 * Reading rich text back out
 * ------------------------------------------------------------------ */

/** The visible text of a block list, for previews, search and word counts. */
export function richTextToPlainText(source: string | null | undefined): string {
  return parseRichHtml(source)
    .map((block) => (block.table ? tableToText(block.table) : block.runs.map((run) => run.text).join("")))
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function tableToText(table: RichTable): string {
  return table.rows
    .map((row) => row.map((cell) => cell.map((block) => block.runs.map((run) => run.text).join("")).join(" ")).join(" | "))
    .join("\n");
}

/** True when the content carries anything beyond plain text, i.e. it needs a rich renderer. */
export function hasRichMarkup(source: string | null | undefined): boolean {
  return /<(table|ul|ol|strong|b|em|i|u|p|div|h[1-6]|br|hr|span|s)\b/i.test(source ?? "");
}

/**
 * The number of words a learner actually wrote.
 *
 * Counted from the visible text rather than the stored markup, so emphasis tags and table cells are
 * not counted as words. This is the number shown against an exam answer and stored beside it, so it
 * has to mean the same thing everywhere it is used.
 */
export function richTextWordCount(source: string | null | undefined): number {
  const text = richTextToPlainText(source);
  return text ? text.split(/\s+/).length : 0;
}

export { escapeHtml, escapeForRegex, ENTITIES, VOID_TAGS, ALLOWED_TAGS };
