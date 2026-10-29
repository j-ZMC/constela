import barrierCatalog from "../../backend/config/neurodivergence_job_barriers.json";

export { barrierCatalog };
export type BarrierCategory = (typeof barrierCatalog.categories)[number];
export type BarrierSubtype = BarrierCategory["subtypes"][number];

const STORAGE_KEY = "job-barrier-preferences";
const validIds = new Set(
  barrierCatalog.categories.flatMap((category) => category.subtypes.map((subtype) => `${category.id}:${subtype.id}`)),
);

function validSelection(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === "string" && validIds.has(id)))];
}

export function loadBarrierPreferences(): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const data = JSON.parse(raw);
    return Array.isArray(data?.user_blockers) ? validSelection(data.user_blockers) : null;
  } catch {
    return null;
  }
}

export function saveBarrierPreferences(ids: string[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user_blockers: validSelection(ids) }));
    return true;
  } catch {
    return false;
  }
}
