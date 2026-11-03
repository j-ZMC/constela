import barrierCatalog from "../../backend/config/neurodivergence_job_barriers.json";

export { barrierCatalog };
export type BarrierCategory = (typeof barrierCatalog.categories)[number];
export type BarrierSubtype = BarrierCategory["subtypes"][number];

const STORAGE_KEY = "job-barrier-preferences";
const validIds = new Set(
  barrierCatalog.categories.flatMap((category) => category.subtypes.map((subtype) => `${category.id}:${subtype.id}`)),
);

// The person's own words (tags). No quotes or control characters: they travel as command-line arguments to the job filter.
export const CUSTOM_BLOCKER = /^[\p{L}\p{N} '&+#./-]{1,40}$/u;
export const MAX_CUSTOM_BLOCKERS = 20;

// Lowercase, single spaces. Null when the text cannot be a tag.
export function normalizeCustomBlocker(text: string): string | null {
  const word = text.trim().replace(/\s+/g, " ").toLowerCase();
  return CUSTOM_BLOCKER.test(word) ? word : null;
}

function validSelection(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === "string" && validIds.has(id)))];
}

function validCustom(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const words = value.flatMap((word) => (typeof word === "string" ? (normalizeCustomBlocker(word) ?? []) : []));
  return [...new Set(words)].slice(0, MAX_CUSTOM_BLOCKERS);
}

function readSaved(): { user_blockers?: unknown; custom_blockers?: unknown } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

export function loadBarrierPreferences(): string[] | null {
  const data = readSaved();
  return Array.isArray(data?.user_blockers) ? validSelection(data.user_blockers) : null;
}

export function loadCustomBlockers(): string[] {
  return validCustom(readSaved()?.custom_blockers);
}

// Saving only the catalog choices keeps the words already saved.
export function saveBarrierPreferences(ids: string[], custom: string[] = loadCustomBlockers()): boolean {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ user_blockers: validSelection(ids), custom_blockers: validCustom(custom) }),
    );
    return true;
  } catch {
    return false;
  }
}
