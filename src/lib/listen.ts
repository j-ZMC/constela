// "Hey Constela": one spoken message at a time, recorded in the browser and written down by Whisper on this
// computer (/api/interview/transcribe), which deletes the recording right after. Browser only, except afterWakeWord.

// How loud counts as speech, as in the Interview page's Talk mode.
const SPEECH_LEVEL = 0.02;

// What Whisper writes for "Hey Constela", which it does not know: "Hey, Constella", "Okay Constellation", and for
// the name alone even "Con Stella"...
const WAKE = /\b(?:hey|hi|hay|okay|ok|oye)[\s,.!]+(?:k|c)on[\s-]?stel+(?:a|ah|ation)\b[\s,.!?]*/i;
// Once the person has said "Hey Constela", the name alone is enough.
const NAME_ONLY = /\b(?:k|c)on[\s-]?stel+(?:a|ah|ation)\b[\s,.!?]*/i;

// What was said after "Hey Constela" (or after "Constela", with nameOnly), "" for the name alone, or null when
// it was not said.
export function afterWakeWord(text: string, nameOnly = false): string | null {
  const m = (nameOnly ? NAME_ONLY : WAKE).exec(text);
  return m ? text.slice(m.index + m[0].length).trim() : null;
}

// "Stop" ends the question, even in a room too loud to hear a pause: said as its own sentence ("... next? Stop."),
// where other people's talk may follow it, or as the last word. Not "stop" inside a sentence ("when should I stop").
const STOP_ALONE = /(?:^|(?<=[.?!,])\s*)stop(?=[\s.!?,]|$)/i;
const STOP_LAST = /[\s,]*\bstop\b[\s,.!?]*$/i;

// What was said before that "stop", or null when there is none.
export function beforeStopWord(text: string): string | null {
  const m = STOP_ALONE.exec(text) ?? STOP_LAST.exec(text);
  return m ? text.slice(0, m.index).trim() : null;
}

export const canListen = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

// Records from an open microphone until the person pauses. Null when nobody spoke within waitMs, or on abort.
// finish: end now and keep what was said. check: every checkMs while the person talks, gets the recording so far and
// ends it when it says so (a spoken "stop"); one check at a time.
export function recordOnce(
  stream: MediaStream,
  {
    waitMs,
    pauseMs,
    maxMs = 30_000,
    signal,
    finish,
    onLevel,
    check,
    checkMs = 2500,
  }: {
    waitMs: number;
    pauseMs: number;
    maxMs?: number;
    signal?: AbortSignal;
    finish?: AbortSignal;
    onLevel?: (level: number) => void;
    check?: (soFar: Blob) => Promise<boolean>;
    checkMs?: number;
  },
): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve(null);
    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const audio = new AudioContext();
    const analyser = audio.createAnalyser();
    analyser.fftSize = 2048;
    audio.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    const opened = performance.now();
    let spoke = 0;
    let lastSound = opened;
    let before = opened;
    let ended = false;
    let checking = false;
    let lastCheck = opened;

    const end = (keep: boolean) => {
      if (ended) return;
      ended = true;
      clearInterval(meter);
      signal?.removeEventListener("abort", abort);
      finish?.removeEventListener("abort", finishNow);
      audio.close().catch(() => {});
      rec.onstop = () => resolve(keep ? new Blob(chunks, { type: rec.mimeType }) : null);
      if (rec.state === "recording") rec.stop();
      else resolve(null);
    };
    const abort = () => end(false);
    const finishNow = () => end(true);
    signal?.addEventListener("abort", abort);
    finish?.addEventListener("abort", finishNow);

    const meter = setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      const level = Math.sqrt(samples.reduce((sum, v) => sum + v * v, 0) / samples.length);
      const t = performance.now();
      onLevel?.(Math.min(1, level * 8));
      if (level > SPEECH_LEVEL) {
        spoke += t - before;
        lastSound = t;
      }
      before = t;
      const talked = spoke > 300;
      if ((talked && t - lastSound > pauseMs) || t - opened > maxMs) end(talked);
      else if (!talked && t - opened > waitMs) end(false);
      else if (check && talked && !checking && t - lastCheck > checkMs) {
        checking = true;
        lastCheck = t;
        check(new Blob(chunks, { type: rec.mimeType }))
          .then((done) => done && end(true))
          .catch(() => {})
          .finally(() => (checking = false));
      }
    }, 100);
    // In half-second pieces, so a check can read what was said so far.
    rec.start(500);
  });
}

export type HeardError = "unavailable" | "failed";

// Whisper on this computer writes down the recording.
export async function writeDown(audio: Blob, signal?: AbortSignal): Promise<string> {
  const form = new FormData();
  form.set("audio", audio, "message");
  const res = await fetch("/api/interview/transcribe", { method: "POST", body: form, signal });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error === "unavailable" ? "unavailable" : "failed");
  return String(data?.text ?? "").trim();
}
