import barrierCatalog from "../../backend/config/neurodivergence_job_barriers.json";

export { barrierCatalog };
export type BarrierCategory = (typeof barrierCatalog.categories)[number];
export type BarrierSubtype = BarrierCategory["subtypes"][number];

const STORAGE_KEY = "job-barrier-preferences";
const validIds = new Set(
  barrierCatalog.categories.flatMap((category) => category.subtypes.map((subtype) => `${category.id}:${subtype.id}`)),
);

// How Job conditions shows the catalog: by kind of situation, never by condition name, so nobody has to pick a
// diagnosis to find what they want flagged. The IDs stay "category:subtype", as saved and as the job filter knows them.
const GROUPS: ReadonlyArray<{ name: string; ids: readonly string[] }> = [
  { name: "Noise, light and other senses", ids: ["autism_spectrum:sensory_load", "sensory_processing_differences:sound", "sensory_processing_differences:visual_and_light", "sensory_processing_differences:smell_touch_temperature_and_crowding", "adhd:distraction_and_interruptions"] },
  { name: "Time pressure and breaks", ids: ["adhd:time_pressure_and_rigidity", "dyslexia:time_pressure_for_text", "ocd:tight_time_pressure", "tourette_and_tic_disorders:high_pressure_and_no_breaks"] },
  { name: "Changes and unclear tasks", ids: ["adhd:ambiguity_and_task_switching", "autism_spectrum:ambiguity_and_unpredictability", "ocd:uncertainty_and_last_minute_changes", "trauma_related_cptsd:unpredictability_and_safety", "developmental_coordination_disorder:sequencing_and_learning_tasks"] },
  { name: "People and communication", ids: ["autism_spectrum:social_and_communication_demands", "tourette_and_tic_disorders:social_visibility_demands", "trauma_related_cptsd:conflict_and_threat"] },
  { name: "Reading and writing", ids: ["dyslexia:high_reading_load", "dyslexia:written_accuracy_and_output", "dysgraphia:handwriting_volume", "dysgraphia:writing_speed_and_legibility", "dysgraphia:fine_motor_writing"] },
  { name: "Numbers", ids: ["dyscalculia:mental_arithmetic", "dyscalculia:numerical_data_and_finance", "dyscalculia:measurement_and_estimation"] },
  { name: "Movement and hands", ids: ["developmental_coordination_disorder:fine_motor_precision", "developmental_coordination_disorder:physical_coordination_and_balance", "tourette_and_tic_disorders:rigid_silence_or_stillness_rules"] },
  { name: "Challenge and freedom", ids: ["high_abilities_giftedness:low_challenge_or_repetition", "high_abilities_giftedness:limited_autonomy", "high_abilities_giftedness:limited_growth"] },
  { name: "Distressing content or materials", ids: ["trauma_related_cptsd:traumatic_content_exposure", "ocd:user_selected_environmental_triggers"] },
];

const SUBTYPES = new Map<string, BarrierSubtype>(
  barrierCatalog.categories.flatMap((category) => category.subtypes.map((subtype) => [`${category.id}:${subtype.id}`, subtype])),
);
export const barrierGroups = GROUPS.map((group) => ({
  name: group.name,
  options: group.ids.map((id) => ({ id, subtype: SUBTYPES.get(id)! })),
}));

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
