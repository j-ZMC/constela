"use client";

import { useState } from "react";
import { HelpPicks } from "@/components/profile/help-picks";
import { Loading } from "@/components/loading";
import { loadHelpPicks, saveHelpPicks, turnOnHelp } from "@/lib/help-picks";
import { useHydrated } from "@/lib/use-hydrated";

// "Your needs" in the Profile: "What would help you adapt?". Each pick turns on screen settings (seen as a live preview)
// and the matching adaptations (summaries, one step at a time, heads-ups), which the rest of the app reads through
// toAdaptations(). Saved picks show ticked, so the person can come back and change them.
// Saved answers live in localStorage, which the server can't see, so this renders only after hydration.
export function ProfileFlow({ onNext }: { onNext: () => void }) {
  return useHydrated() ? <Needs onNext={onNext} /> : <Loading />;
}

function Needs({ onNext }: { onNext: () => void }) {
  // A new key after saving starts the form again from what is now saved, so its preview has a fresh "before".
  const [round, setRound] = useState(0);

  return (
    <HelpPicks
      key={round}
      initial={loadHelpPicks() ?? []}
      onDone={(picks, types) => {
        if (picks.length || types.length) turnOnHelp(picks, types);
        // "Decide later" the first time: asked, nothing chosen. Later it keeps what was chosen before.
        else if (loadHelpPicks() === null) saveHelpPicks([]);
        setRound((r) => r + 1);
        onNext();
      }}
    />
  );
}
