"use client";

import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

// Long lists (Jobs, Internships, Saved, Learn) show as separate cards, a page at a time, never one endless scroll.
// Jobs use MASONRY (cards keep their own height, like Pinterest); Learn uses a plain GRID of equal rows (like a shop).
export const CARD = "rounded-2xl border bg-card shadow-[0_1px_2px_rgb(36_59_83/0.05),0_8px_24px_-12px_rgb(36_59_83/0.12)]";
// Two columns while the filters take the side, three when the results have the whole width.
export const MASONRY = "columns-1 gap-4 sm:columns-2 [&>li]:mb-4 [&>li]:break-inside-avoid";
export const MASONRY_WIDE = "columns-1 gap-4 sm:columns-2 lg:columns-3 [&>li]:mb-4 [&>li]:break-inside-avoid";
export const GRID_WIDE = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";
// Filters (Jobs, Internships, Learn) open and close with one button. Open, they sit beside the results and push them
// over (above them on phones); closed, the results take the whole width.
export const sidebarLayout = (open: boolean) => (open ? "grid items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]" : "flex flex-col");
export const SIDEBAR = "flex flex-col gap-5 rounded-xl border bg-card p-4";

// One filter as a list of choices with how many results each leaves; a choice with none stays visible but cannot be picked.
export function FilterGroup<T extends string>({ id, label, value, options, onChange }: {
  id: string;
  label: string;
  value: T;
  options: [T, string, number][];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-labelledby={id} className="flex flex-col gap-1">
      <h3 id={id} className="px-3 text-sm font-semibold">{label}</h3>
      {options.map(([v, text, count]) => {
        const selected = value === v;
        return (
          <Button
            key={v}
            type="button"
            variant={selected ? "default" : "ghost"}
            aria-pressed={selected}
            disabled={count === 0 && !selected}
            onClick={() => onChange(v)}
            className="h-auto min-h-11 w-full justify-between gap-2 px-3 py-2 text-left text-sm font-normal whitespace-normal"
          >
            <span>{text}</span>
            <span className={selected ? "" : "text-muted-foreground"}>{count}</span>
          </Button>
        );
      })}
    </div>
  );
}

// The button that shows or hides the filter bar.
export function FiltersToggle({ open, chosen, onToggle }: { open: boolean; chosen: number; onToggle: () => void }) {
  return (
    <Button type="button" variant={open ? "secondary" : "outline"} className="h-11 px-4 text-base" aria-expanded={open} onClick={onToggle}>
      <SlidersHorizontal aria-hidden />
      {open ? "Hide filters" : `Filters${chosen ? ` (${chosen})` : ""}`}
    </Button>
  );
}
export const GRID = "grid gap-4 sm:grid-cols-2";

// The page numbers to show: always the first and last, and the ones around the current page. "…" fills the gaps.
export function pageNumbers(page: number, pages: number): (number | "…")[] {
  const out: (number | "…")[] = [];
  for (let n = 1; n <= pages; n++) {
    if (n === 1 || n === pages || Math.abs(n - page) <= 1) out.push(n);
    else if (out.at(-1) !== "…") out.push("…");
  }
  return out;
}

export const pageOf = <T,>(items: readonly T[], page: number, size: number) => items.slice((page - 1) * size, page * size);
export const pageCount = (items: number, size: number) => Math.max(1, Math.ceil(items / size));

export function Pager({ page, pages, onPage, label }: { page: number; pages: number; onPage: (page: number) => void; label: string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label={`${label}, pages`} className="flex flex-wrap items-center justify-center gap-2">
      <Button type="button" variant="outline" className="h-11 px-3 text-base" disabled={page === 1} onClick={() => onPage(page - 1)}>
        <ChevronLeft aria-hidden /> Previous
      </Button>
      {pageNumbers(page, pages).map((n, i) =>
        n === "…" ? (
          <span key={`gap-${i}`} aria-hidden className="px-1 text-muted-foreground">…</span>
        ) : (
          <Button
            key={n}
            type="button"
            variant={n === page ? "default" : "ghost"}
            aria-current={n === page ? "page" : undefined}
            aria-label={`Page ${n}`}
            className="size-11 text-base"
            onClick={() => onPage(n)}
          >
            {n}
          </Button>
        ),
      )}
      <Button type="button" variant="outline" className="h-11 px-3 text-base" disabled={page === pages} onClick={() => onPage(page + 1)}>
        Next <ChevronRight aria-hidden />
      </Button>
    </nav>
  );
}
