"use client";

import { useState } from "react";
import { HelpPicks } from "@/components/profile/help-picks";
import { Loading } from "@/components/loading";
import { applyHelp, loadHelpPicks, saveHelpPicks, type NeuroType } from "@/lib/help-picks";
import { applyPrefs, loadPrefs, savePrefs } from "@/lib/personalization";
import { loadProfile, saveProfile } from "@/lib/profile";
import { setReadingOption } from "@/lib/reading";
import { useHydrated } from "@/lib/use-hydrated";

// "Your needs" in the Profile: "What is hard for you?". Each pick turns on screen settings (seen as a live preview)
// and the matching adaptations (summaries, one step at a time, heads-ups), which the rest of the app reads through
// toAdaptations(). Saved picks show ticked, so the person can come back and change them.
// Saved answers live in localStorage, which the server can't see, so this renders only after hydration.
export function ProfileFlow({ onNext }: { onNext: () => void }) {
  return useHydrated() ? <Needs onNext={onNext} /> : <Loading />;
}

function Needs({ onNext }: { onNext: () => void }) {
  // A new key after saving starts the form again from what is now saved, so its preview has a fresh "before".
  const [round, setRound] = useState(0);

  function turnOn(picks: string[], types: NeuroType[]) {
    const next = applyHelp(picks, loadProfile() ?? {}, loadPrefs(), types);
    // OpenDyslexic is switched by the reading class on <html>, the same way the Settings panel does it.
    if (next.prefs.font === "dyslexic") setReadingOption("dyslexic", true);
    saveProfile(next.answers);
    savePrefs(next.prefs);
    applyPrefs(next.prefs);
    saveHelpPicks(picks);
  }

  return (
    <HelpPicks
      key={round}
      initial={loadHelpPicks() ?? []}
      onDone={(picks, types) => {
        if (picks.length || types.length) turnOn(picks, types);
        // "Decide later" the first time: asked, nothing chosen. Later it keeps what was chosen before.
        else if (loadHelpPicks() === null) saveHelpPicks([]);
        setRound((r) => r + 1);
        onNext();
      }}
    />
  );
}
