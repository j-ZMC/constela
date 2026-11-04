// Jobs the person saved, kept in this browser like the rest of the profile. Saving a job and sending an
// application tell My plan (markEvent), which moves the person along the path.
import { useMemo, useSyncExternalStore } from "react";
import { z } from "zod";
import { companyResearch } from "@/lib/company-research";
import { postingSummary } from "@/lib/posting-summary";
import { apiJobSchema, type Job } from "@/lib/jobs";
import { markEvent } from "@/lib/plan";

const KEY = "saved-jobs";
const CHANGE = "saved-jobs-change";
export const MAX_SAVED = 50;

// Storage can be edited by hand: a job link must still be a web link before it becomes an href.
const savedSchema = z.object({
  job: apiJobSchema.refine((job) => job.url === null || /^https?:\/\//i.test(job.url)),
  savedAt: z.string(),
  appliedAt: z.string().optional(),
  // What the web search found about the company (src/lib/company-research.ts), kept so it is looked up once.
  research: companyResearch.optional(),
  // What the job's own page asks for in experience (src/lib/job-posting.ts).
  posting: postingSummary.optional(),
});
export type SavedJob = z.infer<typeof savedSchema>;

export const jobKey = (job: Job) => job.url ?? `${job.company}:${job.title}`;

export function parseSavedJobs(raw: string | null): SavedJob[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.flatMap((item) => {
      const parsed = savedSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  } catch {
    return [];
  }
}

function snapshot(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

// Entries this version cannot read (hand-edited, or saved by a newer or older Constela). They are kept as they are,
// never dropped: writing only the readable jobs back would quietly delete the others.
function unreadable(): unknown[] {
  try {
    const data: unknown = JSON.parse(snapshot() ?? "[]");
    return Array.isArray(data) ? data.filter((item) => !savedSchema.safeParse(item).success) : [];
  } catch {
    return [];
  }
}

function write(list: SavedJob[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify([...list, ...unreadable()]));
  } catch {
    return false; // Private mode or full storage: nothing was saved.
  }
  window.dispatchEvent(new Event(CHANGE));
  return true;
}

// "full" when MAX_SAVED jobs are saved already, "failed" when the browser would not store it.
export function saveJob(job: Job, now = new Date()): "saved" | "full" | "failed" {
  const list = parseSavedJobs(snapshot());
  if (list.some((saved) => jobKey(saved.job) === jobKey(job))) return "saved";
  if (list.length >= MAX_SAVED) return "full";
  if (!write([{ job, savedAt: now.toISOString() }, ...list])) return "failed";
  markEvent("job-saved");
  return "saved";
}

export function unsaveJob(key: string): void {
  write(parseSavedJobs(snapshot()).filter((saved) => jobKey(saved.job) !== key));
}

// The person says they sent it; Constela never sends anything itself.
export function markApplied(key: string, now = new Date()): void {
  const list = parseSavedJobs(snapshot());
  // Already marked (a double tap, or two tabs): once is enough, for the date and for My plan.
  if (list.some((saved) => jobKey(saved.job) === key && saved.appliedAt)) return;
  if (write(list.map((saved) => (jobKey(saved.job) === key ? { ...saved, appliedAt: now.toISOString() } : saved)))) {
    markEvent("application-sent");
  }
}

// Keeps what was looked up about a saved job: the web search and what its posting asks for.
export function updateSaved(key: string, found: Pick<SavedJob, "research" | "posting">): void {
  write(parseSavedJobs(snapshot()).map((saved) => (jobKey(saved.job) === key ? { ...saved, ...found } : saved)));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onChange); // another tab
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// Every card and tab reads the same list, so saving in Search shows at once in Saved.
export function useSavedJobs(): SavedJob[] {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  return useMemo(() => parseSavedJobs(raw), [raw]);
}
