"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Mic, RotateCcw, Square } from "lucide-react";
import { optionRow } from "@/components/profile/question-step";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { ACTIVITIES, INTERVIEW_TYPES, USES_TYPE, type Activity, type InterviewContext, type InterviewMessage, type InterviewType } from "@/lib/interview";
import { buildJobContext, loadInterviewContext } from "@/lib/interview-context";
import { markEvent } from "@/lib/plan";
import { jobKey, useSavedJobs } from "@/lib/saved-jobs";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";

const action = "h-11 px-5 text-base";
// The server accepts 40 messages; the person always speaks last, so after 40 the practice is full.
const MAX_MESSAGES = 40;
// A long answer is about a minute; two minutes stops a recorder someone forgot about.
const MAX_RECORDING_S = 120;
// Hands-free talking: how loud counts as speech, how long a pause ends the answer, and how long to wait for any speech.
// The pause is generous on purpose: people stop to think in the middle of an answer.
const SPEECH_LEVEL = 0.02;
const END_PAUSE_MS = 2500;
const WAIT_FOR_SPEECH_MS = 10_000;

const HOW = {
  write: { label: "Write", description: "Type your answers." },
  talk: { label: "Talk", description: "Say your answers out loud. It sends when you stop talking, and the AI talks back." },
  listen: { label: "Write and listen", description: "Type your answers. The AI reads its replies out loud." },
} as const;
type How = keyof typeof HOW;

// Activities where answering counts as interview practice in My plan.
const PRACTICE: readonly Activity[] = ["interview", "questions"];

const ERRORS = {
  unavailable: "Constela can't reach the AI on this computer. Open Ollama, then try again.",
  failed: "The AI didn't answer. Try again.",
} as const;

// voice: the person will talk (Whisper). speak: the AI will talk (Kokoro).
const warm = (models: { voice?: boolean; speak?: boolean }) =>
  fetch("/api/interview/warm", { method: "POST", body: JSON.stringify(models) }).catch(() => {});
const warmFor = (how: "write" | "talk" | "listen") => warm({ voice: how === "talk", speak: how !== "write" });

// Where a spoken sentence ends. Not after a digit, so "1. Answer with a story" stays one piece.
const SENTENCE_END = /(?<!\d)[.!?](?=\s)|\n/g;
const sentences = (text: string) => {
  const out: string[] = [];
  let from = 0;
  for (const m of text.matchAll(SENTENCE_END)) {
    out.push(text.slice(from, m.index + 1));
    from = m.index + 1;
  }
  return [...out, text.slice(from)].filter((s) => s.trim());
};

// The browser can record here: a microphone API and a recorder.
const canRecord = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

function Bubble({ who, text }: { who: "assistant" | "user"; text: string }) {
  const you = who === "user";
  return (
    <div className={cn("flex max-w-[90%] flex-col gap-1", you ? "self-end" : "self-start")}>
      <p className={cn("text-sm font-medium text-muted-foreground", you && "text-right")}>{you ? "You" : "AI"}</p>
      <p className={cn("rounded-2xl px-4 py-3 whitespace-pre-wrap", you ? "bg-secondary" : "border bg-card")}>{text}</p>
    </div>
  );
}

