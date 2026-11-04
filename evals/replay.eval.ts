// Replays the answers the model really gave in a recorded run through the current guards: offline, free and in a second.
// A change to the guards then shows exactly which answers would now pass or fail before a new run spends any tokens.
// Run: npm run eval:replay. It reads evals/results/baseline.json, or the file in REPLAY_FILE.
import { readFileSync } from "node:fs";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { rewriteIssues } from "./checks";
import { runEmployerAi } from "@/lib/employer-ai";

type Recorded = { line: string; delivered?: string; raw: { text: string; issues: string[] }[] };

const answer = (text: string) => ({
  content: [{ type: "text" as const, text }],
  finishReason: { unified: "stop" as const, raw: undefined },
  usage: {
    inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: 0, text: 0, reasoning: undefined },
  },
  warnings: [],
});

describe("replay of recorded answers", () => {
  it("lets nothing unsafe through with the current guards", async () => {
    const file = process.env.REPLAY_FILE ?? "evals/results/baseline.json";
    const { rewrites } = JSON.parse(readFileSync(file, "utf8")) as { rewrites: Recorded[] };
    const now: { line: string; was?: string; is?: string }[] = [];

    for (const r of rewrites) {
      // The same answers, in the same order; the second try gets the second answer the model really gave.
      const answers = r.raw.map((a) => (a.issues.includes("broken answer") ? "not json" : JSON.stringify({ text: a.text })));
      let call = 0;
      const model = new MockLanguageModelV4({ doGenerate: async () => answer(answers[Math.min(call++, answers.length - 1)] ?? "not json") });
      const is = await runEmployerAi({ task: "rewrite", text: r.line }, model).then(
        (value) => value.text,
        () => undefined,
      );
      now.push({ line: r.line, was: r.delivered, is });
    }

    const before = now.filter((n) => n.was !== undefined).length;
    const after = now.filter((n) => n.is !== undefined).length;
    console.log(`Replay of ${file}: ${before} of ${now.length} rewrites reached the employer then, ${after} of ${now.length} with the current guards.`);
    for (const n of now.filter((x) => x.was !== x.is)) console.log(`  "${n.line}": ${n.was === undefined ? "refused" : `"${n.was}"`} -> ${n.is === undefined ? "refused" : `"${n.is}"`}`);

    expect(now.flatMap((n) => (n.is === undefined ? [] : rewriteIssues(n.line, n.is).map((issue) => `${n.line} -> ${n.is}: ${issue}`)))).toEqual([]);
  });
});
