// The evaluation's own check of what the AI wrote. Written apart from the guards in src/lib/employer-ai.ts, from the same
// rules, so a bug in one shows up as a disagreement with the other.
import { findExclusionaryPhrases } from "@/lib/vacancy";

const GRAMMAR = new Set(
  "a an the and or but of to with at on in for from by as into about using it its they them their you your we our us this these those that which who is are be".split(" "),
);
const words = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

// Two forms of one word share a base of at least 4 letters once an ending is taken off.
function base(word: string): string {
  const match = /^(.{4,}?)(?:ing|ed|es|s|e)$/.exec(word);
  return match ? match[1] : word;
}

export function rewriteIssues(line: string, text: string): string[] {
  const said = new Set(words(line).map(base));
  const issues: string[] = [];
  if (!text.trim()) issues.push("empty");
  if (findExclusionaryPhrases(text).length > 0) issues.push("keeps a vague phrase");
  if ((text.match(/\d+/g) ?? []).some((n) => !line.includes(n))) issues.push("adds a number");
  if (!text.includes("[") && words(text).some((w) => !GRAMMAR.has(w) && !said.has(base(w)))) issues.push("adds a fact with no [bracket]");
  if (text.length > (line.length > 120 ? 400 : 120)) issues.push("too long");
  return issues;
}

export const statedIn = (posting: string) => {
  const said = posting.replace(/[\s,.]/g, "");
  return (n: unknown) => typeof n !== "number" || said.includes(String(n).replace(/[\s,.]/g, ""));
};

// Every number a draft carries: the salary, each duration and the answer time.
export function numbersIn(draft: { salary?: unknown; process?: unknown; responseDays?: unknown } | null): unknown[] {
  if (!draft) return [];
  const salary = draft.salary as { min?: unknown; max?: unknown } | null | undefined;
  const steps = Array.isArray(draft.process) ? (draft.process as { minutes?: unknown }[]) : [];
  return [salary?.min, salary?.max, ...steps.map((s) => s.minutes), draft.responseDays].filter((n) => n !== null && n !== undefined);
}

export const json = (text: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};
