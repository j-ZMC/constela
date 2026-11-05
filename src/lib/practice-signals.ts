// "Adjust the practice to how it is going": after each answer in an interview practice, should the next question be
// easier? Only when the person turned it on. Nothing here is shown, kept or sent; it only sets one flag (`ease`) on the
// next request to the interview AI on this computer.
//
// The task counts most: an "I don't know", a pause the person asked for, a very short answer. The voice is weak
// evidence (people pause and speak at very different paces), so it never decides alone, and it counts only as a
// change from this same person's earlier answers in this practice, never against anyone else. The face is not read.
import type { Voice } from "@/lib/whisper";

export type AnswerSignals = {
  words: number;
  unsure: boolean; // "I don't know", "can you repeat", "I'm stuck"...
  paused: boolean; // pressed "I need a moment" (or raised a hand) since the last answer
  voice?: Voice; // seconds spoken and share of pauses, Talk mode only
};

const UNSURE = /\b(i don'?t know|i do not know|not sure|no idea|can you repeat|repeat (that|the question)|i'?m stuck|i am stuck|pass|skip)\b/i;
export const soundsUnsure = (text: string) => UNSURE.test(text);
export const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined);
const pauses = (s: AnswerSignals) => s.voice?.pauses;
const pace = (s: AnswerSignals) => (s.voice ? s.words / s.voice.seconds : undefined); // words per second

// The last answer next to the mean of this person's earlier answers in this practice.
function compared(history: AnswerSignals[], read: (s: AnswerSignals) => number | undefined) {
  const now = read(history[history.length - 1]);
  const before = mean(history.slice(0, -1).map(read).filter((v): v is number => v !== undefined));
  return now !== undefined && before !== undefined ? { now, before } : undefined;
}

// The voice counts when pauses take 15 points more of the answer, or the pace drops by a quarter.
function voiceHarder(history: AnswerSignals[]): boolean {
  const paused = compared(history, pauses);
  const speed = compared(history, pace);
  return (paused !== undefined && paused.now - paused.before > 0.15) || (speed !== undefined && speed.now < speed.before * 0.75);
}

export function needsEasier(history: AnswerSignals[]): boolean {
  const last = history.at(-1);
  if (!last) return false;
  let score = 0;
  if (last.unsure) score += 0.5;
  if (last.paused) score += 0.5;
  if (last.words < 6) score += 0.25;
  if (voiceHarder(history)) score += 0.25;
  return score >= 0.5;
}
