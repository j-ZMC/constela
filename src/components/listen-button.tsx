"use client";

import { useEffect, useState } from "react";
import { Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/lib/use-hydrated";

// Reads a text out loud with the browser's own voice: no service, no cost, nothing leaves the device.
// Shown when the profile asks for it (reading: "Listen out loud"). Hidden where the browser has no voice.
export function ListenButton({ text, label = "Listen" }: { text: string; label?: string }) {
  const ready = useHydrated() && typeof window !== "undefined" && "speechSynthesis" in window;
  const [speaking, setSpeaking] = useState(false);

  // Leaving the screen stops the voice, so it never keeps talking about something that is gone.
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  if (!ready) return null;

  function toggle() {
    const voice = window.speechSynthesis;
    voice.cancel(); // one voice at a time, even across buttons
    if (speaking) return setSpeaking(false);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.95; // a little slower than default, easier to follow
    u.onend = u.onerror = () => setSpeaking(false);
    voice.speak(u);
    setSpeaking(true);
  }

  return (
    <Button variant="ghost" className="h-11 w-fit px-3 text-base" onClick={toggle}>
      {speaking ? <Square aria-hidden /> : <Volume2 aria-hidden />}
      {speaking ? "Stop" : label}
    </Button>
  );
}
