"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarCheck, CircleHelp, Eye, EyeOff, FilePen, FilePlus2, FileText, FileUser, GraduationCap, History, Languages, Lightbulb, Mail, MailCheck, MessageSquare, Mic, PenLine, PhoneOff, Play, RotateCcw, Send, SignalHigh, SignalLow, SignalMedium, SlidersHorizontal, SpellCheck, Square, Target, Users, Video, VideoOff, Volume2, Wrench } from "lucide-react";
import { CameraView } from "@/components/interview/camera-view";
import { MeetingHelper } from "@/components/interview/meeting-helper";
import { optionRow } from "@/components/profile/question-step";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { ACTIVITIES, INTERVIEW_TYPES, LEVELS, USES_JOB, USES_TYPE, type Activity, type Level, type InterviewContext, type InterviewMessage, type InterviewType } from "@/lib/interview";
import { buildJobContext, loadInterviewContext } from "@/lib/interview-context";
import { voiceSpeed } from "@/lib/personalization";
import { markEvent } from "@/lib/plan";
import { countWords, needsEasier, soundsUnsure, type AnswerSignals } from "@/lib/practice-signals";
import type { Voice } from "@/lib/whisper";
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

// A pictogram for every way to practice and every choice, so each box can be found without reading.
const ACTIVITY_ICONS: Record<Activity, LucideIcon> = {
  interview: Users,
  questions: CircleHelp,
  translate: Languages,
  training: GraduationCap,
  expect: CalendarCheck,
  cvWrite: FilePlus2,
  cvReview: Lightbulb,
  cvPart: FilePen,
  email: Mail,
  coverLetter: FileText,
  followUp: MailCheck,
  proofread: SpellCheck,
  plan: MessageSquare,
};
const TYPE_ICONS: Record<InterviewType, LucideIcon> = { general: MessageSquare, video: Video, experience: History, technical: Wrench };
const LEVEL_ICONS: Record<Level, LucideIcon> = { easy: SignalLow, medium: SignalMedium, hard: SignalHigh };
const HOW_ICONS: Record<How, LucideIcon> = { write: PenLine, talk: Mic, listen: Volume2 };

// The first screen shows four boxes. Choosing one shows everything it can do; each part is an activity the AI knows.
type Group = "interview" | "questions" | "messages" | "cv";
const GROUPS: Record<Group, { label: string; description: string; icon: LucideIcon; parts: readonly Activity[] }> = {
  interview: { label: ACTIVITIES.interview.label, description: ACTIVITIES.interview.description, icon: Users, parts: ["interview", "expect"] },
  questions: { label: ACTIVITIES.questions.label, description: ACTIVITIES.questions.description, icon: CircleHelp, parts: ["questions", "training"] },
  messages: {
    label: "Messages and letters",
    description: "Understand a recruiter's message, write an email, cover letter or follow-up, or check your writing.",
    icon: Send,
    parts: ["translate", "email", "coverLetter", "followUp", "proofread"],
  },
  cv: { label: "Write or improve your CV", description: "Start a CV from zero, get tips on yours, or fix one part.", icon: FileUser, parts: ["cvWrite", "cvReview", "cvPart"] },
};

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

function NeedAMoment({ onPress }: { onPress: () => void }) {
  return (
    <Button type="button" variant="outline" className={action} onClick={onPress}>
      I need a moment
    </Button>
  );
}

// A choice as boxes side by side, as shopping and settings pages show them on a computer; one per row on a phone.
const tile =
  "press flex h-full cursor-pointer flex-col gap-2 rounded-xl border bg-card p-4 text-base hover:border-primary/40 has-data-checked:border-primary has-data-checked:bg-secondary has-data-checked:ring-1 has-data-checked:ring-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background";

