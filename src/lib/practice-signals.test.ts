import { describe, expect, it } from "vitest";
import { countWords, needsEasier, soundsUnsure, type AnswerSignals } from "@/lib/practice-signals";

const calm = { neutral: 0.8, happy: 0.1, angry: 0.05, sad: 0.05 };
const tense = { neutral: 0.3, happy: 0.0, angry: 0.5, sad: 0.2 };
const answer = (over: Partial<AnswerSignals> = {}): AnswerSignals => ({ words: 25, unsure: false, paused: false, ...over });

describe("adjust the practice to how it is going", () => {
  it("eases on what the task shows: not knowing, or asking for a moment", () => {
    expect(needsEasier([answer({ unsure: true })])).toBe(true);
    expect(needsEasier([answer({ paused: true })])).toBe(true);
    expect(needsEasier([answer()])).toBe(false);
    expect(needsEasier([])).toBe(false);
  });

  it("never eases on the voice or the face alone", () => {
    expect(needsEasier([answer({ tone: calm }), answer({ tone: tense })])).toBe(false);
    expect(needsEasier([answer({ tension: 0.1 }), answer({ tension: 0.6 })])).toBe(false);
  });

  it("counts voice and face only as a change from the same person's earlier answers", () => {
    // A short answer plus a voice that sounds more strained than before: ease.
    expect(needsEasier([answer({ tone: calm }), answer({ words: 3, tone: tense })])).toBe(true);
    // Someone the model always hears as "angry": no change, no effect.
    expect(needsEasier([answer({ tone: tense }), answer({ words: 3, tone: tense })])).toBe(false);
    // The first answer has nothing to compare with.
    expect(needsEasier([answer({ words: 3, tone: tense, tension: 0.9 })])).toBe(false);
    // Voice and face rising together.
    expect(needsEasier([answer({ tone: calm, tension: 0.1 }), answer({ tone: tense, tension: 0.5 })])).toBe(true);
  });

  it("hears unsure answers and counts words", () => {
    expect(soundsUnsure("Hmm, I don't know what to say")).toBe(true);
    expect(soundsUnsure("Can you repeat the question?")).toBe(true);
    expect(soundsUnsure("I passed my exams")).toBe(false);
    expect(countWords("  I like   people ")).toBe(3);
  });
});
