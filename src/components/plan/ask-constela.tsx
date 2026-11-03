"use client";

import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { Check, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { InterviewMessage } from "@/lib/interview";
import { buildInterviewContext } from "@/lib/interview-context";
import { afterWakeWord, beforeStopWord, canListen, recordOnce, writeDown } from "@/lib/listen";
import { loadResumeProfile } from "@/lib/local-profile";
import type { Plan } from "@/lib/plan";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";

// The server accepts 40 messages, the person's last.
const MAX_MESSAGES = 40;
const ERRORS = {
  unavailable: "Constela can't reach the AI on this computer. Open Ollama, then try again.",
  failed: "Constela didn't answer. Try again.",
  mic: "Constela can't use the microphone. Allow it in your browser, or type your question.",
  silent: "We didn't hear anything. Press Hey Constela and try again.",
  voice: "Voice is not ready on this computer. You can type your question.",
} as const;
type Problem = keyof typeof ERRORS;
export type VoicePhase = "idle" | "listening" | "writing" | "thinking" | "speaking";

// Where a spoken sentence ends. Not after a digit, so "1. Open Profile" stays one piece.
const SENTENCE_END = /(?<!\d)[.!?](?=\s)|\n/g;
// voice: Whisper, to hear the person. speak: Kokoro, Constela's voice.
const warmVoice = () => fetch("/api/interview/warm", { method: "POST", body: JSON.stringify({ voice: true, speak: true }) }).catch(() => {});

// One sentence in Kokoro's voice, made on this computer. Null when Kokoro is not ready; the browser reads instead.
function clip(text: string): Promise<Blob | null> {
  return fetch("/api/interview/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    // The first start can download the voice; meanwhile the browser's voice reads instead of leaving silence.
    signal: AbortSignal.timeout(15_000),
  })
    .then((res) => (res.ok ? res.blob() : null))
    .catch(() => null);
}

function browserSay(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.95;
    u.onend = u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}
const onSkyButton = "h-12 border-white/30 bg-white/10 px-6 text-base text-white backdrop-blur hover:bg-white/20 hover:text-white focus-visible:ring-star";

