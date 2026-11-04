// "What is hard for you?": optional picks at the start of the Profile. Each turns on help that already exists:
// answers to the Profile questions (so toAdaptations() picks them up) and Personalize settings. Nothing here is sent
// anywhere.
import type { Answers } from "@/lib/profile";
import { PRESETS, type Prefs } from "@/lib/personalization";

// The visual settings that often help with each kind of neurodivergence. Used two ways:
// - Each "What is hard" pick draws its visuals from one entry (`visual`), so answering by need is enough.
// - "Shortcuts by type" lets the person turn an entry on directly. Which ones they chose is never saved or sent;
//   only the resulting settings are, the same as changing them by hand in Personalize.
export const NEURO_TYPES = {
  adhd: { label: "ADHD", prefs: { detail: "reduced", focus: true, calm: true } },
  autism: { label: "Autism", prefs: { calm: true, soft: 1, detail: "reduced" } },
  // No extra letter spacing: OpenDyslexic is already wide, and more made words fall apart.
  dyslexia: { label: "Dyslexia", prefs: { font: "dyslexic", size: 115, lh: 1.8, width: 65 } },
  dyscalculia: { label: "Dyscalculia", prefs: { size: 110, lh: 1.6, detail: "reduced" } },
  dysgraphia: { label: "Dysgraphia", prefs: { size: 110, ctlSize: 48 } },
  dyspraxia: { label: "Dyspraxia (DCD)", prefs: { ctlSize: 52, iconSize: 24, cursor: "large" } },
  tourette: { label: "Tourette", prefs: { ctlSize: 48, calm: true } },
  ocd: { label: "OCD", prefs: { calm: true, detail: "reduced" } },
  // Light sensitivity: the dark palette (only when the person has not chosen colors), and no movement or glow.
  sensory: { label: "Sensory processing differences", prefs: { calm: true, preset: "dark" } },
  auditory: { label: "Auditory processing differences", prefs: { slowVoice: true, size: 105 } },
} as const satisfies Record<string, { label: string; prefs: Partial<Prefs> }>;
export type NeuroType = keyof typeof NEURO_TYPES;
export const NEURO_TYPE_IDS = Object.keys(NEURO_TYPES) as NeuroType[];

export type HelpPick = {
  id: string;
  hard: string; // what is hard, in the person's words
  help: string; // what turns on
  answers?: Answers;
  visual?: NeuroType; // whose screen settings this pick turns on
  often: readonly NeuroType[]; // shown as "Often helpful with", so each pick says which neurodivergence it relates to
};

export const HELP: readonly HelpPick[] = [
  {
    id: "reading",
    hard: "Reading long texts",
    help: "Short summaries, a Listen button, and an easier font with more space.",
    answers: { reading: "listen", longText: "tiring" },
    visual: "dyslexia",
    often: ["dyslexia", "adhd"],
  },
  { id: "unclear", hard: "Instructions that are not clear", help: "Instructions as numbered steps with an example.", answers: { unclear: "stuck" }, often: ["autism", "adhd"] },
  {
    id: "starting",
    hard: "Getting started, or too many things at once",
    help: "One step at a time, big tasks broken down, and less on screen.",
    answers: { startBlockers: ["too-many-options", "big-tasks"] },
    visual: "adhd",
    often: ["adhd"],
  },
  { id: "changes", hard: "Sudden changes", help: "We tell you what to expect, on a calm, predictable screen.", answers: { changes: "heads-up" }, visual: "autism", often: ["autism", "ocd"] },
  { id: "screen", hard: "Bright or busy screens", help: "A dark screen, and Calm mode: no movement or glow.", visual: "sensory", often: ["sensory", "autism"] },
  { id: "precision", hard: "Small buttons or precise movements", help: "Bigger buttons, icons and cursor.", visual: "dyspraxia", often: ["dyspraxia", "dysgraphia"] },
  { id: "speech", hard: "Following fast speech", help: "A slower AI voice, with captions while it talks.", visual: "auditory", often: ["auditory", "adhd"] },
];

// Joins two sets of screen settings: the stronger choice wins, so adding help never takes help away.
const CURSOR = ["default", "large", "xlarge"] as const;
const NUMBERS = ["size", "lh", "ls", "width", "ctlSize", "iconSize", "soft"] as const;
export function mergePrefs(base: Prefs, add: Partial<Prefs>): Prefs {
  const next: Prefs = { ...base };
  for (const k of NUMBERS) if (add[k] !== undefined) next[k] = Math.max(base[k], add[k]!);
  for (const k of ["calm", "focus", "slowVoice"] as const) if (add[k]) next[k] = true;
  if (add.detail === "reduced") next.detail = "reduced";
  if (add.font && (base.font === "default" || add.font === "dyslexic")) next.font = add.font;
  if (add.cursor && CURSOR.indexOf(add.cursor) > CURSOR.indexOf(base.cursor)) next.cursor = add.cursor;
  // A palette (the dark one for light sensitivity) only replaces the default, never colors the person chose.
  const palette = add.preset ? PRESETS.find((p) => p.id === add.preset) : undefined;
  if (palette?.colors && base.colors === null) {
    next.preset = palette.id;
    next.colors = palette.colors;
  }
  return next;
}

// What a set of screen settings does, in plain words, for the shortcut list.
export function describeVisual(p: Partial<Prefs>): string {
  return [
    p.font === "dyslexic" && "an easier-to-read font",
    p.size && "bigger text",
    (p.lh || p.ls) && "more space",
    p.width && "shorter lines",
    p.preset === "dark" && "a dark screen",
    p.calm && "Calm mode",
    p.soft && "softer light",
    p.detail === "reduced" && "less on screen",
    p.focus && "a clearer focus outline",
    (p.ctlSize || p.iconSize) && "bigger buttons",
    p.cursor && p.cursor !== "default" && "a bigger cursor",
    p.slowVoice && "a slower voice",
  ]
    .filter((s): s is string => typeof s === "string")
    .join(", ")
    .replace(/^./, (c) => c.toUpperCase());
}

const KEY = "help-picks";

// Turns the picks and shortcuts on, on top of what the person already chose. Lists are joined, and "Nothing in
// particular" gives way to a real answer, as a real answer should.
export function applyHelp(
  picks: readonly string[],
  answers: Answers,
  prefs: Prefs,
  types: readonly NeuroType[] = [],
): { answers: Answers; prefs: Prefs } {
  const nextAnswers: Record<string, unknown> = { ...answers };
  let nextPrefs = prefs;
  for (const pick of HELP.filter((h) => picks.includes(h.id))) {
    for (const [question, value] of Object.entries(pick.answers ?? {})) {
      const before = nextAnswers[question];
      nextAnswers[question] = Array.isArray(value)
        ? [...new Set([...(Array.isArray(before) ? before.filter((v) => v !== "none") : []), ...value])]
        : value;
    }
    if (pick.visual) nextPrefs = mergePrefs(nextPrefs, NEURO_TYPES[pick.visual].prefs);
  }
  for (const type of types) nextPrefs = mergePrefs(nextPrefs, NEURO_TYPES[type].prefs);
  return { answers: nextAnswers as Answers, prefs: nextPrefs };
}

// null: not asked yet, so the Profile shows the picks first. [] after "Decide later". Only the picks are kept;
// shortcuts by type never are.
export function loadHelpPicks(): string[] | null {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return Array.isArray(raw) ? raw.filter((id): id is string => HELP.some((h) => h.id === id)) : null;
  } catch {
    return null;
  }
}

export function saveHelpPicks(picks: readonly string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(picks));
  } catch {
    // Private mode: the help still turns on for this visit.
  }
}
