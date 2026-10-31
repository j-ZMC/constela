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

// What people see: the catalog regrouped by everyday need. The catalog's own categories are clinical
// (ADHD, OCD…) and stay internal: the backend keeps its ids, and the screen never names a diagnosis.
export const NEEDS_GROUPS: { id: string; label: string; ids: string[] }[] = [
  {
    id: "senses",
    label: "Sound, light and space",
    ids: [
      "sensory_processing_differences:sound",
      "sensory_processing_differences:visual_and_light",
      "sensory_processing_differences:smell_touch_temperature_and_crowding",
      "autism_spectrum:sensory_load",
      "tourette_and_tic_disorders:rigid_silence_or_stillness_rules",
      "ocd:user_selected_environmental_triggers",
    ],
  },
  {
    id: "focus",
    label: "Focus and interruptions",
    ids: ["adhd:distraction_and_interruptions", "developmental_coordination_disorder:sequencing_and_learning_tasks"],
  },
  {
    id: "changes",
    label: "Changes and unclear tasks",
    ids: [
      "adhd:ambiguity_and_task_switching",
      "autism_spectrum:ambiguity_and_unpredictability",
      "ocd:uncertainty_and_last_minute_changes",
      "trauma_related_cptsd:unpredictability_and_safety",
    ],
  },
  {
    id: "pressure",
    label: "Time pressure and breaks",
    ids: [
      "adhd:time_pressure_and_rigidity",
      "ocd:tight_time_pressure",
      "tourette_and_tic_disorders:high_pressure_and_no_breaks",
      "dyslexia:time_pressure_for_text",
    ],
  },
  {
    id: "people",
    label: "People and talking",
    ids: [
      "autism_spectrum:social_and_communication_demands",
      "tourette_and_tic_disorders:social_visibility_demands",
      "trauma_related_cptsd:conflict_and_threat",
      "trauma_related_cptsd:traumatic_content_exposure",
    ],
  },
  {
    id: "words",
    label: "Reading, writing and numbers",
    ids: [
      "dyslexia:high_reading_load",
      "dyslexia:written_accuracy_and_output",
      "dysgraphia:handwriting_volume",
      "dysgraphia:writing_speed_and_legibility",
      "dyscalculia:mental_arithmetic",
      "dyscalculia:numerical_data_and_finance",
      "dyscalculia:measurement_and_estimation",
    ],
  },
  {
    id: "hands",
    label: "Hands-on and physical tasks",
    ids: [
      "dysgraphia:fine_motor_writing",
      "developmental_coordination_disorder:fine_motor_precision",
      "developmental_coordination_disorder:physical_coordination_and_balance",
    ],
  },
  {
    id: "growth",
    label: "Challenge and freedom",
    ids: [
      "high_abilities_giftedness:low_challenge_or_repetition",
      "high_abilities_giftedness:limited_autonomy",
      "high_abilities_giftedness:limited_growth",
    ],
  },
];

const subtypes = new Map(
  barrierCatalog.categories.flatMap((category) =>
    category.subtypes.map((subtype): [string, BarrierSubtype] => [`${category.id}:${subtype.id}`, subtype]),
  ),
);

export function barrierSubtype(id: string): BarrierSubtype | undefined {
  return subtypes.get(id);
}

// The profile maps answers to subtype ids (toJobPreferences); the filter stores "category:subtype".
export function fullBarrierIds(subtypeIds: string[]): string[] {
  return [...subtypes.keys()].filter((id) => subtypeIds.includes(id.split(":")[1]));
}

// What the job filter uses: the person's saved choices, or, until they save any, the ones their profile points to.
export function effectiveBarrierPreferences(profileSubtypeIds: string[]): string[] {
  return loadBarrierPreferences() ?? fullBarrierIds(profileSubtypeIds);
}