// "Hey Constela" in My plan: ask out loud about the plan, and Constela answers out loud, with the AI and Whisper on
// this computer. The map is its face: `stage` gets data-voice (and --level while listening), which the "You" star's
// halo follows. Typing is a small fallback. Nothing is saved; the talk ends when the person leaves My plan.
export function AskConstela({
  plan,
  stage,
  onAnswer,
}: {
  plan: Plan;
  stage: RefObject<HTMLElement | null>;
  // Each time the answer grows, so the map can light the branches it names.
  onAnswer: (text: string) => void;
}) {
  const hydrated = useHydrated();
  const [phase, setPhaseState] = useState<VoicePhase>("idle");
  const [asked, setAsked] = useState("");
  const [answer, setAnswer] = useState("");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [wake, setWake] = useState(false);
  const messages = useRef<InterviewMessage[]>([]);
  const request = useRef<AbortController>(null);
  const question = useRef<AbortController>(null);
  // "Done talking": ends the question being recorded and keeps it.
  const doneTalking = useRef<AbortController>(null);
  // After the first "Hey Constela", saying "Constela" is enough until the person leaves My plan.
  const [greeted, setGreeted] = useState(false);
  const greetedNow = useRef(false);
  // The "Hey Constela" listener's take right now, stopped while the person asks or Constela answers.
  const wakeTake = useRef<AbortController>(null);
  const holds = useRef(0);
  // Constela's sentences play in order; a new run (Stop, a new question) silences everything queued before it.
  const playlist = useRef<Promise<void>>(Promise.resolve());
  const voiceRun = useRef(0);
  const playing = useRef<HTMLAudioElement>(null);
  const phaseNow = useRef<VoicePhase>("idle");
  const latestPlan = useRef(plan);
  latestPlan.current = plan;
  const voice = hydrated && canListen();

  function setPhase(p: VoicePhase) {
    phaseNow.current = p;
    setPhaseState(p);
    stage.current?.setAttribute("data-voice", p);
    if (p !== "listening") stage.current?.style.setProperty("--level", "0");
  }

  function silence() {
    voiceRun.current += 1;
    playlist.current = Promise.resolve();
    playing.current?.pause();
    window.speechSynthesis?.cancel();
  }

  function stop() {
    request.current?.abort();
    question.current?.abort();
    silence();
    setPhase("idle");
  }
  useEffect(
    () => () => {
      request.current?.abort();
      question.current?.abort();
      voiceRun.current += 1;
      playing.current?.pause();
      window.speechSynthesis?.cancel();
    },
    [],
  );

  function play(audio: Blob): Promise<void> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(audio);
      const el = new Audio(url);
      playing.current = el;
      const done = () => {
        URL.revokeObjectURL(url);
        if (playing.current === el) playing.current = null;
        resolve();
      };
      el.onended = el.onerror = el.onpause = done;
      el.play().catch(done);
    });
  }

  // Sentence by sentence, as the answer is written: each one starts being made by Kokoro right away and they play in
  // order. The last one ends "speaking".
  function speak(text: string, last: boolean) {
    const words = text.trim();
    const run = voiceRun.current;
    const audio = words ? clip(words) : Promise.resolve(null);
    playlist.current = playlist.current.then(async () => {
      if (run !== voiceRun.current) return;
      if (words) {
        const blob = await audio;
        if (run !== voiceRun.current) return;
        await (blob ? play(blob) : browserSay(words));
      }
      if (last && run === voiceRun.current) setPhase("idle");
    });
  }

  async function ask(text: string, spoken: boolean) {
    const words = text.trim().slice(0, 2000);
    // The ref is set before React draws again, so a double tap asks once.
    if (!words || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    holds.current += 1;
    wakeTake.current?.abort();
    silence();
    const history: InterviewMessage[] = [...messages.current, { role: "user" as const, content: words }].slice(-MAX_MESSAGES);
    messages.current = history;
    setAsked(words);
    setAnswer("");
    onAnswer("");
    setDraft("");
    setProblem(null);
    setPhase("thinking");
    let said = 0;
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity: "plan",
          voice: spoken,
          // The plan as it is now, plus the CV's skills and experience; never the name or contact details.
          context: buildInterviewContext(loadResumeProfile(), latestPlan.current),
          messages: history,
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error === "unavailable" ? "unavailable" : "failed");
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let reply = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += value;
        setAnswer(reply);
        onAnswer(reply);
        if (spoken) {
          let cut = 0;
          for (const m of reply.slice(said).matchAll(SENTENCE_END)) cut = m.index + 1;
          if (cut) {
            if (said === 0) setPhase("speaking");
            speak(reply.slice(said, said + cut), false);
            said += cut;
          }
        }
      }
      if (!reply.trim()) throw new Error("failed");
      messages.current = [...history, { role: "assistant", content: reply.trim() }];
      if (spoken) {
        setPhase("speaking");
        speak(reply.slice(said), true);
      } else setPhase("idle");
    } catch (cause) {
      if (controller.signal.aborted) return;
      messages.current = history.slice(0, -1);
      setPhase("idle");
      setProblem(cause instanceof Error && cause.message === "unavailable" ? "unavailable" : "failed");
    } finally {
      holds.current -= 1;
      if (request.current === controller) request.current = null;
    }
  }

  // "Hey Constela", pressed or said alone: record one question, write it down, ask it.
  async function speakQuestion() {
    if (question.current || request.current) return;
    const controller = new AbortController();
    question.current = controller;
    holds.current += 1;
    wakeTake.current?.abort();
    silence();
    setProblem(null);
    setAsked("");
    setAnswer("");
    onAnswer("");
    warmVoice();
    const finish = new AbortController();
    doneTalking.current = finish;
    let stream: MediaStream | null = null;
    let words = "";
    // What was said before "stop", once a check has heard it; null until then.
    let stopped: string | null = null;
    // The wake words and a final "stop" are not part of the question.
    const clean = (text: string) => {
      const before = beforeStopWord(text) ?? text;
      return afterWakeWord(before, greetedNow.current) ?? afterWakeWord(before) ?? before;
    };
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => {
        throw new Error("mic");
      });
      setPhase("listening");
      const audio = await recordOnce(stream, {
        waitMs: 10_000,
        pauseMs: 1500,
        // A loud room never pauses: "stop" or "Done talking" end it sooner.
        maxMs: 40_000,
        signal: controller.signal,
        finish: finish.signal,
        onLevel: (level) => stage.current?.style.setProperty("--level", level.toFixed(2)),
        check: async (soFar) => {
          const before = beforeStopWord(await writeDown(soFar, controller.signal));
          if (before === null) return false;
          stopped = before;
          return true;
        },
      });
      stream.getTracks().forEach((t) => t.stop()); // the microphone light goes off before Whisper runs
      if (stopped !== null) words = clean(stopped);
      else if (audio && !controller.signal.aborted) {
        setPhase("writing");
        words = clean(await writeDown(audio, controller.signal));
      }
      // "Stop" said alone is a change of mind, not a silence.
      if (!words && stopped === null && !controller.signal.aborted) setProblem("silent");
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "";
      if (!controller.signal.aborted) setProblem(code === "mic" ? "mic" : code === "unavailable" ? "voice" : "failed");
    } finally {
      stream?.getTracks().forEach((t) => t.stop());
      holds.current -= 1;
      question.current = null;
      doneTalking.current = null;
      if (!controller.signal.aborted) setPhase("idle");
    }
    if (words) ask(words, true);
  }

  // Heard "Hey Constela": ask what came after it, or listen for the question.
  const onWake = useRef<(rest: string) => void>(() => {});
  onWake.current = (rest) => {
    const before = beforeStopWord(rest);
    // "Hey Constela, stop" is a change of mind: nothing to ask.
    if (before === "") return;
    const words = before ?? rest;
    return words ? ask(words, true) : speakQuestion();
  };

  // While it is on, the microphone listens for "Hey Constela", one short take at a time. Leaving My plan or
  // turning it off closes the microphone.
  useEffect(() => {
    if (!wake) return;
    const off = new AbortController();
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        setWake(false);
        setProblem("mic");
        return;
      }
      if (off.signal.aborted) return stream.getTracks().forEach((t) => t.stop());
      warmVoice();
      while (!off.signal.aborted) {
        if (holds.current > 0 || phaseNow.current !== "idle") {
          await new Promise((r) => setTimeout(r, 300));
          continue;
        }
        const take = new AbortController();
        wakeTake.current = take;
        const signal = AbortSignal.any([off.signal, take.signal]);
        const audio = await recordOnce(stream, { waitMs: 8000, pauseMs: 1200, maxMs: 15_000, signal });
        if (!audio || signal.aborted) continue;
        try {
          const rest = afterWakeWord(await writeDown(audio, signal), greetedNow.current);
          if (rest !== null && !signal.aborted) {
            greetedNow.current = true;
            setGreeted(true);
            onWake.current(rest);
          }
        } catch (cause) {
          if (signal.aborted) continue;
          // Whisper is not set up here: listening cannot work, so it stops instead of failing on every sound.
          if (cause instanceof Error && cause.message === "unavailable") {
            setWake(false);
            setProblem("voice");
          }
        }
      }
    })();
    return () => {
      off.abort();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [wake]);

  function send(event: FormEvent) {
    event.preventDefault();
    ask(draft, false);
  }

  const busy = phase !== "idle";
  const status = {
    idle: "",
    listening: 'Listening. Ask your question, then pause or say "stop".',
    writing: "Writing down what you said.",
    thinking: "Constela is thinking.",
    speaking: "",
  }[phase];

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-3 text-center">
      {/* What was asked and what Constela says, as words too, for anyone who cannot hear it. */}
      <div aria-live="polite" className={cn("flex flex-col gap-1", !(asked || answer || status) && "sr-only")}>
        {asked && <p className="text-sm text-white/70">You asked: {asked}</p>}
        {answer && <p className="text-lg leading-snug text-balance text-white">{answer}</p>}
        {status && <p className="text-white/80">{status}</p>}
      </div>
      {problem && (
        <p role="alert" className="rounded-lg bg-card px-3 py-2 text-sm text-destructive">
          {ERRORS[problem]}
        </p>
      )}

      <div data-tour="ask" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        {voice && phase === "listening" && (
          <Button variant="outline" className={onSkyButton} onClick={() => doneTalking.current?.abort()}>
            <Check aria-hidden />
            Done talking
          </Button>
        )}
        {voice &&
          (busy ? (
            <Button variant="outline" className={onSkyButton} onClick={stop}>
              <Square aria-hidden />
              {phase === "listening" ? "Cancel" : "Stop"}
            </Button>
          ) : (
            <Button variant="outline" className={onSkyButton} onClick={speakQuestion}>
              <Mic aria-hidden />
              Hey Constela
            </Button>
          ))}
        {voice && !typing && (
          <button
            type="button"
            className="min-h-11 rounded px-2 text-sm text-white/80 underline underline-offset-4 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-star"
            onClick={() => setTyping(true)}
          >
            Type instead
          </button>
        )}
      </div>

      {(typing || (hydrated && !voice)) && (
        <form onSubmit={send} className="flex w-full items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={2000}
            placeholder="Ask about your plan"
            aria-label="Your question to Constela"
            className="flex-1 bg-card text-card-foreground"
            autoFocus={typing}
          />
          <Button type="submit" variant="secondary" disabled={busy || !draft.trim()}>
            Ask
          </Button>
        </form>
      )}

      {voice && (
        <div className="flex flex-col items-center gap-0.5">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-white/90">
            <Switch checked={wake} onCheckedChange={setWake} className="data-unchecked:bg-white/25" />
            Listen for &quot;Hey Constela&quot;
          </label>
          {wake && (
            <p className="text-sm text-white/70">
              {greeted ? 'Say "Constela" to ask again. ' : ""}The microphone stays on while My plan is open. What you say is written down on
              this computer, then deleted.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
