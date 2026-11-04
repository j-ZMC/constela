// Reads real job postings with the same phrase detector the editor uses, plus plain checks on what a candidate needs to
// know before applying. Pure, so every check has tests. Run on the dataset with `npm run eval:postings`.
import { findExclusionaryPhrases } from "@/lib/vacancy";

export type Posting = {
  title: string;
  company: string;
  modality: string;
  salary_min: number | null;
  salary_max: number | null;
  description: string;
  source: string;
};

// The collector cut descriptions at about 4,000 characters, so anything that sits at the end of a posting (pay ranges,
// hiring steps, adjustments) is only measured on postings that arrived whole.
export const CUT_AT = 3990;
export const isComplete = (p: Posting) => p.description.length < CUT_AT;

const ENTITIES: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&#39;": "'", "&quot;": '"', "&lt;": "<", "&gt;": ">" };
export const plain = (text: string) =>
  text
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:nbsp|amp|#39|quot|lt|gt);/g, (e) => ENTITIES[e])
    .replace(/\s+/g, " ")
    .trim();

// The same posting can arrive from two job boards.
export const postingKey = (p: Posting) => `${p.title}|${p.company}|${plain(p.description).slice(0, 300)}`.toLowerCase();

const COMMON = new Set("the and to of a in you we for with our is are will be your on as this that or".split(" "));
// The phrase detector reads English, so postings in other languages are left out.
export function isEnglish(text: string): boolean {
  const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
  return words.length > 0 && words.filter((w) => COMMON.has(w)).length / words.length >= 0.15;
}

// Each check looks for the plainest form of a fact a candidate needs. They miss unusual wordings, so the report shows
// random matches for anyone to check, and calls the result an estimate.
export const CHECKS = {
  // Money next to a pay word, a range of amounts, or an amount per hour. A funding round ("raised $20M") or a saving
  // ("save $1,000 a year") is none of these, so a yearly amount needs a pay word or a range. A range may be joined by a
  // dash of any length, or by the "?" a broken encoding left in some posts ("$40?$55/hour").
  pay: /\b(?:salary|pay|compensation|wages?|base|hourly|ote)\b[^.]{0,80}?(?:\$|USD ?)\d|(?:\$|USD ?)\d[\d,.]*\s?[kK]?\s?(?:-|–|—|\?|to)\s?(?:\$|USD ?)?\d[\d,.]*\s?[kK]?|(?:\$|USD ?)\d[\d,.]*\s?(?:\/|per|an?)\s?(?:hour|hr)\b/i,
  workMode: /\b(?:remote|hybrid|on[- ]?site|in[- ]office|in[- ]person|work from home)\b/i,
  schedule: /\bmon(?:day)?\b[^.]{0,25}\bfri(?:day)?\b|\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b|\b\d{1,2}\s?(?:hours|hrs)\s?(?:a|per)\s?week\b/i,
  // "On-call" is a duty of the job, not a step of hiring.
  stepLength:
    /\b\d{1,3}[- ]?(?:minutes?|mins?|hours?)\b[^.]{0,40}\b(?:interview|(?<!on[- ])call|chat|screen|conversation|assessment|exercise)\b|\b(?:interview|(?<!on[- ])call|chat|screen|conversation|assessment|exercise)\b[^.]{0,40}\b\d{1,3}[- ]?(?:minutes?|mins?|hours?)\b/i,
  answerTime:
    /\b(?:respond|reply|replies|hear back|get back to you|answer|contact you|reach out)\b[^.]{0,60}\b(?:within|in)\s+(?:\d+|one|two|three|a)\s+(?:business\s+)?(?:days?|weeks?|hours?)\b/i,
  accommodation: /\baccommodat/i,
} as const;
export type Check = keyof typeof CHECKS;

export type Reading = {
  checks: Record<Check, boolean>;
  vague: string[]; // ids of the vague phrases found, one each
  clarityAtBest: number;
};

// The highest clarity score the posting could get. What a raw posting can't show (tasks, how many requirements, the
// work environment) gets full marks, so the real score is this or lower, as far as the checks find what is there.
export function readPosting(p: Posting): Reading {
  const text = plain(`${p.title}. ${p.description}`);
  const found = (check: Check) => CHECKS[check].test(text);
  const checks = {
    pay: p.salary_min !== null || p.salary_max !== null || found("pay"),
    workMode: p.modality.trim() !== "" || found("workMode"),
    schedule: found("schedule"),
    stepLength: found("stepLength"),
    answerTime: found("answerTime"),
    accommodation: found("accommodation"),
  };
  const vague = findExclusionaryPhrases(text).map((m) => m.id);
  const lost = (checks.pay ? 0 : 15) + (checks.schedule ? 0 : 10) + (checks.workMode ? 0 : 10) + (checks.stepLength && checks.answerTime ? 0 : 10) + (checks.accommodation ? 0 : 5);
  return { checks, vague, clarityAtBest: 100 - lost - Math.min(20, 5 * vague.length) };
}

// Flesch–Kincaid grade, with syllables counted by the usual vowel-group rule. The dataset lost its line breaks, so lists
// run into one long "sentence"; only sentences of 3 to 40 words count.
export function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  return Math.max(1, trimmed.match(/[aeiouy]{1,2}/g)?.length ?? 1);
}

export function readingGrade(text: string): number | null {
  const sentences = plain(text)
    .split(/[.!?]+\s/)
    .map((s) => s.match(/[A-Za-z][A-Za-z'-]*/g) ?? [])
    .filter((words) => words.length >= 3 && words.length <= 40);
  const words = sentences.flat();
  if (sentences.length === 0) return null;
  const perSentence = words.length / sentences.length;
  const perWord = words.reduce((sum, w) => sum + syllables(w), 0) / words.length;
  return 0.39 * perSentence + 11.8 * perWord - 15.59;
}