function Choice<T extends string>({
  id,
  question,
  value,
  options,
  onChange,
  disabled = [],
}: {
  id: string;
  question: string;
  value: T;
  options: Array<[T, string, string?, LucideIcon?]>;
  onChange: (value: T) => void;
  disabled?: T[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <p id={id} className="font-medium">{question}</p>
      <RadioGroup aria-labelledby={id} value={value} onValueChange={(v) => onChange(v as T)} className={cn("grid gap-3", options.length === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3")}>
        {options.map(([v, label, description, Icon]) => (
          <label key={v} className={cn(tile, disabled.includes(v) && "cursor-not-allowed opacity-60")}>
            <span className="flex items-center gap-3">
              <RadioGroupItem value={v} disabled={disabled.includes(v)} />
              {Icon && <Icon aria-hidden className="size-5 shrink-0 text-primary" />}
              <span className="font-medium">{label}</span>
            </span>
            {description && <span className="text-sm text-muted-foreground">{description}</span>}
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}

// Choices first, then the chat. The chat lives only in this component: nothing is saved, and leaving the page ends it.
export function InterviewChat() {
  const hydrated = useHydrated();
  const [group, setGroup] = useState<Group | null>(null);
  const [activity, setActivity] = useState<Activity>("interview");
  const pick = (g: Group) => {
    setGroup(g);
    setActivity(GROUPS[g].parts[0]);
  };
  const [type, setType] = useState<InterviewType>("general");
  const [level, setLevel] = useState<Level>("easy");
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
    // A saved job is for interview practice, so that box opens with the job already chosen.
    if (askedSaved) {
      setSavedKey(askedSaved);
      pick("interview");
    }
  }
  const savedJob = savedJobs.find((saved) => jobKey(saved.job) === savedKey);
  const [useMine, setUseMine] = useState(true);
  // "Adjust the practice to how it is going": off unless the person turns it on. What it reads is never shown or kept.
  const [adapt, setAdapt] = useState(false);
  const signals = useRef<AnswerSignals[]>([]);
  const paused = useRef(false);
  const heardVoice = useRef<Voice | undefined>(undefined);
  // Video call practice with the person's own camera: off unless they turn it on.
  const [camera, setCamera] = useState(false);
  // In the meeting: the camera, hiding yourself, the one calm note when you turn it off, and typing instead of talking.
  const [camOn, setCamOn] = useState(false);
  const [hideMe, setHideMe] = useState(false);
  const [toldCamOff, setToldCamOff] = useState(false);
  const [typing, setTyping] = useState(false);
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
  // Dictate: what the person says is written into the answer box for them to check, not sent.
  const dictating = useRef(false);
  // The sentence the AI is saying right now, shown as a caption.
  const [caption, setCaption] = useState("");
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

  const usesType = USES_TYPE.includes(activity);
  const usesJob = USES_JOB.includes(activity);
  const micOk = hydrated && canRecord();
  // A video call is spoken, like a real one: the person talks and the interviewer talks back, when this browser can record.
  const meetingFor = (a: Activity) => type === "video" && USES_TYPE.includes(a) && micOk;
  const howFor = (a: Activity): How => (meetingFor(a) ? "talk" : how);
  const voiceOut = howFor(activity) !== "write";
  const talk = howFor(activity) === "talk";

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
      body: JSON.stringify({ text, speed: voiceSpeed() }),
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
      u.rate = voiceSpeed(); // a little slower than default, easier to follow
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
      setCaption(words);
      await (blob ? play(blob) : browserSay(words));
      if (run !== voiceRun.current) return;
      queued.current = Math.max(0, queued.current - 1);
      if (queued.current > 0) return;
      setSpeaking(false);
      setCaption("");
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
    setCaption("");
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

  // act: the activity just chosen with one tap, before React has drawn the new choice.
  async function ask(history: InterviewMessage[], act: Activity = activity, ease = false) {
    const typed = USES_JOB.includes(act);
    const mode = howFor(act);
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
          activity: act,
          type,
          level,
          ease,
          voice: mode === "talk",
          role: typed ? (savedJob ? savedJob.job.title.slice(0, 80) : job) : "",
          context: { ...(useMine ? mine : {}), ...(typed && savedJob ? { job: buildJobContext(savedJob) } : {}) },
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
        if (mode !== "write") speakSentences(text, false);
      }
      if (!text.trim()) throw new Error("failed");
      if (mode !== "write") speakSentences(text, true);
      setMessages([...history, { role: "assistant", content: text.trim() }]);
      setReply("");
      // The first answered question counts as practice in My plan.
      if (PRACTICE.includes(act) && history.length > 0 && !practiced.current) {
        practiced.current = true;
        markEvent("practice-done");
      }
      // Talk mode: listen again once the reply has been spoken (or now, if this browser cannot speak).
      if (mode === "talk" && handsFree.current && history.length + 1 < MAX_MESSAGES) {
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

  // One tap starts: the activity pressed, with the choices in More options (or their defaults).
  function start(a: Activity) {
    setActivity(a);
    warmFor(howFor(a));
    handsFree.current = howFor(a) === "talk";
    setCamOn(camera);
    setHideMe(false);
    setToldCamOff(false);
    setTyping(false);
    setStarted(true);
    signals.current = [];
    paused.current = false;
    ask([], a);
  }

  function sendText(text: string) {
    const words = text.trim();
    if (!words) return;
    stopVoice();
    setVoiceNote("");
    const next: InterviewMessage[] = [...latest.current, { role: "user", content: words }];
    setMessages(next);
    setDraft("");
    // What this answer showed, compared with this practice's earlier answers. Only with "Adjust the practice" on.
    let ease = false;
    if (adapt && USES_TYPE.includes(activity)) {
      signals.current.push({
        words: countWords(words),
        unsure: soundsUnsure(words),
        paused: paused.current,
        voice: heardVoice.current,
      });
      ease = needsEasier(signals.current);
    }
    paused.current = false;
    heardVoice.current = undefined;
    ask(next, activity, ease);
  }

  function send(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || busy) return;
    sendText(draft);
    answer.current?.focus();
  }

  // ---- The person's voice: recorded here, written down by Whisper on this computer, then deleted. ----
  async function startRecording(dictate = false) {
    if (recorder.current) return;
    stopVoice();
    setVoiceNote("");
    handsFree.current = !dictate;
    dictating.current = dictate;
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
        setVoiceNote("We didn't hear anything, so the microphone is off. Try again when you are ready.");
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
    if (adapt && USES_TYPE.includes(activity) && !dictating.current) form.set("voice", "1");
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
      if (dictating.current) {
        setDraft((typed) => `${typed.trim()} ${text}`.trim().slice(0, 2000));
        answer.current?.focus();
        return;
      }
      heardVoice.current = data?.voice;
      // Anything already typed in the box goes first, then what was said.
      sendText(`${answer.current?.value.trim() ?? ""} ${text}`);
    } catch {
      handsFree.current = false;
      setVoiceNote("We couldn't write down what you said. Try again.");
    } finally {
      setRecording("idle");
    }
  }

  // A pause with no cost: the microphone and the voice stop, and nothing moves on until the person is ready.
  function needAMoment() {
    paused.current = true;
    handsFree.current = false;
    stopRecording(false);
    stopVoice();
    setVoiceNote("Take your time. When you are ready, press Start speaking or write your answer.");
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
    const parts = group ? GROUPS[group].parts : [];
    return (
      <div className="flex flex-col gap-8">
        <section aria-labelledby="choose-activity" className="flex flex-col gap-3">
          <h2 id="choose-activity" className="flex items-center gap-2 text-lg font-semibold">
            <Target aria-hidden className="size-6 shrink-0 text-primary" />
            What do you want to work on?
          </h2>
          {savedJob && (
            <p className="text-sm text-muted-foreground">
              For: {savedJob.job.title} at {savedJob.job.company}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(GROUPS) as Group[]).map((g) => {
              const { label, description, icon: Icon } = GROUPS[g];
              const on = group === g;
              return (
                <Button
                  key={g}
                  variant={on ? "default" : "outline"}
                  aria-pressed={on}
                  className="h-full min-h-14 w-full flex-col items-start justify-start gap-1 px-5 py-4 text-left whitespace-normal"
                  onClick={() => pick(g)}
                >
                  <Icon aria-hidden className={cn("size-7", on ? "text-primary-foreground" : "text-primary")} />
                  <span className="text-base font-semibold">{label}</span>
                  <span className={cn("text-sm font-normal", on ? "text-primary-foreground/85" : "text-muted-foreground")}>{description}</span>
                </Button>
              );
            })}
          </div>
        </section>

        {/* Everything the chosen box can do shows at once, each choice with a sensible default. */}
        {group && (
          <section aria-labelledby="choose-options" className="flex flex-col gap-6">
            <h2 id="choose-options" className="flex items-center gap-2 text-lg font-semibold">
              <SlidersHorizontal aria-hidden className="size-6 shrink-0 text-primary" />
              Your choices
            </h2>
            {parts.length > 1 && (
              <Choice
                id="choose-part"
                question="What do you want to do?"
                value={activity}
                onChange={setActivity}
                options={parts.map((a): [Activity, string, string, LucideIcon] => [a, ACTIVITIES[a].label, ACTIVITIES[a].description, ACTIVITY_ICONS[a]])}
              />
            )}
            {usesType && (
              <Choice
                id="choose-type"
                question="What kind of interview?"
                value={type}
                onChange={setType}
                options={(Object.keys(INTERVIEW_TYPES) as InterviewType[]).map((t) => [t, INTERVIEW_TYPES[t].label, undefined, TYPE_ICONS[t]])}
              />
            )}
            {usesType && (
              <Choice
                id="choose-level"
                question="How hard?"
                value={level}
                onChange={setLevel}
                options={(Object.keys(LEVELS) as Level[]).map((l) => [l, LEVELS[l].label, undefined, LEVEL_ICONS[l]])}
              />
            )}
            {meetingFor(activity) ? (
              <p className="rounded-xl border bg-card p-4">
                A video call is spoken, like a real one. You talk, and the interviewer talks back. Your voice is written down on
                this computer, then deleted.
              </p>
            ) : (
              <Choice
                id="choose-how"
                question="How do you want to do it?"
                value={how}
                onChange={(h) => {
                  setHow(h);
                  // The voice models take a few seconds to load; start now, while the person finishes choosing.
                  warmFor(h);
                }}
                options={(Object.keys(HOW) as How[]).map((h) => [h, HOW[h].label, h === "talk" && noMic ? "This browser can't record your voice." : HOW[h].description, HOW_ICONS[h]])}
                disabled={noMic ? ["talk"] : []}
              />
            )}
            {usesType && type === "video" && (
              <div className="grid items-start gap-3 lg:grid-cols-2">
                <label className={optionRow}>
                  <Checkbox checked={camera} onCheckedChange={(checked) => setCamera(checked === true)} />
                  <span className="flex flex-col">
                    <span>Use my camera, like a real video call</span>
                    <span className="text-sm text-muted-foreground">You see yourself in a small window. Nothing is recorded or sent.</span>
                  </span>
                </label>
                {camera && <CameraView check />}
              </div>
            )}
            <div className="grid items-start gap-6 lg:grid-cols-2">
            {usesJob && savedJobs.length > 0 && (
              <label className="flex flex-col gap-2 font-medium">
                <span>For a job you saved?</span>
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
                      ? "The AI uses the job posting and what Wikipedia says about the company."
                      : "The AI uses the job posting. To add facts about the company, look it up online in Jobs, Saved."}
                  </span>
                )}
              </label>
            )}
            {usesJob && !savedJob && (
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
            {usesType && (
              <label className={optionRow}>
                <Checkbox checked={adapt} onCheckedChange={(checked) => setAdapt(checked === true)} />
                <span className="flex flex-col">
                  <span>Adjust the practice to how it is going</span>
                  <span className="text-sm text-muted-foreground">
                    If a question seems hard, the next one is easier, with an example or a break. It looks at your answers and,
                    only on this computer, at your pauses and pace when you speak. It never reads your face. Nothing is shown or saved.
                  </span>
                </span>
              </label>
            )}
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
            </div>
            <Button className={`${action} w-fit`} onClick={() => start(activity)}>
              <Play aria-hidden /> Start
            </Button>
          </section>
        )}

        {/* Help for a real meeting belongs with interview practice only. */}
        {group === "interview" && <MeetingHelper />}

        <p className="text-sm text-muted-foreground">
          The AI runs on this computer. Nothing is saved, and the chat ends when you leave this page.
          {howFor(activity) === "talk" && " Your voice is written down on this computer, and the recording is deleted right after."}
        </p>
      </div>
    );
  }

  const full = messages.length >= MAX_MESSAGES;
  const lastReply = [...messages].reverse().find((m) => m.role === "assistant")?.content;
  const summary = [ACTIVITIES[activity].label, usesType && INTERVIEW_TYPES[type].label, usesType && LEVELS[level].label, HOW[howFor(activity)].label].filter(Boolean).join(" · ");

  const meeting = meetingFor(activity);
  const lastAnswer = [...messages].reverse().find((m) => m.role === "user")?.content;
  if (meeting) {
    const caption = reply || lastReply;
    const bar = "h-12 rounded-full px-5 text-base";
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{summary}</p>
        {/* The call, as in a meeting app: the interviewer fills the screen, you are a small tile in the corner, and what
            the interviewer says shows as captions. It is spoken: there is no chat. */}
        <div className="relative">
          {/* As tall as fits with the controls still on screen, like a meeting window. */}
          <div className={cn("relative h-[min(75vw,50svh)] w-full overflow-hidden rounded-2xl bg-sky text-white sm:h-[min(56vw,55svh)]", speaking && "ring-2 ring-star")}>
            <div className="absolute inset-0 grid place-items-center">
              <span aria-hidden className={cn("grid size-24 place-items-center rounded-full bg-white/10 text-3xl font-semibold sm:size-32", speaking && "ring-4 ring-star/70")}>
                AI
              </span>
            </div>
            <span className="absolute top-3 left-3 rounded bg-black/50 px-2 py-0.5 text-sm">
              Interviewer{speaking ? ", speaking" : busy ? ", thinking" : ""}
            </span>
            <div className="absolute top-3 right-3 w-1/3 max-w-60 min-w-28">
              <CameraView
                key={String(camOn)}
                on={camOn}
                hidden={hideMe}
                onPalm={needAMoment}
              />
            </div>
          </div>
          {caption && (
            <p
              aria-live="polite"
              aria-busy={busy}
              className="mt-3 rounded-xl bg-sky px-4 py-3 text-center text-base text-white sm:absolute sm:inset-x-6 sm:bottom-4 sm:mt-0 sm:bg-black/65 sm:text-lg"
            >
              {caption}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {recording === "recording" ? (
            <Button className={bar} onClick={() => stopRecording(true)}>
              <Square aria-hidden /> Send now
            </Button>
          ) : (
            <Button className={bar} disabled={busy || speaking || recording === "transcribing" || full} onClick={() => startRecording()}>
              <Mic aria-hidden />
              {recording === "transcribing" ? "Writing down what you said…" : speaking || busy ? "Your turn comes next" : "Start speaking"}
            </Button>
          )}
          <Button variant="outline" className={bar} onClick={needAMoment}>
            I need a moment
          </Button>
          <Button
            variant="outline"
            className={bar}
            onClick={() => {
              if (camOn) setToldCamOff(true);
              setCamOn(!camOn);
            }}
          >
            {camOn ? <VideoOff aria-hidden /> : <Video aria-hidden />}
            {camOn ? "Camera off" : "Camera on"}
          </Button>
          {camOn && (
            <Button variant="outline" className={bar} onClick={() => setHideMe((h) => !h)}>
              {hideMe ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
              {hideMe ? "Show me" : "Hide me"}
            </Button>
          )}
          <Button variant="destructive" className={bar} onClick={startOver}>
            <PhoneOff aria-hidden /> Leave
          </Button>
        </div>

        <div aria-live="polite" className="flex flex-col items-center gap-1 text-center text-sm text-muted-foreground">
          {recording === "recording" && (
            <p className="flex items-center gap-2 text-foreground">
              <span aria-hidden className="size-2.5 rounded-full bg-destructive" />
              Listening. It sends when you stop talking.
            </p>
          )}
          {lastAnswer && recording === "idle" && <p>You said: {lastAnswer}</p>}
          {voiceNote && <p role="status">{voiceNote}</p>}
          {toldCamOff && !camOn && <p>Your camera is off. That is okay if you prefer it.</p>}
          {camOn && <p>Raise an open hand for a moment to pause.</p>}
          {full && <p>This practice is full. Leave and start a new one.</p>}
        </div>

        {error && (
          <div role="alert" className="flex flex-col items-center gap-3 rounded-xl bg-secondary p-4 text-center">
            <p>{ERRORS[error]}</p>
            <Button className={action} onClick={() => ask(messages)}>
              Try again
            </Button>
          </div>
        )}

        {/* Spoken first; typing stays one tap away for anyone who cannot talk right now. The end ref keeps the
            controls in view when the call starts. */}
        <div ref={end} />
        {typing ? (
          <form onSubmit={send} className="mx-auto flex w-full max-w-xl flex-col gap-3">
            <label className="flex flex-col gap-2 font-medium">
              Your answer
              <Textarea
                ref={answer}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={2000}
                placeholder="Write in your own words"
                className="min-h-20 font-normal md:text-base"
              />
            </label>
            <Button type="submit" variant="outline" className={`${action} w-fit`} disabled={busy || !draft.trim() || recording !== "idle"}>
              Send answer
            </Button>
          </form>
        ) : (
          <button
            type="button"
            className="mx-auto min-h-11 rounded px-2 text-sm text-muted-foreground underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setTyping(true)}
          >
            Type instead
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
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

      {voiceOut && caption && (
        <p aria-hidden className="rounded-xl bg-sky px-4 py-3 text-center text-lg text-white">
          {caption}
        </p>
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
                      Listening.{" "}
                      <span className="text-muted-foreground">It sends when you stop talking.</span>
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button type="button" className={action} onClick={() => stopRecording(true)}>
                        <Square aria-hidden /> Send now
                      </Button>
                      <NeedAMoment onPress={needAMoment} />
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
                  <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    className={`${action} w-fit`}
                    disabled={busy || speaking || recording === "transcribing"}
                    onClick={() => startRecording()}
                  >
                    <Mic aria-hidden />
                    {recording === "transcribing" ? "Writing down what you said…" : speaking || busy ? "Your turn comes next" : "Start speaking"}
                  </Button>
                  {(speaking || handsFree.current) && <NeedAMoment onPress={needAMoment} />}
                  </div>
                )}
              </div>
            )}
            <p role="status" className={cn("text-sm text-muted-foreground", !voiceNote && "sr-only")}>
              {voiceNote}
            </p>
            <label className="flex flex-col gap-2 font-medium">
              {talk ? "Or write your answer" : activity === "translate" ? "Your message" : activity === "proofread" ? "Your text" : "Your answer"}
              <Textarea
                ref={answer}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={2000}
                placeholder={activity === "translate" ? "Paste the message here" : activity === "proofread" ? "Paste what you wrote" : activity === "cvReview" || activity === "cvPart" ? "Paste a part of your CV, or write in your own words" : "Write in your own words"}
                className="min-h-20 font-normal md:text-base"
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" variant={talk ? "outline" : "default"} className={`${action} w-fit`} disabled={busy || !draft.trim() || recording !== "idle"}>
                {activity === "translate" ? "Send message" : activity === "proofread" ? "Check it" : "Send answer"}
              </Button>
              {/* Dictate: say it instead of typing, then read it in the box before sending. */}
              {!talk && micOk && (recording === "recording" && dictating.current ? (
                <Button type="button" variant="outline" className={action} onClick={() => stopRecording(true)}>
                  <Square aria-hidden /> Stop dictating
                </Button>
              ) : (
                <Button type="button" variant="outline" className={action} disabled={busy || recording !== "idle"} onClick={() => startRecording(true)}>
                  <Mic aria-hidden /> {recording === "transcribing" ? "Writing it down…" : "Dictate"}
                </Button>
              ))}
            </div>
            {!talk && recording === "recording" && (
              <p className="flex items-center gap-2 text-sm">
                <span aria-hidden className="size-2.5 rounded-full bg-destructive" />
                Listening. What you say goes into the box, and nothing is sent until you press Send.
              </p>
            )}
          </form>
        )}
        <Button variant="ghost" className={`${action} w-fit`} onClick={startOver}>
          Start over
        </Button>
      </div>
    </div>
  );
}
