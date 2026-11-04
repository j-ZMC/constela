"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

// One quiet choice instead of a question about feelings: "make today's steps smaller". It is stored as a low-energy
// day, so the plan picks a short step and "Break it down for me" stays gentle. Nothing asks how the person feels.
export function EasierToday({ on, focus, onChange }: { on: boolean; focus: boolean; onChange: (on: boolean) => void }) {
  const button = useRef<HTMLButtonElement>(null);
  // The step card is replaced by a smaller step after a tap; keep keyboard and screen-reader users on this button.
  useEffect(() => {
    if (focus) button.current?.focus();
  }, [focus]);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {on && <p className="text-muted-foreground">Smaller steps today.</p>}
      <Button ref={button} variant="ghost" className="h-11 px-3 text-base text-muted-foreground" onClick={() => onChange(!on)}>
        {on ? "Back to my usual steps" : "Need an easier step today?"}
      </Button>
    </div>
  );
}
