import { useEffect, useRef, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Columns3, Rows3, Table2, Trash2 } from "lucide-react";
import { type AuthoredTable } from "@shared/authoredTable";

/**
 * A table edited the way a word processor presents one: a grid of boxes, with the structural
 * controls an author actually reaches for.
 *
 * The grid is a controlled model of plain cell text. The parent turns it into `<table>` markup with
 * `serializeAuthoredTable`, which is the same markup the exam shell renders and the printable PDF
 * lays out, so this component never deals in HTML itself.
 */
export function TableEditor({ table, onChange, onRemove, onCellFocus }: {
  table: AuthoredTable;
  onChange: (table: AuthoredTable) => void;
  onRemove: () => void;
  /** Reports that the caret has moved into a cell, so a surrounding field can stand down. */
  onCellFocus?: () => void;
}) {
  const width = Math.max(1, ...table.rows.map((row) => row.length));
  // A grid with no rows still needs a row to type into, otherwise add/delete has nothing to act on.
  const rows = table.rows.length ? table.rows : [Array<string>(width).fill("")];
  // With a header row, row 0 holds the headings and the editable body starts after it.
  const bodyStart = table.headerRow ? 1 : 0;

  const setCell = (row: number, column: number, value: string) => {
    onChange({
      ...table,
      rows: rows.map((current, rowIndex) =>
        rowIndex === row
          ? Array.from({ length: width }, (_, columnIndex) => (columnIndex === column ? value : (current[columnIndex] ?? "")))
          : current
      ),
    });
  };

  const addRow = () => onChange({ ...table, rows: [...rows, Array<string>(width).fill("")] });

  const addColumn = () => onChange({ ...table, rows: rows.map((row) => [...row, ""]) });

  const removeRow = (row: number) => {
    // A heading row is demoted by turning the header off, not deleted, so a table with a header
    // always keeps one row of headings.
    if (table.headerRow && row === 0) return;
    onChange({ ...table, rows: rows.filter((_, index) => index !== row) });
  };

  const removeColumn = (column: number) => {
    // Deleting the last column would leave nothing to type into, so the grid keeps at least one.
    if (width <= 1) return;
    onChange({ ...table, rows: rows.map((row) => row.filter((_, index) => index !== column)) });
  };

  const moveRow = (row: number, delta: number) => {
    const target = row + delta;
    // The heading row is pinned in place and body rows cannot be swapped through it.
    if (target < bodyStart || target >= rows.length) return;
    const next = rows.slice();
    [next[row], next[target]] = [next[target]!, next[row]!];
    onChange({ ...table, rows: next });
  };

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-[#00e5ff]/30 bg-[#0c0524]/60">
      <div className="flex flex-wrap items-center gap-1 border-b border-white/10 bg-white/[0.03] px-2 py-1.5">
        <span className="flex items-center gap-1 text-[11px] font-semibold text-[#c4b5fd]">
          <Table2 className="h-3.5 w-3.5 text-[#00e5ff]" />
          Table
        </span>
        <ChipButton icon={<Rows3 className="h-3.5 w-3.5" />} label="Add row" onClick={addRow} />
        <ChipButton icon={<Columns3 className="h-3.5 w-3.5" />} label="Add column" onClick={addColumn} />
        <button
          type="button"
          aria-pressed={table.headerRow}
          onClick={() => onChange({ ...table, headerRow: !table.headerRow })}
          className="inline-flex h-7 items-center rounded-md border border-white/10 bg-white/5 px-2 text-[11px] text-white/80 transition hover:border-[#00ff88]/50 hover:text-[#00ff88]"
        >
          Heading row: {table.headerRow ? "on" : "off"}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto inline-flex h-7 items-center gap-1 rounded-md border border-[#ff6b6b]/30 bg-[#ff6b6b]/10 px-2 text-[11px] text-[#ff9b9b] transition hover:border-[#ff6b6b]/60"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Remove table
        </button>
      </div>

      <div className="overflow-x-auto p-2">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {/* Column handles, the way a spreadsheet labels its columns. Always shown, so a column
                can be removed whether or not the table has a heading row. */}
            <tr>
              <th className="w-8 border border-white/10 bg-white/[0.04]" />
              {Array.from({ length: width }, (_, column) => (
                <th key={column} className="border border-white/10 bg-white/[0.04] p-0 align-middle">
                  <div className="flex items-center justify-between gap-1 px-2 py-0.5">
                    <span className="truncate text-[10px] font-normal text-white/40">Column {column + 1}</span>
                    <IconButton label={`Delete column ${column + 1}`} onClick={() => removeColumn(column)}>
                      <Trash2 className="h-3 w-3" />
                    </IconButton>
                  </div>
                </th>
              ))}
              <th className="w-8 border border-white/10 bg-white/[0.04] p-0 align-middle">
                <div className="flex justify-center py-0.5">
                  <IconButton label="Add column" onClick={addColumn}>
                    <Columns3 className="h-3 w-3" />
                  </IconButton>
                </div>
              </th>
            </tr>

            {table.headerRow && (
              <tr>
                <th className="w-8 border border-white/10 bg-[#00e5ff]/10" />
                {Array.from({ length: width }, (_, column) => (
                  <th key={column} className="border border-white/10 bg-[#00e5ff]/10 p-0 align-top">
                    <Cell
                      value={rows[0]?.[column] ?? ""}
                      label={`Heading ${column + 1}`}
                      onFocus={onCellFocus}
                      emphasis
                      onChange={(value) => setCell(0, column, value)}
                    />
                  </th>
                ))}
                <th className="w-8 border border-white/10 bg-[#00e5ff]/10" />
              </tr>
            )}

            {Array.from({ length: Math.max(0, rows.length - bodyStart) }, (_, index) => index + bodyStart).map((row) => (
              <tr key={row}>
                <th className="border border-white/10 bg-white/[0.04] p-0 align-middle">
                  <div className="flex flex-col items-center gap-0.5 p-0.5">
                    <IconButton label="Move row up" disabled={row <= bodyStart} onClick={() => moveRow(row, -1)}>
                      <ArrowUp className="h-3 w-3" />
                    </IconButton>
                    <IconButton label="Move row down" disabled={row === rows.length - 1} onClick={() => moveRow(row, 1)}>
                      <ArrowDown className="h-3 w-3" />
                    </IconButton>
                    <IconButton label="Delete row" onClick={() => removeRow(row)}>
                      <Trash2 className="h-3 w-3" />
                    </IconButton>
                  </div>
                </th>
                {Array.from({ length: width }, (_, column) => (
                  <td key={column} className="border border-white/10 p-0 align-top">
                    <Cell
                      value={rows[row]?.[column] ?? ""}
                      label={`Row ${row + 1} column ${column + 1}`}
                      onFocus={onCellFocus}
                      onChange={(value) => setCell(row, column, value)}
                    />
                  </td>
                ))}
                <td className="w-8 border border-white/10" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="border-t border-white/10 px-2 py-1 text-[10px] leading-4 text-white/40">
        Click a box and type. The arrows beside a row move it, the bin beside a row or a column
        removes it, and **bold** or *italic* works inside a box.
      </p>
    </div>
  );
}

function ChipButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-7 items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 text-[11px] text-white/80 transition hover:border-[#00ff88]/50 hover:text-[#00ff88]"
    >
      {icon}
      {label}
    </button>
  );
}

function IconButton({ label, onClick, disabled, children }: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-5 w-5 items-center justify-center rounded text-white/40 transition hover:bg-white/10 hover:text-[#00ff88] disabled:pointer-events-none disabled:opacity-25"
    >
      {children}
    </button>
  );
}

/**
 * One box in the grid. A textarea rather than an input so a long answer wraps the way it does in a
 * word processor, and grown to fit its content so a row never has to be scrolled sideways.
 */
function Cell({ value, onChange, label, onFocus, emphasis }: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  onFocus?: () => void;
  emphasis?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      aria-label={label}
      placeholder="Type here"
      onFocus={onFocus}
      onChange={(event) => onChange(event.target.value)}
      className={`block w-full resize-none border-0 bg-transparent px-2 py-1.5 text-sm text-white outline-none placeholder:text-white/20 focus:bg-[#00e5ff]/5 ${emphasis ? "font-semibold" : ""}`}
    />
  );
}

/** A blank table of the given size, used when an author inserts one. */
export function emptyTable(rows: number, columns: number): AuthoredTable {
  return {
    headerRow: true,
    rows: [
      Array.from({ length: columns }, (_, column) => `Column ${column + 1}`),
      ...Array.from({ length: rows }, () => Array<string>(columns).fill("")),
    ],
  };
}
