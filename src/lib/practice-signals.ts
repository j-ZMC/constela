// "Adjust the practice to how it is going": after each answer in an interview practice, should the next question be
// easier? Only when the person turned it on. Nothing here is shown, kept or sent; it only sets one flag (`ease`) on the
// next request to the interview AI on this computer.
//
// The task counts most: an "I don't know", a pause the person asked for, a very short answer. Voice and face are weak
// evidence (the voice model hears a calm synthetic voice as "angry"), so they never decide alone, and they count only
// as a change from this same person's earlier answers in this practice, never against anyone else.
import type { Tone } from "@/lib/whisper";

export type AnswerSignals = {
  words: number;
  unsure: boolean; // "I don't know", "can you repeat", "I'm stuck"...
  paused: boolean; // pressed "I need a moment" (or raised a hand) since the last answer
  tone?: Tone; // from the voice, Talk mode only
  tension?: number; // 0 to 1, from the face, camera on only
};

const UNSURE = /\b(i don'?t know|i do not know|not sure|no idea|can you repeat|repeat (that|the question)|i'?m stuck|i am stuck|pass|skip)\b/i;
export const soundsUnsure = (text: string) => UNSURE.test(text);
export const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined);
// How strained the voice sounds to the model.
const strain = (s: AnswerSignals) => (s.tone ? s.tone.angry + s.tone.sad : undefined);

// Rises above this person's own earlier answers: voice by a quarter, face by 0.15.
function risen(history: AnswerSignals[], read: (s: AnswerSignals) => number | undefined, margin: number): boolean {
  const now = read(history[history.length - 1]);
  const before = mean(history.slice(0, -1).map(read).filter((v): v is number => v !== undefined));
  return now !== undefined && before !== undefined && now - before > margin;
}

export function needsEasier(history: AnswerSignals[]): boolean {
  const last = history.at(-1);
  if (!last) return false;
  let score = 0;
  if (last.unsure) score += 0.5;
  if (last.paused) score += 0.5;
  if (last.words < 6) score += 0.25;
  if (risen(history, strain, 0.25)) score += 0.25;
  if (risen(history, (s) => s.tension, 0.15)) score += 0.25;
  return score >= 0.5;
}
