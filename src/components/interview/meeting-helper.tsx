"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AppWindow, BellRing, Captions, Check, Square } from "lucide-react";
import { optionRow } from "@/components/profile/question-step";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { recordOnce, writeDown } from "@/lib/listen";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";

// The reminders a person can choose. Calm, short, and never more than one on screen.
const REMINDERS = {
  meeting: "You are in a meeting.",
  breathe: "Take a slow breath.",
  water: "Have a sip of water.",
  repeat: "It is okay to ask them to repeat.",
} as const;
type Reminder = keyof typeof REMINDERS;
const EVERY = [5, 10, 15] as const;
const NOTES = {
  share: "To show captions, share the tab of your meeting and turn on its audio.",
  voice: "Captions are not ready on this computer.",
} as const;

// Chrome and Edge can open a small window that stays on top of other apps.
type PipApi = { requestWindow: (o: { width: number; height: number }) => Promise<Window> };
const pipApi = () => (typeof window !== "undefined" ? (window as unknown as { documentPictureInPicture?: PipApi }).documentPictureInPicture : undefined);

// The floating window starts empty: it gets the page's styles and reading settings, so it looks like Constela.
function dress(pip: Window) {
  for (const sheet of [...document.styleSheets]) {
    try {
      const style = pip.document.createElement("style");
      style.textContent = [...sheet.cssRules].map((r) => r.cssText).join("");
      pip.document.head.appendChild(style);
    } catch {
      if (!sheet.href) continue;
      const link = pip.document.createElement("link");
      link.rel = "stylesheet";
      link.href = sheet.href;
      pip.document.head.appendChild(link);
    }
  }
  const html = document.documentElement;
  pip.document.documentElement.className = html.className;
  pip.document.documentElement.setAttribute("style", html.getAttribute("style") ?? "");
  for (const a of [...html.attributes]) if (a.name.startsWith("data-pz")) pip.document.documentElement.setAttribute(a.name, a.value);
  pip.document.body.className = "bg-background text-foreground p-3";
}

