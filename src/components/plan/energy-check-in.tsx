"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Energy } from "@/lib/plan";

const CHOICES: { level: Energy; label: string }[] = [
  { level: "low", label: "Low energy" },
  { level: "stressed", label: "Stressed" },
  { level: "okay", label: "Okay" },
  { level: "good", label: "Good" },
];

const REPLIES: Record<Energy, string> = {
  low: "Small steps today. That still counts.",
  stressed: "One thing at a time. You've got this.",
  okay: "Thanks for checking in.",
  good: "Thanks for checking in.",
};

// Self-reported, one tap, skippable. The app never guesses feelings from what people write.
export function EnergyCheckIn({ onChoose }: { onChoose: (level: Energy | null) => void }) {
  // Lives on the step card as one quiet chip, so it adjusts the step without competing with it.
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="outline" className="h-11 w-fit rounded-full px-4 text-base" aria-expanded={false} onClick={() => setOpen(true)}>
        How are you feeling today?
      </Button>
    );
  }
  return (
    <section aria-labelledby="check-in" className="flex flex-col gap-2">
      <h3 id="check-in" className="font-medium">
        How are you feeling today?
      </h3>
      <div className="flex flex-wrap gap-2">
        {CHOICES.map((c) => (
          <Button key={c.level} variant="outline" className="h-11 rounded-full bg-card px-4 text-base" onClick={() => onChoose(c.level)}>
            {c.label}
          </Button>
        ))}
        <Button variant="ghost" className="h-11 px-3 text-base text-muted-foreground underline underline-offset-4" onClick={() => onChoose(null)}>
          Skip for today
        </Button>
      </div>
    </section>
  );
}

export function CheckInReply({ level, focus, onChange }: { level: Energy; focus: boolean; onChange: () => void }) {
  const reply = useRef<HTMLParagraphElement>(null);
  // The choice buttons are gone after a tap; land keyboard and screen-reader users on the reply.
  useEffect(() => {
    if (focus) reply.current?.focus();
  }, [focus]);
  return (
    <div className="flex flex-wrap items-center gap-x-3">
      <p ref={reply} tabIndex={-1} className="text-muted-foreground outline-none">
        {REPLIES[level]}
      </p>
      <Button variant="ghost" className="h-11 px-3" onClick={onChange} aria-label="Change how you feel today">
        Change
      </Button>
    </div>
  );
}
