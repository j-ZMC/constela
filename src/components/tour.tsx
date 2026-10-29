"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export type TourStep = { target: string; title: string; text: string };

// Which tours the person has seen, on this device only.
const KEY = "tour";

export function tourSeen(name: string): boolean {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}")[name] === true;
  } catch {
    return false;
  }
}

function markSeen(name: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...JSON.parse(localStorage.getItem(KEY) || "{}"), [name]: true }));
  } catch {
    // Without storage the tour may show again next visit; nothing else breaks.
  }
}

const HIGHLIGHT = ["ring-4", "ring-star", "ring-offset-4", "ring-offset-background", "rounded-2xl"];

// A short guided look at a screen: one part at a time, highlighted in place, with Next, Back and Skip.
// Not a blocking modal: the page stays usable, and Esc or Skip closes it. Parts missing on screen are skipped.
export function Tour({ name, steps, onClose }: { name: string; steps: TourStep[]; onClose: () => void }) {
  // Look for the parts once the page has painted: on a first visit they mount in the same pass as the tour.
  const [shown, setShown] = useState<TourStep[]>([]);
  useEffect(() => {
    // A timeout, not requestAnimationFrame: it also runs in a background tab, where frames are paused.
    const id = setTimeout(() => setShown(steps.filter((s) => document.querySelector(`[data-tour="${s.target}"]`))));
    return () => clearTimeout(id);
  }, [steps]);
  const [i, setI] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const step = shown[i];

  function close() {
    markSeen(name);
    onClose();
  }

  useEffect(() => {
    if (!step) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    el?.classList.add(...HIGHLIGHT);
    // A plain jump toward the top (no smooth scroll), so the panel at the bottom never covers the part it explains.
    el?.scrollIntoView({ block: "start" });
    heading.current?.focus();
    return () => el?.classList.remove(...HIGHLIGHT);
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!step) return null;
  const last = i === shown.length - 1;

  return (
    <div
      role="dialog"
      aria-labelledby="tour-title"
      aria-describedby="tour-text"
      className="fixed inset-x-4 bottom-24 z-20 mx-auto flex max-w-md flex-col gap-3 rounded-2xl bg-sky p-5 text-white shadow-[0_20px_50px_-15px_rgb(0_0_0/0.6)] lg:bottom-6"
    >
      <p className="text-sm text-white/75">
        Quick tour · {i + 1} of {shown.length}
      </p>
      <h2 id="tour-title" ref={heading} tabIndex={-1} className="text-xl font-semibold outline-none">
        {step.title}
      </h2>
      <p id="tour-text" className="text-pretty text-white/90">
        {step.text}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button className="h-11 bg-white px-5 text-base text-sky hover:bg-white/90" onClick={() => (last ? close() : setI(i + 1))}>
          {last ? "Got it" : "Next"}
        </Button>
        {i > 0 && (
          <Button variant="ghost" className="h-11 px-4 text-base text-white hover:bg-white/10 hover:text-white" onClick={() => setI(i - 1)}>
            Back
          </Button>
        )}
        {!last && (
          <Button variant="ghost" className="ml-auto h-11 px-4 text-base text-white/80 hover:bg-white/10 hover:text-white" onClick={close}>
            Skip tour
          </Button>
        )}
      </div>
    </div>
  );
}
