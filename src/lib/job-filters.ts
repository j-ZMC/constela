// Filters on a list of results, in the browser: work mode, pay, company size, verified company.
import type { Job } from "@/lib/jobs";

// Yearly pay bands, by the middle of the job's range. Half the posted ranges start at $100,000 or more,
// so "at least $30,000" would keep almost every job: bands split the jobs into groups instead.
export const PAY_BANDS = {
  "0-50000": [0, 50_000],
  "50000-80000": [50_000, 80_000],
  "80000-120000": [80_000, 120_000],
  "120000-160000": [120_000, 160_000],
  "160000-": [160_000, Infinity],
} as const;

export type JobFilters = {
  mode: "any" | "remote" | "hybrid" | "on_site";
  pay: "any" | "listed" | keyof typeof PAY_BANDS;
  size: "any" | "small" | "medium" | "large";
  verified: boolean;
};
export const NO_FILTERS: JobFilters = { mode: "any", pay: "any", size: "any", verified: false };

// A full-time year: 52 weeks of 40 hours.
const PER_YEAR = { hour: 2080, month: 12, year: 1 } as const;

// The middle of the job's pay range as a yearly amount, or null when there is no pay or its period is not known.
export function yearlyPay(job: Job): number | null {
  const low = job.salary_min ?? job.salary_max;
  const high = job.salary_max ?? job.salary_min;
  if (low === null || high === null || !job.salary_period) return null;
  return ((low + high) / 2) * PER_YEAR[job.salary_period];
}

export function matches(job: Job, f: JobFilters): boolean {
  // "remote" also keeps "remote_inferred": the card says "Probably remote" for those.
  if (f.mode !== "any" && !job.modality_classification.startsWith(f.mode)) return false;
  if (f.pay === "listed" && job.salary_min === null && job.salary_max === null) return false;
  if (f.pay in PAY_BANDS) {
    const [low, high] = PAY_BANDS[f.pay as keyof typeof PAY_BANDS];
    const pay = yearlyPay(job);
    if (pay === null || pay < low || pay >= high) return false;
  }
  if (f.size !== "any" && job.company_size?.size !== f.size) return false;
  if (f.verified && !job.company_verified) return false;
  return true;
}

export const filtersOn = (f: JobFilters) => f.mode !== "any" || f.pay !== "any" || f.size !== "any" || f.verified;

// How many jobs each choice would leave, with the other filters as they are; so no choice leads to nothing unseen.
export function countWith<K extends keyof JobFilters>(jobs: Job[], f: JobFilters, name: K, value: JobFilters[K]): number {
  const next = { ...f, [name]: value };
  return jobs.filter((job) => matches(job, next)).length;
}

// Filters are kept in this browser, one set per list ("jobs" for Jobs for you and searches, "internships"), so a new
// search, Back or a reload never throws away what the person chose. Storage can be edited by hand: unknown values
// fall back to "any".
const FILTERS_KEY = "job-filters";
const MODES: JobFilters["mode"][] = ["any", "remote", "hybrid", "on_site"];
const SIZES: JobFilters["size"][] = ["any", "small", "medium", "large"];
const PAYS: JobFilters["pay"][] = ["any", "listed", ...(Object.keys(PAY_BANDS) as (keyof typeof PAY_BANDS)[])];

function readAll(): Record<string, unknown> {
  try {
    const all: unknown = JSON.parse(localStorage.getItem(FILTERS_KEY) ?? "{}");
    return typeof all === "object" && all !== null && !Array.isArray(all) ? (all as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function cleanFilters(raw: unknown): JobFilters {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const pick = <T,>(value: unknown, options: T[]) => (options.includes(value as T) ? (value as T) : options[0]);
  return { mode: pick(r.mode, MODES), pay: pick(r.pay, PAYS), size: pick(r.size, SIZES), verified: r.verified === true };
}

export const loadFilters = (list: string): JobFilters => cleanFilters(readAll()[list]);

export function saveFilters(list: string, filters: JobFilters): void {
  try {
    localStorage.setItem(FILTERS_KEY, JSON.stringify({ ...readAll(), [list]: filters }));
  } catch {
    // Private mode: the filters still work for this visit.
  }
}
