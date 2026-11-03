"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { action } from "@/components/employers/vacancy-fields";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const rowId = (id: string) => `row-${id}`;

// What is open on a page lives in the URL, so the Back gesture closes it and the menu link returns to the list.
export function useUrlValue(name: string): [string | null, (value: string | null) => void] {
  const params = useSearchParams();
  function set(value: string | null) {
    const next = new URLSearchParams(window.location.search);
    if (value === null) next.delete(name);
    else next.set(name, value);
    // Next keeps useSearchParams in step with the History API, with no call to the server.
    window.history.pushState(null, "", `${window.location.pathname}${next.size > 0 ? `?${next}` : ""}`);
  }
  return [params.get(name), set];
}

// The row that is open. Focus follows it: to the detail's title when a row opens, and back to the row when it closes.
export function useOpenRow(name: string) {
  const [open, setOpen] = useUrlValue(name);
  const title = useRef<HTMLHeadingElement>(null);
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (open) title.current?.focus();
    else if (last.current) document.getElementById(rowId(last.current))?.focus();
    last.current = open;
  }, [open]);
  return { open, setOpen, title };
}

// A list and its detail. Side by side on a computer. On a phone the list comes first and a row opens the detail.
export function ListDetail({ open, backLabel, onBack, list, children }: { open: boolean; backLabel: string; onBack: () => void; list: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className={cn("min-w-0 flex-[1_1_13rem]", open && "hidden lg:block")}>{list}</div>
      <div className={cn("min-w-0 flex-[2_1_20rem] flex-col gap-3", open ? "flex" : "hidden lg:flex")}>
        <Button variant="ghost" className={`${action} w-fit gap-2 px-2 font-normal underline underline-offset-4 lg:hidden`} onClick={onBack}>
          <ArrowLeft aria-hidden className="size-5" />
          {backLabel}
        </Button>
        {children}
      </div>
    </div>
  );
}

// selected shows on a computer, where a detail is always in view. Current is only said once a row was really opened.
export function ListRow({ id, selected, open, onOpen, className, children }: { id: string; selected: boolean; open: boolean; onOpen: () => void; className?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      id={rowId(id)}
      aria-current={selected && open ? "true" : undefined}
      onClick={onOpen}
      className={cn("flex min-h-13 w-full gap-3 rounded-lg border bg-card px-4 py-2 text-left hover:bg-secondary", selected && "lg:border-primary lg:bg-secondary lg:font-semibold", className)}
    >
      {children}
    </button>
  );
}
