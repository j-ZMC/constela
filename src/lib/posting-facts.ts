// What real job posts leave out, measured by `npm run eval:postings` (evals/POSTINGS.md). The JSON is written by that
// run, never by hand, so the app says only what was measured.
import facts from "@/lib/posting-facts.json";

// "6 in 10", in whole numbers: easier to read than a percentage.
export const inTen = (share: number) => `${Math.round(share * 10)} in 10`;
export function inHundred(share: number): string {
  const n = Math.round(share * 100);
  return n === 0 && share > 0 ? "fewer than 1 in 100" : `${n} in 100`;
}

export type PostingFacts = { postings: number; vague: number; answerTime: number; clearAtBest: number };

export function postingFactsLine({ postings, vague, answerTime }: PostingFacts = facts): string {
  const answer = answerTime === 0 ? "none says when they will answer" : `${inHundred(answerTime)} say when they will answer`;
  return `We read ${postings.toLocaleString("en-US")} real job posts: ${inTen(vague)} use a vague phrase, and ${answer}.`;
}
