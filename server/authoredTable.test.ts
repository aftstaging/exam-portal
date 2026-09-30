import { describe, expect, it } from "vitest";
import {
  authoredCellText,
  parseAuthoredTable,
  serializeAuthoredTable,
  splitAuthoredContent,
  joinAuthoredContent,
  type AuthoredTable,
} from "@shared/authoredTable";

/**
 * The exam studio edits tables as a grid, but the exam shell and the printable PDF both read the
 * stored `<table>` markup directly. These tests pin the conversion in both directions: whatever an
 * instructor types into a cell has to survive being written out to markup and read back, and
 * whatever markup already exists in a saved exam has to survive being opened in the grid.
 */
describe("authored tables", () => {
  describe("authoredCellText", () => {
    it("strips tags and decodes entities", () => {
      expect(authoredCellText("Marks &amp; notes")).toBe("Marks & notes");
      expect(authoredCellText('<span class="x">Plain</span>')).toBe("Plain");
    });

    it("converts inline emphasis into the markers the prose fields use", () => {
      expect(authoredCellText("<strong>Total</strong>")).toBe("**Total**");
      expect(authoredCellText("<b>Total</b>")).toBe("**Total**");
      expect(authoredCellText("<em>optional</em>")).toBe("*optional*");
      expect(authoredCellText("<i>optional</i>")).toBe("*optional*");
    });

    it("flattens a line break to a space, because a cell is edited on one line", () => {
      expect(authoredCellText("first<br>second")).toBe("first second");
      expect(authoredCellText("first<br/>second")).toBe("first second");
    });
  });

  describe("parseAuthoredTable", () => {
    it("reads a header row and body rows into the grid", () => {
      const table = parseAuthoredTable(
        "<table><thead><tr><th>Question</th><th>Marks</th></tr></thead><tbody><tr><td>Alpha</td><td>5</td></tr></tbody></table>"
      );
      expect(table).toEqual({
        headerRow: true,
        rows: [
          ["Question", "Marks"],
          ["Alpha", "5"],
        ],
      });
    });

    it("reports a table with no header row", () => {
      const table = parseAuthoredTable("<table><tr><td>a</td><td>b</td></tr></table>");
      expect(table?.headerRow).toBe(false);
      expect(table?.rows).toEqual([["a", "b"]]);
    });

    it("keeps emphasis from previously authored markup", () => {
      const table = parseAuthoredTable("<table><tr><th><strong>Question</strong></th></tr><tr><td>a</td></tr></table>");
      expect(table?.rows[0]?.[0]).toBe("**Question**");
    });

    it("returns null when there is no table", () => {
      expect(parseAuthoredTable("just some text")).toBeNull();
      expect(parseAuthoredTable("")).toBeNull();
    });
  });

  describe("serializeAuthoredTable", () => {
    it("writes a header row when one is flagged", () => {
      const markup = serializeAuthoredTable({
        headerRow: true,
        rows: [
          ["Question", "Marks"],
          ["Alpha", "5"],
        ],
      });
      expect(markup).toContain("<thead>");
      expect(markup).toContain("<th>Question</th>");
      expect(markup).toContain("<td>Alpha</td>");
      expect(markup).not.toMatch(/<td>Question<\/td>/);
    });

    it("writes every row as a body row when no header is flagged", () => {
      const markup = serializeAuthoredTable({ headerRow: false, rows: [["a", "b"]] });
      expect(markup).not.toContain("<thead>");
      expect(markup).toContain("<td>a</td>");
    });

    it("pads a ragged grid out to a rectangle so the rendered table has no broken edges", () => {
      const markup = serializeAuthoredTable({
        headerRow: true,
        rows: [["a", "b", "c"], ["only one"], []],
      });
      const table = parseAuthoredTable(markup);
      expect(table?.rows.map((row) => row.length)).toEqual([3, 3, 3]);
    });

    it("converts emphasis markers into tags the PDF writer understands", () => {
      const markup = serializeAuthoredTable({ headerRow: false, rows: [["**bold** and *italic*"]] });
      expect(markup).toContain("<strong>bold</strong>");
      expect(markup).toContain("<em>italic</em>");
    });

    it("escapes authored text so a cell cannot inject markup", () => {
      const markup = serializeAuthoredTable({ headerRow: false, rows: [["<script>x</script> & more"]] });
      expect(markup).toContain("&lt;script&gt;");
      expect(markup).toContain("&amp;");
      expect(markup).not.toContain("<script>");
    });
  });

  it("round-trips a grid through markup without losing content or emphasis", () => {
    const table: AuthoredTable = {
      headerRow: true,
      rows: [
        ["Question", "Marks"],
        ["**Alpha**", "5 & 6"],
        ["Beta <b>", "*3*"],
      ],
    };
    expect(parseAuthoredTable(serializeAuthoredTable(table))).toEqual(table);
  });

  it("round-trips markup that already exists in a saved exam", () => {
    const markup = "<table>\n<thead>\n<tr><th>Q</th><th>M</th></tr>\n</thead>\n<tbody>\n<tr><td>One</td><td>2</td></tr>\n</tbody>\n</table>";
    const table = parseAuthoredTable(markup)!;
    expect(table.rows).toEqual([["Q", "M"], ["One", "2"]]);
    // Re-saving must not change what the exam shell or the PDF writer see.
    expect(parseAuthoredTable(serializeAuthoredTable(table))).toEqual(table);
  });

  describe("splitAuthoredContent", () => {
    it("returns no segments for an empty field", () => {
      expect(splitAuthoredContent("")).toEqual([]);
    });

    it("keeps prose with no table as a single segment", () => {
      expect(splitAuthoredContent("line one\n\nline two")).toEqual([
        { kind: "prose", value: "line one\n\nline two" },
      ]);
    });

    it("separates prose from a table, keeping the order", () => {
      const table = "<table><tr><td>a</td></tr></table>";
      expect(splitAuthoredContent(`before\n\n${table}\n\nafter`)).toEqual([
        { kind: "prose", value: "before\n\n" },
        { kind: "table", markup: table },
        { kind: "prose", value: "\n\nafter" },
      ]);
    });

    it("handles several tables and a table at either end", () => {
      const table = "<table><tr><td>x</td></tr></table>";
      const value = `${table}\nmiddle\n${table}`;
      expect(splitAuthoredContent(value).filter((segment) => segment.kind === "table")).toHaveLength(2);
      expect(splitAuthoredContent(value)[0]?.kind).toBe("table");
    });
  });

  it("joining split content reproduces the field exactly, tables included", () => {
    const table = "<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>b</td></tr></tbody></table>";
    for (const value of ["", "plain text", `lead\n\n${table}`, `${table}\ntail`, `${table}\n\n${table}`, `a${table}b`]) {
      expect(joinAuthoredContent(splitAuthoredContent(value))).toBe(value);
    }
  });
});
