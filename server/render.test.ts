import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateBrandedPrintablePdf } from "./pdf";

describe("render", () => {
  it("writes a sample", async () => {
    const bytes = await generateBrandedPrintablePdf(
      {
        title: "Cartn Mock Exam 4",
        intro:
          "<h2>Instructions</h2><p>Answer all tasks.</p><table><tr><th>Section</th><th>Marks</th></tr><tr><td>Task 1</td><td>20</td></tr><tr><td>Task 2</td><td>30</td></tr><tr><td>Task 3 with a longer label that wraps onto another line</td><td>50</td></tr></table>",
        totalDurationSeconds: 5400,
      },
      [
        {
          sectionNumber: 1,
          title: "Delivery economics",
          durationSeconds: 2700,
          introduction:
            "Assess the decision.<table><tr><th>Quarter</th><th>Volume</th><th>Cost</th></tr><tr><td>Q1</td><td>100</td><td>4</td></tr><tr><td>Q2</td><td>120</td><td>5</td></tr></table>",
        },
      ]
    );
    expect(Buffer.from(bytes).subarray(0, 5).toString("latin1")).toBe("%PDF-");
    writeFileSync(join(tmpdir(), "aft-table-sample.pdf"), bytes);
  });
});
