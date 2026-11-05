"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/lib/use-hydrated";

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
  window.dispatchEvent(new Event(CHANGE));
}

const CHANGE = "tour-change";

const HIGHLIGHT = ["ring-4", "ring-star", "ring-offset-4", "ring-offset-background", "rounded-2xl"];

// A short guided look at a screen: one part at a time, highlighted in place, with Next, Back and Skip.
// Not a blocking modal: the page stays usable, and Esc or Skip closes it. Parts missing on screen are skipped.
// next: the first-time tour goes on to another page (My plan, then Jobs, then Preparation) instead of ending.
type Next = { label: string; href: string };
export function Tour({ name, steps, onClose, next }: { name: string; steps: TourStep[]; onClose: () => void; next?: Next }) {
  const router = useRouter();
  // Look for the parts once the page has painted: on a first visit they mount in the same pass as the tour.
  const [shown, setShown] = useState<TourStep[]>([]);
  useEffect(() => {
    // A timeout, not requestAnimationFrame: it also runs in a background tab, where frames are paused. Some pages
    // (Jobs) render their parts a moment later, so it looks again for up to 2 s.
    let tries = 0;
    let id = setTimeout(function find() {
      const found = steps.filter((s) => document.querySelector(`[data-tour="${s.target}"]`));
      if (found.length || ++tries > 20) setShown(found);
      else id = setTimeout(find, 100);
    });
    return () => clearTimeout(id);
  }, [steps]);
  const [i, setI] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const step = shown[i];

  function close() {
    markSeen(name);
    onClose();
  }

  useEffect(() => {
    if (!step) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    el?.classList.add(...HIGHLIGHT);
    // Scroll only when the part starts off screen or under the panel, so a page that fits (My plan on a computer)
    // stays still. Then a plain jump toward the top (no smooth scroll), so the panel never covers the part.
    const top = el?.getBoundingClientRect().top ?? 0;
    const room = (panel.current?.getBoundingClientRect().top ?? window.innerHeight) - 40;
    if (top < 0 || top > room) el?.scrollIntoView({ block: "start" });
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
      ref={panel}
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
        <Button
          className="h-11 bg-white px-5 text-base text-sky hover:bg-white/90"
          onClick={() => {
            if (!last) return setI(i + 1);
            close();
            if (next) router.push(next.href);
          }}
        >
          {last ? (next?.label ?? "Got it") : "Next"}
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

// A page's tour on its first visit, for pages that have no "How this works" button of their own. It goes on to the
// next page's tour only while that one has not been seen, so the first-time tour runs My plan, Jobs, Preparation.
export function FirstVisitTour({ name, steps, next }: { name: string; steps: TourStep[]; next?: Next & { tour: string } }) {
  return useHydrated() ? <FirstVisit name={name} steps={steps} next={next} /> : null;
}

function FirstVisit({ name, steps, next }: { name: string; steps: TourStep[]; next?: Next & { tour: string } }) {
  const [open, setOpen] = useState(() => !tourSeen(name));
  const [goOn] = useState(() => next && !tourSeen(next.tour));
  return open ? <Tour name={name} steps={steps} next={goOn ? next : undefined} onClose={() => setOpen(false)} /> : null;
}

// Whether the setup is still going: until the tour of My plan is done (or skipped), the end of the Profile leads on to
// My plan, and the menu keeps the other pages for after.
export const onboarding = () => !tourSeen("plan");
function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onChange); // another tab
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}
// The same, for the menu: it changes as soon as the tour of My plan closes. False on the server.
export const useOnboarding = () => useSyncExternalStore(subscribe, onboarding, () => false);
