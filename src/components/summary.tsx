"use client";

import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { loadProfile, toAdaptations } from "@/lib/profile";
import { useHydrated } from "@/lib/use-hydrated";

// summaryMode from the profile ("Short summaries", or long texts feel tiring or hard).
export function useSummaryMode(): boolean {
  const hydrated = useHydrated();
  return hydrated && toAdaptations(loadProfile() ?? {}).summaryMode;
}

// The first sentence of a short text, for places where a whole summary block would be too much.
export function firstSentence(text: string): string {
  const end = text.search(/[.?!](\s|$)/);
  return end === -1 ? text : text.slice(0, end + 1);
}

// Keeps the profile's promise "Texts start as short summaries. You can always read more."
// Everyone else sees the full text; before hydration the full text renders too, so nothing is ever hidden by mistake.
export function Summarized({ summary, children }: { summary: string; children: ReactNode }) {
  const summaryMode = useSummaryMode();
  const [more, setMore] = useState(false);
  const id = useId();
  if (!summaryMode) return <>{children}</>;
  return (
    <>
      <p className="text-lg">{summary}</p>
      <Button variant="outline" className="h-11 w-fit px-5 text-base" aria-expanded={more} aria-controls={id} onClick={() => setMore(!more)}>
        {more ? "Show less" : "Read more"}
      </Button>
      <div id={id} hidden={!more} className="flex flex-col gap-8">
        {children}
      </div>
    </>
  );
}
