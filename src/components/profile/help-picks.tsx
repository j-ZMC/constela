"use client";

import { useState } from "react";
import { BookOpen, CalendarClock, ChevronRight, Ear, Footprints, ListOrdered, MousePointerClick, SunDim, type LucideIcon } from "lucide-react";
import { optionRow } from "@/components/profile/question-step";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { HELP, NEURO_TYPES, NEURO_TYPE_IDS, describeVisual, type NeuroType } from "@/lib/help-picks";

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

// The first thing in the Profile: what is hard. Every pick is optional, and "Decide later" skips all.
// Shortcuts by type turn on screen settings directly; which ones were chosen is passed on once and never kept.
export function HelpPicks({ initial, onDone }: { initial: readonly string[]; onDone: (picks: string[], types: NeuroType[]) => void }) {
  const [picks, setPicks] = useState<string[]>([...initial]);
  const [types, setTypes] = useState<NeuroType[]>([]);
  return (
    <section aria-labelledby="help-picks-heading" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 id="help-picks-heading" className="text-2xl font-semibold text-balance">
          What is hard for you?
        </h2>
        <p className="text-pretty text-muted-foreground">
          Choose any. Each one turns on help in Constela. You can change it anytime in Profile and Settings.
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
                <span className="text-sm text-muted-foreground">{h.help}</span>
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
        <Button className={action} disabled={picks.length === 0 && types.length === 0} onClick={() => onDone(picks, types)}>
          Turn on this help
        </Button>
        <Button className={action} variant="outline" onClick={() => onDone([], [])}>
          Decide later
        </Button>
      </div>
    </section>
  );
}
