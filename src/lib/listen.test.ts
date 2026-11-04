import { describe, expect, it } from "vitest";
import { afterWakeWord, beforeStopWord } from "@/lib/listen";

describe("afterWakeWord", () => {
  it("finds the name the way Whisper writes it, and keeps what came after", () => {
    expect(afterWakeWord("Hey Constela, what should I do next?")).toBe("what should I do next?");
    expect(afterWakeWord("hey, Constella.")).toBe("");
    expect(afterWakeWord("Okay Constellation how much is left")).toBe("how much is left");
    expect(afterWakeWord("Um, hi Konstela. Which branch?")).toBe("Which branch?");
  });

  it("ignores speech without the name", () => {
    expect(afterWakeWord("I need to finish my CV today")).toBeNull();
    expect(afterWakeWord("hey constant change")).toBeNull();
    expect(afterWakeWord("")).toBeNull();
  });
});

describe("after the first Hey Constela", () => {
  it("the name alone is enough", () => {
    expect(afterWakeWord("Constela, how much is left?", true)).toBe("how much is left?");
    // What Whisper really wrote for "Constela, which branch should I work on?"
    expect(afterWakeWord("Con Stella, which branch should I work on?", true)).toBe("which branch should I work on?");
    expect(afterWakeWord("Hey Constela, how much is left?", true)).toBe("how much is left?");
    expect(afterWakeWord("Constela, how much is left?")).toBeNull();
    expect(afterWakeWord("I need a job", true)).toBeNull();
  });
});

describe("beforeStopWord", () => {
  it("ends a question with a final stop, the way Whisper writes it", () => {
    expect(beforeStopWord("What should I do next? Stop.")).toBe("What should I do next?");
    expect(beforeStopWord("how much is left stop")).toBe("how much is left");
    expect(beforeStopWord("Stop.")).toBe("");
    // In a loud room Whisper also writes down other people's talk after it.
    expect(beforeStopWord("What should I do next? Stop. Did you see the game last night")).toBe("What should I do next?");
  });

  it("leaves a stop in the middle alone", () => {
    expect(beforeStopWord("When should I stop looking at jobs?")).toBeNull();
    expect(beforeStopWord("I want to stop and rest today, what is easy")).toBeNull();
  });
});
