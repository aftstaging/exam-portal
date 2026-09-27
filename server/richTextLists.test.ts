import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Authored email bodies are stored as HTML and rendered with dangerouslySetInnerHTML. That
 * makes two things load-bearing and easy to break silently:
 *
 *   1. the container must carry `aft-rich-text`, which re-applies the document semantics that
 *      Tailwind's preflight strips, and
 *   2. `.aft-rich-text` must restore list markers with the `list-style-type` longhand, because
 *      the `list-style` shorthand drops the marker type through the Tailwind v4 build and in
 *      Firefox/Safari.
 *
 * Both failures are invisible at authoring time — the bullets look right in the studio editor
 * and vanish in the learner's exam shell — so they are asserted here.
 */
const clientSrc = fileURLToPath(new URL("../client/src", import.meta.url));
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const tsxFiles = () =>
  walk(clientSrc)
    .filter((file) => file.endsWith(".tsx"))
    .map((file) => relative(repoRoot, file).replace(/\\/g, "/"))
    // components/ui holds third-party wrappers whose dangerouslySetInnerHTML payloads are
    // library-generated, not author-supplied rich text.
    .filter((file) => !file.startsWith("client/src/components/ui/"));

describe("rich text email rendering", () => {
  it("renders every author-supplied HTML body inside .aft-rich-text", () => {
    const offenders = tsxFiles().flatMap((file) =>
      readFileSync(join(repoRoot, file), "utf8")
        .split(/\r?\n/)
        .map((line, index) => ({ file, number: index + 1, line: line.trim() }))
        .filter(({ line }) => line.includes("dangerouslySetInnerHTML"))
        .filter(({ line }) => !line.includes("aft-rich-text"))
        .map(({ file, number, line }) => `${file}:${number} ${line}`),
    );
    expect(offenders).toEqual([]);
  });

  it("restores list markers on .aft-rich-text lists", () => {
    const css = readFileSync(join(clientSrc, "index.css"), "utf8");
    const rules = [...css.matchAll(/^\.aft-rich-text[^{]*\{([^}]*)\}/gm)].map((match) => match[1]);
    expect(rules.length).toBeGreaterThan(0);

    const markerRules = rules.filter((body) => /list-style-type/.test(body));
    expect(markerRules.length).toBeGreaterThan(0);
    expect(markerRules.some((body) => /list-style-type:\s*disc/.test(body))).toBe(true);
    expect(markerRules.some((body) => /list-style-type:\s*decimal/.test(body))).toBe(true);
  });

  it("never uses the list-style shorthand, which drops the marker type", () => {
    const files = [join(clientSrc, "index.css"), join(clientSrc, "components", "ExamStudio.tsx")];
    for (const file of files) {
      // The `list-style` shorthand resets unmentioned sub-properties to their initial value,
      // which drops the marker type. Comments are stripped so the explanation of the rule
      // does not read as a violation of it.
      const source = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      expect(
        source.match(/\blist-style\s*:/g) ?? [],
        `list-style shorthand in ${relative(repoRoot, file).replace(/\\/g, "/")} discards list-style-type`,
      ).toEqual([]);
    }
  });
});
