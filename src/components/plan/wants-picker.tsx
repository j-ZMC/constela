"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_WANTS, WANTS, loadWants, saveWants, toggleWant } from "@/lib/wants";

// The step "Choose 3 things you want in a job", done right in its card: pick, save, and the step is done.
// Rendered inside the hydrated plan, so reading storage on the first render is safe.
export function WantsPicker({ onSave }: { onSave: () => void }) {
  const [chosen, setChosen] = useState(loadWants);
  const full = chosen.length === MAX_WANTS;

  return (
    <div className="flex flex-col gap-4">
      <ul aria-label="Things you want in a job" className="flex flex-wrap gap-2">
        {WANTS.map((w) => {
          const on = chosen.includes(w.id);
          return (
            <li key={w.id}>
              <Button
                type="button"
                size="touch"
                variant={on ? "default" : "outline"}
                aria-pressed={on}
                // A fourth can't be added; it stays focusable so the hint below explains why.
                aria-disabled={!on && full}
                className={!on && full ? "opacity-50" : undefined}
                onClick={() => setChosen((c) => toggleWant(c, w.id))}
              >
                {on && <Check aria-hidden data-icon="inline-start" />}
                {w.label}
              </Button>
            </li>
          );
        })}
      </ul>
      <p role="status" className="text-muted-foreground">
        {full ? "You chose 3. Remove one to pick another." : `${chosen.length} of ${MAX_WANTS} chosen.`}
      </p>
      <Button
        size="touch"
        className="w-fit"
        disabled={chosen.length === 0}
        onClick={() => {
          saveWants(chosen);
          onSave();
        }}
      >
        Save my choices
      </Button>
    </div>
  );
}
