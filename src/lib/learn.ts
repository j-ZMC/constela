// Learn: which resources fit the person, and the filters on the full list. Runs in the browser, on what is already
// saved on this device (saved jobs and the CV's skills); nothing is sent anywhere to pick courses.
import { AREAS, COSTS, FORMATS, KINDS, RESOURCES, type Area, type Cost, type Format, type Kind, type Resource } from "@/lib/learn-resources";
import type { SavedJob } from "@/lib/saved-jobs";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Whole words only, in any language: "sql" matches "SQL," but "ai" does not match "said".
const word = (skill: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(skill)}(?![\\p{L}\\p{N}])`, "iu");

const ALL_SKILLS = [...new Set(RESOURCES.flatMap((r) => r.skills))];
// Picks lean on things that teach: courses and programs before guides, and forums last (they help, but do not teach).
const TEACHES: Record<Resource["kind"], number> = { course: 0, certification: 0, program: 0, bootcamp: 0, guide: 1, repository: 1, community: 2 };

export type SkillGap = { skill: string; jobs: number };
export type Pick = { resource: Resource; skills: SkillGap[] };

// What the saved jobs ask for that the CV does not show, and the resources that teach it. A skill counts once per
// job, and resources that cover more of the gap come first; free ones first on a tie.
export function recommend(saved: SavedJob[], cvSkills: readonly string[], limit = 6): { gaps: SkillGap[]; picks: Pick[] } {
  const cv = cvSkills.join(" · ");
  const asked = new Map<string, number>();
  for (const { job, posting } of saved) {
    const text = [job.title, job.description, ...(posting?.required ?? []), ...(posting?.nice ?? [])].join(" \n ");
    for (const skill of ALL_SKILLS) {
      if (word(skill).test(text) && !word(skill).test(cv)) asked.set(skill, (asked.get(skill) ?? 0) + 1);
    }
  }
  const gaps = [...asked].map(([skill, jobs]) => ({ skill, jobs })).sort((a, b) => b.jobs - a.jobs || a.skill.localeCompare(b.skill));
  const picks = RESOURCES.flatMap((resource) => {
    const skills = gaps.filter((g) => resource.skills.includes(g.skill));
    return skills.length ? [{ resource, skills }] : [];
  })
    .map((p) => ({ ...p, score: p.skills.reduce((sum, s) => sum + s.jobs, 0) }))
    .sort(
      (a, b) =>
        TEACHES[a.resource.kind] - TEACHES[b.resource.kind] ||
        b.score - a.score ||
        Number(b.resource.cost === "free") - Number(a.resource.cost === "free"),
    )
    .slice(0, limit)
    .map(({ resource, skills }) => ({ resource, skills }));
  return { gaps, picks };
}

export type LearnFilters = { area: "all" | Area; kind: "all" | Kind; cost: "all" | Cost; format: "all" | Format; students: boolean; text: string };
export const NO_LEARN_FILTERS: LearnFilters = { area: "all", kind: "all", cost: "all", format: "all", students: false, text: "" };

export function matchesLearn(r: Resource, f: LearnFilters): boolean {
  if (f.area !== "all" && !r.areas.includes(f.area)) return false;
  if (f.kind !== "all" && r.kind !== f.kind) return false;
  if (f.cost !== "all" && r.cost !== f.cost) return false;
  if (f.format !== "all" && r.format !== f.format) return false;
  if (f.students && !r.students) return false;
  const text = f.text.trim().toLowerCase();
  if (text) {
    const haystack = [r.title, r.provider, r.about, ...r.skills, ...r.areas.map((a) => AREAS[a])].join(" ").toLowerCase();
    if (!text.split(/\s+/).every((w) => haystack.includes(w))) return false;
  }
  return true;
}

// How many resources a choice would leave, with the other filters as they are.
export function countLearn<K extends keyof LearnFilters>(f: LearnFilters, name: K, value: LearnFilters[K], list = RESOURCES): number {
  const next = { ...f, [name]: value };
  return list.filter((r) => matchesLearn(r, next)).length;
}

// Kept in this browser, like the job filters, so a reload never throws them away. Unknown values fall back to "all".
const KEY = "learn-filters";

export function loadLearnFilters(): LearnFilters {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    const pick = <T extends string>(value: unknown, options: readonly T[]): "all" | T => (options.includes(value as T) ? (value as T) : "all");
    return {
      area: pick(r.area, Object.keys(AREAS) as Area[]),
      kind: pick(r.kind, Object.keys(KINDS) as Kind[]),
      cost: pick(r.cost, Object.keys(COSTS) as Cost[]),
      format: pick(r.format, Object.keys(FORMATS) as Format[]),
      students: r.students === true,
      text: typeof r.text === "string" ? r.text.slice(0, 80) : "",
    };
  } catch {
    return NO_LEARN_FILTERS;
  }
}

export function saveLearnFilters(f: LearnFilters): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(f));
  } catch {
    // Private mode: the filters still work for this visit.
  }
}
