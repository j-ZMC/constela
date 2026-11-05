"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, CalendarClock, ChevronRight, Ear, Footprints, ListOrdered, MousePointerClick, SunDim, type LucideIcon } from "lucide-react";
import { optionRow } from "@/components/profile/question-step";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { HELP, NEURO_TYPES, NEURO_TYPE_IDS, applyHelp, describeVisual, removeHelp, type NeuroType } from "@/lib/help-picks";
import { applyPrefs, loadPrefs } from "@/lib/personalization";

// OpenDyslexic is a class on <html> (the Settings panel switches it the same way).
const setDyslexic = (on: boolean) => document.documentElement.classList.toggle("dyslexic", on);

const action = "h-11 px-5 text-base";
// A pictogram for each pick, so each one can be found without reading.
const ICONS: Record<string, LucideIcon> = {
  reading: BookOpen,
  unclear: ListOrdered,
  starting: Footprints,
  changes: CalendarClock,
  screen: SunDim,
  precision: MousePointerClick,
  speech: Ear,
};

// The first thing in the Profile: adaptability. Every pick is optional, and "Decide later" skips all.
// Shortcuts by type turn on screen settings directly; which ones were chosen is passed on once and never kept.
// onBack: shows Back and Skip, like a question in a flow. required: the first start of the app; there is no way
// around it, and at least one pick or shortcut turns on "Turn on this help".
export function HelpPicks({
  initial,
  onDone,
  onBack,
  onSkip,
  required = false,
}: {
  initial: readonly string[];
  onDone: (picks: string[], types: NeuroType[]) => void;
  onBack?: () => void;
  onSkip?: () => void; // "Decide later": leaves what is saved as it is
  required?: boolean;
}) {
  const [picks, setPicks] = useState<string[]>([...initial]);
  const [types, setTypes] = useState<NeuroType[]>([]);

  // A live preview: what is ticked changes the page right away (font, size, dark screen, bigger buttons...).
  // Nothing is saved until "Turn on this help"; anything else (untick, "Decide later", leaving) puts it back.
  // Previews start from what is saved now, and leaving puts back what is saved, so two of these on screen at once
  // (the first-start window over the Profile tab) never undo each other.
  const wasDyslexic = useRef(document.documentElement.classList.contains("dyslexic"));
  const kept = useRef(false);
  useEffect(() => {
    // Saved picks that are now unticked come off the preview too.
    const base = removeHelp(initial.filter((id) => !picks.includes(id)), {}, loadPrefs()).prefs;
    const preview = applyHelp(picks, {}, base, types).prefs;
    applyPrefs(preview);
    // The class can also be on from the Reading panel, without the font in the saved settings; that stays.
    setDyslexic(preview.font === "dyslexic" || (wasDyslexic.current && loadPrefs().font !== "dyslexic"));
  }, [initial, picks, types]);
  useEffect(
    () => () => {
      if (kept.current) return;
      const saved = loadPrefs();
      applyPrefs(saved);
      setDyslexic(wasDyslexic.current || saved.font === "dyslexic");
    },
    [],
  );
  const previewing = picks.length > 0 || types.length > 0;
  // In the Profile, unticking everything that was saved is a real answer: no help.
  const turningOff = !previewing && initial.length > 0;

  return (
    <section aria-labelledby="help-picks-heading" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 id="help-picks-heading" className="text-2xl font-semibold text-balance">
          What would help you adapt?
        </h2>
        <p role="status" className={previewing ? "rounded-lg bg-secondary px-3 py-2 text-sm" : "sr-only"}>
          {previewing ? "You are seeing a preview of the page with this help. Press Turn on this help to keep it." : ""}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {HELP.map((h) => {
          const Icon = ICONS[h.id];
          return (
            <label key={h.id} className={optionRow}>
              <Checkbox
                checked={picks.includes(h.id)}
                onCheckedChange={(on) => setPicks(on ? [...picks, h.id] : picks.filter((p) => p !== h.id))}
              />
              <Icon aria-hidden className="size-6 shrink-0 text-primary" />
              <span className="flex flex-col">
                <span className="font-medium">{h.hard}</span>
                <span className="text-sm text-muted-foreground">
                  <span className="font-medium">What it does:</span> {h.help}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      <details className="group rounded-xl border bg-card p-4">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-medium">
          <ChevronRight aria-hidden className="size-4 shrink-0 transition-transform group-open:rotate-90" />
          Shortcuts by type (optional)
        </summary>
        <p className="mt-2 text-sm text-pretty text-muted-foreground">
          Turn on the screen settings that many people with these find helpful. We do not save which ones you choose,
          only the settings.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {NEURO_TYPE_IDS.map((id) => (
            <label key={id} className={optionRow}>
              <Checkbox
                checked={types.includes(id)}
                onCheckedChange={(on) => setTypes(on ? [...types, id] : types.filter((t) => t !== id))}
              />
              <span className="flex flex-col">
                <span className="font-medium">{NEURO_TYPES[id].label}</span>
                <span className="text-sm text-muted-foreground">{describeVisual(NEURO_TYPES[id].prefs)}</span>
              </span>
            </label>
          ))}
        </div>
      </details>

      <div className="flex flex-wrap gap-3">
        <Button
          className={action}
          disabled={!previewing && !turningOff}
          onClick={() => {
            kept.current = true;
            onDone(picks, types);
          }}
        >
          {turningOff ? "Turn off all help" : "Turn on this help"}
        </Button>
        {onSkip && (
          <Button className={action} variant="outline" onClick={onSkip}>
            {onBack ? "Skip" : "Decide later"}
          </Button>
        )}
        {required && !previewing && <p className="self-center text-sm text-muted-foreground">Choose at least one to start.</p>}
        {onBack && (
          <Button className={action} variant="ghost" onClick={onBack}>
            Back
          </Button>
        )}
      </div>
    </section>
  );
}