function Choice<T extends string>({
  id,
  question,
  value,
  options,
  onChange,
  columns = false,
  disabled = [],
}: {
  id: string;
  question: string;
  value: T;
  options: Array<[T, string, string?]>;
  onChange: (value: T) => void;
  columns?: boolean;
  disabled?: T[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <p id={id} className="font-medium">{question}</p>
      <RadioGroup aria-labelledby={id} value={value} onValueChange={(v) => onChange(v as T)} className={cn(columns && "grid-cols-2")}>
        {options.map(([v, label, description]) => (
          <label key={v} className={cn(optionRow, disabled.includes(v) && "cursor-not-allowed opacity-60")}>
            <RadioGroupItem value={v} disabled={disabled.includes(v)} />
            <span className="flex flex-col">
              <span>{label}</span>
              {description && <span className="text-sm text-muted-foreground">{description}</span>}
            </span>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}

// Choices first, then the chat. The chat lives only in this component: nothing is saved, and leaving the page ends it.
export function InterviewChat() {
  const hydrated = useHydrated();
  const [activity, setActivity] = useState<Activity>("interview");
  const [type, setType] = useState<InterviewType>("general");
  const [how, setHow] = useState<How>("write");
  const [job, setJob] = useState("");
  // A job saved in Jobs; "Practice an interview for this job" there opens this page with ?saved=<its key>.
  // The page stays mounted between visits, so a new ?saved= has to pick that job too.
  const savedJobs = useSavedJobs();
  const askedSaved = useSearchParams().get("saved");
  const [savedKey, setSavedKey] = useState("");
  const [lastAskedSaved, setLastAskedSaved] = useState<string | null>(null);
  if (askedSaved !== lastAskedSaved) {
    setLastAskedSaved(askedSaved);
    if (askedSaved) setSavedKey(askedSaved);
  }
  const savedJob = savedJobs.find((saved) => jobKey(saved.job) === savedKey);
  const [useMine, setUseMine] = useState(true);
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  // The answer being written right now; it joins the chat when it is complete.
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<keyof typeof ERRORS | null>(null);
  const [draft, setDraft] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [recording, setRecording] = useState<"idle" | "recording" | "transcribing">("idle");
  const [seconds, setSeconds] = useState(0);
  const [voiceNote, setVoiceNote] = useState("");
  const request = useRef<AbortController>(null);
  const practiced = useRef(false);
  const answer = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const spoken = useRef(0);
  const queued = useRef(0);
  const recorder = useRef<MediaRecorder>(null);
  const keepRecording = useRef(true);
  const stopListening = useRef<() => void>(null);
  // Talk mode keeps the conversation going: after the AI's reply is spoken, the microphone opens again.
  const handsFree = useRef(false);
  const listenAfterVoice = useRef(false);
  // Voice and timers call back after later renders; they read the chat from here so it is never out of date.
  const latest = useRef<InterviewMessage[]>([]);
  latest.current = messages;
  const playlist = useRef<Promise<void>>(Promise.resolve());
  const voiceRun = useRef(0);
  const playing = useRef<HTMLAudioElement>(null);

  // The person's CV and plan, saved on this device. Read after hydration, because the server cannot see them.
  const mine = useMemo<InterviewContext>(() => (hydrated ? loadInterviewContext() : {}), [hydrated]);
  const hasMine = Boolean(mine.cv || mine.plan);

  const voiceOut = how !== "write";
  const talk = how === "talk";
  const usesType = USES_TYPE.includes(activity);

  // Start loading the model now; nothing the person typed is sent.
  useEffect(() => {
    warm({});
  }, []);
  useEffect(() => {
    const controller = request;
    const rec = recorder;
    const listening = stopListening;
    const audio = playing;
    return () => {
      controller.current?.abort();
      listening.current?.();
      if (rec.current?.state === "recording") rec.current.stop();
      audio.current?.pause();
      window.speechSynthesis?.cancel();
    };
  }, []);
  // Keep the newest message and the answer box in view.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length, started]);
  // The recording clock, and the stop for a recording someone forgot about.
  useEffect(() => {
    if (recording !== "recording") return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);
  useEffect(() => {
    if (seconds >= MAX_RECORDING_S) recorder.current?.stop();
  }, [seconds]);

  // ---- The AI's voice: Kokoro on this computer, sentence by sentence. The browser's own voice is the fallback. ----
  // A sentence starts being made as soon as it is written, and the sentences play in order.
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

  function browserSay(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!("speechSynthesis" in window)) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      u.rate = 0.95; // a little slower than default, easier to follow
      const local = window.speechSynthesis.getVoices().find((v) => v.localService && v.lang.startsWith("en"));
      if (local) u.voice = local;
      u.onend = u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    });
  }

  function say(text: string) {
    const words = text.trim();
    if (!words) return;
    const run = voiceRun.current;
    const audio = clip(words);
    queued.current += 1;
    setSpeaking(true);
    playlist.current = playlist.current.then(async () => {
      // "Stop voice" or a new turn starts a new run; anything queued before it stays silent.
      if (run !== voiceRun.current) return;
      const blob = await audio;
      if (run !== voiceRun.current) return;
      await (blob ? play(blob) : browserSay(words));
      if (run !== voiceRun.current) return;
      queued.current = Math.max(0, queued.current - 1);
      if (queued.current > 0) return;
      setSpeaking(false);
      // The AI has finished talking: now it is the person's turn.
      if (listenAfterVoice.current) {
        listenAfterVoice.current = false;
        startRecording();
      }
    });
  }

  function stopVoice() {
    listenAfterVoice.current = false;
    voiceRun.current += 1;
    playlist.current = Promise.resolve();
    playing.current?.pause();
    window.speechSynthesis?.cancel();
    queued.current = 0;
    setSpeaking(false);
  }

  // Speaks each sentence as soon as it is complete, so the voice starts while the AI is still writing.
  function speakSentences(text: string, final: boolean) {
    const rest = text.slice(spoken.current);
    let cut = final ? rest.length : 0;
    // Not after a digit, so "1. Answer with a story" stays one piece.
    if (!final) for (const m of rest.matchAll(SENTENCE_END)) cut = m.index + 1;
    if (cut > 0) {
      say(rest.slice(0, cut));
      spoken.current += cut;
    }
  }

  async function ask(history: InterviewMessage[]) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError(null);
    setReply("");
    spoken.current = 0;
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity,
          type,
          voice: talk,
          role: usesType ? (savedJob ? savedJob.job.title.slice(0, 80) : job) : "",
          context: { ...(useMine ? mine : {}), ...(usesType && savedJob ? { job: buildJobContext(savedJob) } : {}) },
          messages: history,
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error === "unavailable" ? "unavailable" : "failed");
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += value;
        setReply(text);
        if (voiceOut) speakSentences(text, false);
      }
      if (!text.trim()) throw new Error("failed");
      if (voiceOut) speakSentences(text, true);
      setMessages([...history, { role: "assistant", content: text.trim() }]);
      setReply("");
      // The first answered question counts as practice in My plan.
      if (PRACTICE.includes(activity) && history.length > 0 && !practiced.current) {
        practiced.current = true;
        markEvent("practice-done");
      }
      // Talk mode: listen again once the reply has been spoken (or now, if this browser cannot speak).
      if (talk && handsFree.current && history.length + 1 < MAX_MESSAGES) {
        if (queued.current > 0) listenAfterVoice.current = true;
        else startRecording();
      }
    } catch (cause) {
      if (controller.signal.aborted) return;
      stopVoice();
      setReply("");
      setError(cause instanceof Error && cause.message === "unavailable" ? "unavailable" : "failed");
    } finally {
      if (request.current === controller) setBusy(false);
    }
  }

  function start(event: FormEvent) {
    event.preventDefault();
    warmFor(how);
    handsFree.current = talk;
    setStarted(true);
    ask([]);
  }

  function sendText(text: string) {
    const words = text.trim();
    if (!words) return;
    stopVoice();
    setVoiceNote("");
    const next: InterviewMessage[] = [...latest.current, { role: "user", content: words }];
    setMessages(next);
    setDraft("");
    ask(next);
  }

  function send(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || busy) return;
    sendText(draft);
    answer.current?.focus();
  }

  // ---- The person's voice: recorded here, written down by Whisper on this computer, then deleted. ----
  async function startRecording() {
    if (recorder.current) return;
    stopVoice();
    setVoiceNote("");
    handsFree.current = true;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      handsFree.current = false;
      setVoiceNote("Constela can't use the microphone. Allow it in your browser, or write your answer.");
      return;
    }
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onstop = () => {
      stopListening.current?.();
      stopListening.current = null;
      stream.getTracks().forEach((t) => t.stop()); // the microphone light goes off right away
      recorder.current = null;
      if (keepRecording.current) transcribe(new Blob(chunks, { type: rec.mimeType }));
      else setRecording("idle");
    };

    // Listens to how loud the microphone is: a pause after speaking ends the answer, and silence turns the microphone off.
    const audio = new AudioContext();
    const analyser = audio.createAnalyser();
    analyser.fftSize = 2048;
    audio.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    const opened = performance.now();
    let spoke = 0;
    let lastSound = opened;
    let before = opened;
    const meter = setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      const level = Math.sqrt(samples.reduce((sum, v) => sum + v * v, 0) / samples.length);
      const t = performance.now();
      if (level > SPEECH_LEVEL) {
        spoke += t - before;
        lastSound = t;
      }
      before = t;
      if (spoke > 300 && t - lastSound > END_PAUSE_MS) {
        stopRecording(true);
      } else if (spoke <= 300 && t - opened > WAIT_FOR_SPEECH_MS) {
        handsFree.current = false;
        stopRecording(false);
        setVoiceNote("We didn't hear anything, so the microphone is off. Press Start speaking when you are ready.");
      }
    }, 100);
    stopListening.current = () => {
      clearInterval(meter);
      audio.close().catch(() => {});
    };

    keepRecording.current = true;
    recorder.current = rec;
    rec.start();
    setSeconds(0);
    setRecording("recording");
  }

  function stopRecording(use: boolean) {
    keepRecording.current = use;
    stopListening.current?.();
    stopListening.current = null;
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  async function transcribe(audio: Blob) {
    setRecording("transcribing");
    const form = new FormData();
    form.set("audio", audio, "answer");
    try {
      const res = await fetch("/api/interview/transcribe", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        handsFree.current = false;
        setVoiceNote(
          data?.error === "unavailable"
            ? "Voice is not ready on this computer. You can write your answer instead."
            : "We couldn't write down what you said. Try again.",
        );
        return;
      }
      const text = String(data?.text ?? "").trim();
      if (!text) {
        handsFree.current = false;
        setVoiceNote("We didn't hear any words. Press Start speaking and try again, a little closer to the microphone.");
        return;
      }
      // Anything already typed in the box goes first, then what was said.
      sendText(`${answer.current?.value.trim() ?? ""} ${text}`);
    } catch {
      handsFree.current = false;
      setVoiceNote("We couldn't write down what you said. Try again.");
    } finally {
      setRecording("idle");
    }
  }

  function startOver() {
    handsFree.current = false;
    request.current?.abort();
    stopRecording(false);
    stopVoice();
    setStarted(false);
    setMessages([]);
    setReply("");
    setBusy(false);
    setError(null);
    setDraft("");
    setVoiceNote("");
  }

  if (!started) {
    const noMic = hydrated && !canRecord();
    return (
      <form onSubmit={start} className="flex flex-col gap-6">
        <Choice
          id="choose-activity"
          question="What do you want to do?"
          value={activity}
          onChange={setActivity}
          options={(Object.keys(ACTIVITIES) as Activity[]).filter((a) => a !== "plan").map((a) => [a, ACTIVITIES[a].label, ACTIVITIES[a].description])}
        />
        {usesType && (
          <>
            <Choice
              id="choose-type"
              question="What kind of interview?"
              value={type}
              onChange={setType}
              columns
              options={(Object.keys(INTERVIEW_TYPES) as InterviewType[]).map((t) => [t, INTERVIEW_TYPES[t].label])}
            />
            {savedJobs.length > 0 && (
              <label className="flex flex-col gap-2 font-medium">
                <span>Practice for a job you saved?</span>
                <select
                  value={savedJob ? savedKey : ""}
                  onChange={(event) => setSavedKey(event.target.value)}
                  className="h-11 w-full rounded-md border border-input bg-card px-3 text-base font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">No, I will type the job</option>
                  {savedJobs.map((saved) => (
                    <option key={jobKey(saved.job)} value={jobKey(saved.job)}>
                      {saved.job.title} · {saved.job.company}
                    </option>
                  ))}
                </select>
                {savedJob && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {savedJob.research
                      ? "The AI uses the job posting and what the web search found about the company."
                      : "The AI uses the job posting. To add facts about the company, look it up online in Jobs, Saved."}
                  </span>
                )}
              </label>
            )}
            {!savedJob && (
              <label className="flex flex-col gap-2 font-medium">
                <span>
                  What job is it for? <span className="font-normal text-muted-foreground">(optional)</span>
                </span>
                <input
                  value={job}
                  onChange={(event) => setJob(event.target.value)}
                  maxLength={80}
                  autoComplete="off"
                  placeholder="For example: cashier"
                  className="h-11 w-full rounded-md border border-input bg-card px-3 text-base font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
            )}
          </>
        )}
        <Choice
          id="choose-how"
          question="How do you want to practice?"
          value={how}
          onChange={(h) => {
            setHow(h);
            // The voice models take a few seconds to load; start now, while the person finishes choosing.
            warmFor(h);
          }}
          options={(Object.keys(HOW) as How[]).map((h) => [h, HOW[h].label, h === "talk" && noMic ? "This browser can't record your voice." : HOW[h].description])}
          disabled={noMic ? ["talk"] : []}
        />
        {hasMine && (
          <label className={optionRow}>
            <Checkbox checked={useMine} onCheckedChange={(checked) => setUseMine(checked === true)} />
            <span className="flex flex-col">
              <span>Use my {[mine.cv && "CV", mine.plan && "plan"].filter(Boolean).join(" and ")}</span>
              <span className="text-sm text-muted-foreground">
                So questions and tips fit you. Your skills, experience and steps go to the AI on this computer. Your name and
                contact details do not.
              </span>
            </span>
          </label>
        )}
        <Button type="submit" className={`${action} w-fit`}>
          Start
        </Button>
        <p className="text-sm text-muted-foreground">
          The AI runs on this computer. Nothing is saved, and the chat ends when you leave this page.
          {how === "talk" && " Your voice is written down on this computer, and the recording is deleted right after."}
        </p>
      </form>
    );
  }

  const full = messages.length >= MAX_MESSAGES;
  const lastReply = [...messages].reverse().find((m) => m.role === "assistant")?.content;
  const summary = [ACTIVITIES[activity].label, usesType && INTERVIEW_TYPES[type].label, HOW[how].label].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{summary}</p>
        {voiceOut && (speaking ? (
          <Button variant="ghost" className="h-11 px-3 text-base" onClick={stopVoice}>
            <Square aria-hidden /> Stop voice
          </Button>
        ) : lastReply && !busy && recording === "idle" && (
          <Button variant="ghost" className="h-11 px-3 text-base" onClick={() => sentences(lastReply).forEach(say)}>
            <RotateCcw aria-hidden /> Hear it again
          </Button>
        ))}
      </div>

      {/* aria-busy holds back the announcement until the answer is complete, so a screen reader does not read it word by word. */}
      <div role="log" aria-label={ACTIVITIES[activity].label} aria-live="polite" aria-busy={busy} className="flex flex-col gap-4">
        {messages.map((message, index) => (
          <Bubble key={index} who={message.role} text={message.content} />
        ))}
        {busy && <Bubble who="assistant" text={reply || "Thinking…"} />}
      </div>

      {error && (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-xl bg-secondary p-4">
          <p>{ERRORS[error]}</p>
          <Button className={action} onClick={() => ask(messages)}>
            Try again
          </Button>
        </div>
      )}

      <div ref={end} className="flex flex-col gap-3">
        {full ? (
          <p className="text-muted-foreground">This chat is full. Start over for a new one.</p>
        ) : messages.length === 0 ? null : (
          <form onSubmit={send} className="flex flex-col gap-3">
            {talk && (
              <div className="flex flex-col gap-3">
                {recording === "recording" ? (
                  <>
                    <p className="flex items-center gap-2">
                      <span aria-hidden className="size-2.5 rounded-full bg-destructive" />
                      Listening {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}.{" "}
                      <span className="text-muted-foreground">It sends when you stop talking.</span>
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button type="button" className={action} onClick={() => stopRecording(true)}>
                        <Square aria-hidden /> Send now
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className={action}
                        onClick={() => {
                          handsFree.current = false;
                          stopRecording(false);
                        }}
                      >
                        Stop listening
                      </Button>
                    </div>
                  </>
                ) : (
                  <Button
                    type="button"
                    className={`${action} w-fit`}
                    disabled={busy || speaking || recording === "transcribing"}
                    onClick={startRecording}
                  >
                    <Mic aria-hidden />
                    {recording === "transcribing" ? "Writing down what you said…" : speaking || busy ? "Your turn comes next" : "Start speaking"}
                  </Button>
                )}
              </div>
            )}
            <p role="status" className={cn("text-sm text-muted-foreground", !voiceNote && "sr-only")}>
              {voiceNote}
            </p>
            <label className="flex flex-col gap-2 font-medium">
              {talk ? "Or write your answer" : activity === "translate" ? "Your message" : "Your answer"}
              <Textarea
                ref={answer}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={2000}
                placeholder={activity === "translate" ? "Paste the message here" : "Write in your own words"}
                className="min-h-20 font-normal md:text-base"
              />
            </label>
            <Button type="submit" variant={talk ? "outline" : "default"} className={`${action} w-fit`} disabled={busy || !draft.trim() || recording !== "idle"}>
              {activity === "translate" ? "Send message" : "Send answer"}
            </Button>
          </form>
        )}
        <Button variant="ghost" className={`${action} w-fit`} onClick={startOver}>
          Start over
        </Button>
      </div>
    </div>
  );
}
