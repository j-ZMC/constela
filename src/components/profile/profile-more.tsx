"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

// The optional parts of Profile, closed by default so "Go to my plan" stays the one next step.
// Rendered only after hydration (inside ProfileFlow), so reading the URL hash here is safe.
export function ProfileMore({ children }: { children: ReactNode }) {
  // "Add my CV" on Jobs links to /profile#cv: arrive with it open.
  const [open] = useState(() => window.location.hash === "#cv");
  return (
    <details data-tour="profile-more" open={open} className="group rounded-xl border bg-card">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 p-5">
        <ChevronRight aria-hidden className="size-5 shrink-0 transition-transform group-open:rotate-90" />
        <span className="flex flex-col">
          <span className="text-lg font-semibold">Add more, if you want</span>
          <span className="text-muted-foreground">Things to point out at work, your CV and your details. All optional.</span>
        </span>
      </summary>
      <div className="flex flex-col gap-10 border-t p-5">{children}</div>
    </details>
  );
}
