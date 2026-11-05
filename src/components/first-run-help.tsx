"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { HelpPicks } from "@/components/profile/help-picks";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { loadHelpPicks, turnOnHelp } from "@/lib/help-picks";
import { useHydrated } from "@/lib/use-hydrated";

// The first start of the app (or after "Delete my data"): "What would help you adapt?" before anything else, on any page.
// It cannot be closed (no close button, Escape or click outside); choosing at least one pick or shortcut and pressing
// "Turn on this help" is the way in. Later it stays in Profile, Adaptability, to change.
export function FirstRunHelp() {
  const hydrated = useHydrated();
  // Employers are not the person looking for a job, and a seal check is one public page anyone can open from a link, so
  // neither asks "What would help you adapt?" first.
  const elsewhere = /^\/(employers|seal-check)(\/|$)/.test(usePathname());
  return hydrated && !elsewhere ? <FirstRun /> : null;
}

function FirstRun() {
  const [open, setOpen] = useState(() => loadHelpPicks() === null);
  if (!open) return null;
  return (
    <Dialog open onOpenChange={() => {}} disablePointerDismissal>
      <DialogContent showCloseButton={false} className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogTitle className="sr-only">Before you start</DialogTitle>
        <HelpPicks
          required
          initial={[]}
          onDone={(picks, types) => {
            turnOnHelp(picks, types);
            setOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
