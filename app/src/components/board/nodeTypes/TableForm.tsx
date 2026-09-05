"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { Components } from "react-markdown";
import type { TableForm as TableFormData } from "@/lib/ai/envelope";

const cellComponents: Components = {
  p: ({ children }) => <span>{children}</span>,
};

function Cell({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={cellComponents}>
      {text}
    </ReactMarkdown>
  );
}

/**
 * DOM/KaTeX table form (PRD v2 §5/§6) — for truth tables, sign charts, comparisons, systems of
 * equations. Cells render verbatim LaTeX/GFM, so there's no coordinate/sampling error surface
 * the way a hand-computed geometry scene has — strictly more accurate for tabular data.
 */
export function TableForm({ table }: { table: TableFormData }) {
  return (
    <div className="my-1.5 space-y-1">
      {table.caption && <p className="text-xs font-medium text-muted-foreground">{table.caption}</p>}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              {table.headers.map((h, i) => (
                <th key={i} className="px-2 py-1 font-medium">
                  <Cell text={h} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                {row.map((cell, j) => (
                  <td key={j} className="px-2 py-1">
                    <Cell text={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