// For a real meeting in Zoom, Meet or Teams: reminders the person chose and, if they want, live captions of the
// meeting, written by Whisper on this computer. Both can float on top of the meeting in a small window.
// Nothing is saved; the captions are gone when this stops.
export function MeetingHelper() {
  const hydrated = useHydrated();
  const [chosen, setChosen] = useState<Reminder[]>(["meeting"]);
  const [every, setEvery] = useState<(typeof EVERY)[number]>(10);
  const [on, setOn] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [pip, setPip] = useState<Window | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [captioning, setCaptioning] = useState(false);
  const [note, setNote] = useState<keyof typeof NOTES | null>(null);
  const captionRun = useRef<AbortController>(null);
  const canFloat = hydrated && !!pipApi();

  // One reminder at a time, in the order chosen, every few minutes. No sound.
  useEffect(() => {
    if (!on || !chosen.length) return;
    let k = 0;
    const timer = setInterval(() => setCurrent(REMINDERS[chosen[k++ % chosen.length]]), every * 60_000);
    // Coming back to this tab while a meeting runs: a gentle nudge back to it.
    const back = () => document.visibilityState === "visible" && setCurrent("You are in a meeting. You can go back to it.");
    document.addEventListener("visibilitychange", back);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", back);
    };
  }, [on, chosen, every]);

  useEffect(
    () => () => {
      captionRun.current?.abort();
    },
    [],
  );

  async function float() {
    const api = pipApi();
    if (!api || pip) return;
    const w = await api.requestWindow({ width: 360, height: 280 }).catch(() => null);
    if (!w) return;
    dress(w);
    w.addEventListener("pagehide", () => setPip(null));
    setPip(w);
  }

  function start() {
    setOn(true);
    setCurrent(null);
    // Opening the window needs the press that started it.
    float();
  }

  function stop() {
    setOn(false);
    setCurrent(null);
    captionRun.current?.abort();
    pip?.close();
    setLines([]);
  }

  async function startCaptions() {
    if (captionRun.current) return;
    setNote(null);
    let shared: MediaStream;
    try {
      // Browsers share audio only with a tab or screen, so the picture is asked for and dropped right away.
      shared = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    } catch {
      return setNote("share");
    }
    shared.getVideoTracks().forEach((t) => t.stop());
    const audio = shared.getAudioTracks();
    if (!audio.length) return setNote("share");
    const run = new AbortController();
    captionRun.current = run;
    audio[0].addEventListener("ended", () => run.abort());
    setCaptioning(true);
    fetch("/api/interview/warm", { method: "POST", body: JSON.stringify({ voice: true }) }).catch(() => {});
    const stream = new MediaStream(audio);
    while (!run.signal.aborted) {
      // shortcut: words said while the last part is being written down are missed; record the next part in parallel if that matters.
      const clip = await recordOnce(stream, { waitMs: 8000, pauseMs: 700, maxMs: 10_000, signal: run.signal });
      if (!clip) continue;
      try {
        const text = await writeDown(clip, run.signal);
        if (text) setLines((l) => [...l, text].slice(-50));
      } catch (cause) {
        if (run.signal.aborted) break;
        if (cause instanceof Error && cause.message === "unavailable") {
          setNote("voice");
          break;
        }
      }
    }
    audio.forEach((t) => t.stop());
    captionRun.current = null;
    setCaptioning(false);
  }

  function stopCaptions() {
    captionRun.current?.abort();
  }

  const panel = (
    <div className="flex flex-col gap-3 text-base">
      <div aria-live="polite" className={cn("flex flex-col gap-2 rounded-xl border p-3", current ? "border-star bg-secondary" : "bg-card")}>
        <p className="flex items-center gap-2 font-medium">
          <BellRing aria-hidden className="size-5 shrink-0 text-primary" />
          {current ?? "Your next reminder comes soon."}
        </p>
        {current && (
          <Button type="button" variant="outline" size="touch" className="w-fit" onClick={() => setCurrent(null)}>
            <Check aria-hidden /> Got it
          </Button>
        )}
      </div>
      {(captioning || lines.length > 0) && (
        <div aria-live="polite" className="flex flex-col gap-1 rounded-xl border bg-card p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Captions aria-hidden className="size-4 shrink-0" />
            {captioning ? "Live captions" : "Captions stopped"}
          </p>
          {lines.slice(-3).map((line, i) => (
            <p key={lines.length - 3 + i}>{line}</p>
          ))}
          {captioning && !lines.length && <p className="text-muted-foreground">Waiting for someone to speak.</p>}
        </div>
      )}
    </div>
  );

  return (
    <section aria-labelledby="meeting-helper" className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h2 id="meeting-helper" className="flex items-center gap-2 text-lg font-semibold">
          <AppWindow aria-hidden className="size-6 shrink-0 text-primary" />
          For a real meeting
        </h2>
        <p className="text-muted-foreground">
          Gentle reminders and live captions while you are in Zoom, Meet or Teams.{canFloat && " They can float on top of your meeting."}
        </p>
      </div>

      {!on ? (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-medium">Which reminders?</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(REMINDERS) as Reminder[]).map((r) => (
                <label key={r} className={optionRow}>
                  <Checkbox
                    checked={chosen.includes(r)}
                    onCheckedChange={(checked) => setChosen((c) => (checked === true ? [...c, r] : c.filter((x) => x !== r)))}
                  />
                  {REMINDERS[r]}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-medium">How often?</legend>
            <div className="flex flex-wrap gap-2">
              {EVERY.map((m) => (
                <Button key={m} type="button" variant={every === m ? "default" : "outline"} aria-pressed={every === m} onClick={() => setEvery(m)}>
                  Every {m} minutes
                </Button>
              ))}
            </div>
          </fieldset>
          <Button type="button" className="w-fit" disabled={!chosen.length} onClick={start}>
            <BellRing aria-hidden /> Start reminders
          </Button>
        </>
      ) : (
        <>
          {pip ? createPortal(panel, pip.document.body) : panel}
          {pip && <p className="text-sm text-muted-foreground">Your reminders are in the floating window.</p>}
          <div className="flex flex-wrap gap-2">
            {canFloat && !pip && (
              <Button type="button" variant="outline" onClick={float}>
                <AppWindow aria-hidden /> Float on top
              </Button>
            )}
            {captioning ? (
              <Button type="button" variant="outline" onClick={stopCaptions}>
                <Square aria-hidden /> Stop captions
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={startCaptions}>
                <Captions aria-hidden /> Live captions
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={stop}>
              Stop
            </Button>
          </div>
          {note && <p role="status" className="text-sm text-muted-foreground">{NOTES[note]}</p>}
          <p className="text-sm text-muted-foreground">
            Live captions write down what the meeting says, on this computer, and keep nothing. Ask the people in the meeting if
            that is okay with them.
          </p>
        </>
      )}
    </section>
  );
}
