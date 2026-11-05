import { describe, expect, it } from "vitest";
import { countWords, needsEasier, soundsUnsure, type AnswerSignals } from "@/lib/practice-signals";

// With the default 25 words: 2.5 words per second.
const steady = { seconds: 10, pauses: 0.05 };
const halting = { seconds: 10, pauses: 0.4 };
const answer = (over: Partial<AnswerSignals> = {}): AnswerSignals => ({ words: 25, unsure: false, paused: false, ...over });

describe("adjust the practice to how it is going", () => {
  it("eases on what the task shows: not knowing, or asking for a moment", () => {
    expect(needsEasier([answer({ unsure: true })])).toBe(true);
    expect(needsEasier([answer({ paused: true })])).toBe(true);
    expect(needsEasier([answer()])).toBe(false);
    expect(needsEasier([])).toBe(false);
  });

  it("never eases on the voice alone", () => {
    expect(needsEasier([answer({ voice: steady }), answer({ voice: halting })])).toBe(false);
  });

  it("counts the voice only as a change from the same person's earlier answers", () => {
    // A short answer with more pauses than before: ease.
    expect(needsEasier([answer({ voice: steady }), answer({ words: 3, voice: { seconds: 1.2, pauses: 0.3 } })])).toBe(true);
    // A short answer spoken much slower than before (1 word per second): ease.
    expect(needsEasier([answer({ voice: steady }), answer({ words: 3, voice: { seconds: 3, pauses: 0.05 } })])).toBe(true);
    // Someone who always pauses a lot, at their usual pace: no change, no effect.
    expect(needsEasier([answer({ voice: halting }), answer({ words: 3, voice: { seconds: 1.2, pauses: 0.4 } })])).toBe(false);
    // The first answer has nothing to compare with.
    expect(needsEasier([answer({ words: 3, voice: halting })])).toBe(false);
  });

  it("hears unsure answers and counts words", () => {
    expect(soundsUnsure("Hmm, I don't know what to say")).toBe(true);
    expect(soundsUnsure("Can you repeat the question?")).toBe(true);
    expect(soundsUnsure("I passed my exams")).toBe(false);
    expect(countWords("  I like   people ")).toBe(3);
  });
});
