// "Choose 3 things you want in a job" (My plan, Get ready): what the person is looking for, in their words.
// Stored on this device only. Things to want, never conditions to have.

export const WANTS = [
  { id: "remote", label: "Working from home" },
  { id: "schedule", label: "A fixed schedule" },
  { id: "quiet", label: "A quiet place to work" },
  { id: "clear", label: "Clear instructions" },
  { id: "pay", label: "Fair pay" },
  { id: "learn", label: "Learning new skills" },
  { id: "team", label: "A kind, patient team" },
  { id: "near", label: "Close to home" },
  { id: "part-time", label: "Part-time hours" },
  { id: "grow", label: "A chance to grow" },
] as const;

export type Want = (typeof WANTS)[number]["id"];
export const MAX_WANTS = 3;

const WANTS_KEY = "job-wants";
const IDS: readonly string[] = WANTS.map((w) => w.id);

// Storage can be edited by hand: keep known ids only, no repeats, at most 3.
export function cleanWants(raw: unknown): Want[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((x): x is Want => typeof x === "string" && IDS.includes(x)))].slice(0, MAX_WANTS);
}

export function loadWants(): Want[] {
  try {
    return cleanWants(JSON.parse(localStorage.getItem(WANTS_KEY) || "[]"));
  } catch {
    return [];
  }
}

export function saveWants(wants: Want[]): void {
  try {
    localStorage.setItem(WANTS_KEY, JSON.stringify(cleanWants(wants)));
  } catch {
    // Without storage the step still gets done; the choice lasts this visit.
  }
}

// Adding a fourth is refused rather than swapping one out silently.
export function toggleWant(current: Want[], id: Want): Want[] {
  if (current.includes(id)) return current.filter((w) => w !== id);
  return current.length < MAX_WANTS ? [...current, id] : current;
}
