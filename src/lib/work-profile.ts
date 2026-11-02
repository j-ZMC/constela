// Constela for Employers: the candidate's work profile (PerfilDeTrabajo), what employers may see of it (Permiso), and how
// candidates are matched to a vacancy. See SPEC-employers.md.
// A profile holds skills and the needs the candidate chose to share, never a diagnosis: .strict() rejects any other field.
import { z } from "zod";
import {
  ENVIRONMENT_FACTORS,
  EQUIVALENT_SKILLS,
  MODALITIES,
  MODALITY_LABELS,
  SKILLS,
  SKILL_IDS,
  factorNames,
  type EnvironmentFactor,
  type Modality,
  type SkillId,
  type Vacancy,
} from "@/lib/vacancy";

export const EVIDENCE = ["verified", "declared"] as const;
export type Evidence = (typeof EVIDENCE)[number];

export const workProfileSchema = z
  .object({
    id: z.string().min(1).max(64),
    headline: z.string().trim().min(1).max(60), // the kind of work they look for, e.g. "Data analyst"
    skills: z
      .array(
        z
          .object({
            skill: z.enum(SKILL_IDS),
            evidence: z.enum(EVIDENCE),
            source: z.string().trim().min(1).max(100).optional(), // who verified it or where it was learned; never ranked
          })
          .strict(),
      )
      .max(30),
    needs: z.array(z.enum(ENVIRONMENT_FACTORS)).max(ENVIRONMENT_FACTORS.length),
    modalities: z.array(z.enum(MODALITIES)).max(MODALITIES.length), // empty means any
    identity: z.object({ name: z.string().trim().min(1).max(80) }).strict(), // hidden until the candidate says yes
  })
  .strict();

export type WorkProfile = z.infer<typeof workProfileSchema>;
export type ProfileSkill = WorkProfile["skills"][number];

// The candidate decides: identity shows only after they accept an invitation, and only for that vacancy.
export type Permission = { candidateId: string; vacancyId: string; status: "invited" | "accepted" | "declined"; at: string };

// The first view employers get. An allowlist, so a field added to WorkProfile later stays hidden until someone adds it here.
// There is no name, photo, age or work-history gap to hide: the profile has no fields for them.
export type AnonymousProfile = Pick<WorkProfile, "id" | "headline" | "skills" | "needs" | "modalities"> & { alias: string };

export function anonymize(p: WorkProfile): AnonymousProfile {
  return {
    id: p.id,
    alias: `Candidate ${p.id.slice(-4).toUpperCase()}`,
    headline: p.headline,
    skills: p.skills,
    needs: p.needs,
    modalities: p.modalities,
  };
}

// The latest answer wins, so saying no after saying yes hides the identity again. ISO times sort as text.
export function latestPermission(permissions: Permission[], candidateId: string, vacancyId: string): Permission | undefined {
  return permissions
    .filter((x) => x.candidateId === candidateId && x.vacancyId === vacancyId)
    .sort((a, b) => a.at.localeCompare(b.at))
    .at(-1);
}

export function identityFor(p: WorkProfile, permissions: Permission[], vacancyId: string): WorkProfile["identity"] | null {
  return latestPermission(permissions, p.id, vacancyId)?.status === "accepted" ? p.identity : null;
}

// The barrier survey's ids start with a diagnosis category ("autism_spectrum:sensory_load"). Only the situation part is
// read and only environment factors come out, so a category never reaches an employer.
const NEEDS_BY_BARRIER: Partial<Record<string, EnvironmentFactor[]>> = {
  distraction_and_interruptions: ["focus_time", "quiet_space"],
  ambiguity_and_task_switching: ["stable_priorities", "written_communication"],
  time_pressure_and_rigidity: ["steady_pace"],
  sensory_load: ["quiet_space", "soft_lighting", "calm_surroundings"],
  social_and_communication_demands: ["written_communication", "limited_public_contact"],
  ambiguity_and_unpredictability: ["stable_priorities", "written_communication"],
  high_reading_load: ["assistive_tools"],
  written_accuracy_and_output: ["assistive_tools"],
  time_pressure_for_text: ["steady_pace", "assistive_tools"],
  mental_arithmetic: ["assistive_tools"],
  numerical_data_and_finance: ["assistive_tools"],
  measurement_and_estimation: ["assistive_tools"],
  handwriting_volume: ["typed_records"],
  writing_speed_and_legibility: ["typed_records"],
  fine_motor_writing: ["typed_records"],
  fine_motor_precision: ["light_physical_work"],
  physical_coordination_and_balance: ["light_physical_work"],
  sequencing_and_learning_tasks: ["step_by_step_training", "written_communication"],
  sound: ["quiet_space"],
  visual_and_light: ["soft_lighting"],
  smell_touch_temperature_and_crowding: ["calm_surroundings"],
  rigid_silence_or_stillness_rules: ["flexible_breaks"],
  high_pressure_and_no_breaks: ["flexible_breaks", "steady_pace"],
  social_visibility_demands: ["limited_public_contact"],
  low_challenge_or_repetition: ["varied_work"],
  limited_autonomy: ["autonomy"],
  limited_growth: ["varied_work"],
  uncertainty_and_last_minute_changes: ["stable_priorities"],
  tight_time_pressure: ["steady_pace"],
  user_selected_environmental_triggers: ["no_cleaning_or_care_duties"],
  traumatic_content_exposure: ["no_distressing_content"],
  conflict_and_threat: ["no_distressing_content"],
  unpredictability_and_safety: ["predictable_schedule"],
};

// A suggestion the candidate reviews before sharing anything; unknown ids are ignored.
export function needsFromBarriers(barrierIds: string[]): EnvironmentFactor[] {
  const picked = new Set(barrierIds.flatMap((id) => NEEDS_BY_BARRIER[id.split(":").pop() ?? ""] ?? []));
  return ENVIRONMENT_FACTORS.filter((f) => picked.has(f));
}

export type Compatibility = {
  met: EnvironmentFactor[];
  gaps: EnvironmentFactor[]; // the job doesn't offer it yet: something the employer could add
  unknown: EnvironmentFactor[]; // the vacancy doesn't describe its environment
  modality: "met" | "gap" | "unknown" | "any";
};

// Explains fit; it never changes the ranking.
export function compatibility(v: Vacancy, p: Pick<WorkProfile, "needs" | "modalities">): Compatibility {
  const offered = v.environment;
  let modality: Compatibility["modality"] = "any";
  if (p.modalities.length > 0) modality = !v.modality ? "unknown" : p.modalities.includes(v.modality) ? "met" : "gap";
  return {
    met: offered ? p.needs.filter((n) => offered.includes(n)) : [],
    gaps: offered ? p.needs.filter((n) => !offered.includes(n)) : [],
    unknown: offered ? [] : [...p.needs],
    modality,
  };
}

// For the candidate's eyes, so it says what the job offers and never what the person lacks.
export function fitSummary(fit: Compatibility): string | null {
  const asked = fit.met.length + fit.gaps.length + fit.unknown.length;
  if (asked === 0) return null;
  if (fit.unknown.length > 0) return "This employer has not described the work environment yet.";
  if (fit.gaps.length === 0) return "This job offers everything you asked for.";
  return `This job offers ${fit.met.length} of the ${asked} ${asked === 1 ? "thing" : "things"} you asked for.`;
}

// Ranking v1 reads essential skills only: exact and verified counts 1, exact and declared 0.6, an equivalent tool half
// of that. Needs, modalities, sources and names are never read, so sharing a need can't cost a place (CV-pair test).
const EVIDENCE_WEIGHT: Record<Evidence, number> = { verified: 1, declared: 0.6 };
const EQUIVALENT_WEIGHT = 0.5;

export type SkillMatch = { requirement: string; skill: SkillId; via?: SkillId; evidence?: Evidence; weight: number };
export type RankedCandidate = { id: string; score: number; matches: SkillMatch[] };

function bestMatch(requirement: string, skill: SkillId, own: ProfileSkill[]): SkillMatch {
  const group = EQUIVALENT_SKILLS.find((g) => g.includes(skill)) ?? [];
  let best: SkillMatch = { requirement, skill, weight: 0 };
  for (const s of own) {
    const exact = s.skill === skill;
    const weight = (exact ? 1 : group.includes(s.skill) ? EQUIVALENT_WEIGHT : 0) * EVIDENCE_WEIGHT[s.evidence];
    if (weight > best.weight) best = { requirement, skill, via: exact ? undefined : s.skill, evidence: s.evidence, weight };
  }
  return best;
}

// Score 0–100 over the skill-tagged essential requirements. Ties keep a stable order by id.
export function rankCandidates(v: Vacancy, profiles: WorkProfile[]): RankedCandidate[] {
  const required = v.essential.flatMap((r) => (r.skill ? [{ text: r.text, skill: r.skill }] : []));
  return profiles
    .map((p) => {
      const matches = required.map((r) => bestMatch(r.text, r.skill, p.skills));
      const total = matches.reduce((sum, m) => sum + m.weight, 0);
      return { id: p.id, score: matches.length ? Math.round((100 * total) / matches.length) : 0, matches };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

const EVIDENCE_WORDS: Record<Evidence, string> = { verified: "checked by Constela", declared: "they say they have it" };

// The reason behind each part of the score, in the words the employer reads.
export function matchReason({ skill, via, evidence }: SkillMatch): string {
  if (!evidence) return `${SKILLS[skill]}: not on this profile`;
  return `${SKILLS[skill]}: ${via ? `they use ${SKILLS[via]}, a similar tool, ${EVIDENCE_WORDS[evidence]}` : EVIDENCE_WORDS[evidence]}`;
}

// The score in words and whole numbers, which is what the employer reads. The score itself still sets the order.
export function skillsLine({ has, similar, total }: Pick<TalentRow, "has" | "similar" | "total">): string {
  const own = `${has} of ${total} ${total === 1 ? "skill" : "skills"}`;
  if (has === 0) return `${similar} similar ${similar === 1 ? "skill" : "skills"}`;
  return similar > 0 ? `${own}, ${similar} similar` : own;
}

// For the employer, so a gap reads as an adjustment they could offer and never as something the person lacks.
export function adjustmentNotes(fit: Compatibility, modalities: Modality[], v: Vacancy): string[] {
  const notes: string[] = [];
  if (fit.met.length > 0) notes.push(`You already offer: ${factorNames(fit.met)}.`);
  if (fit.gaps.length > 0) notes.push(`You could offer: ${factorNames(fit.gaps)}.`);
  if (fit.unknown.length > 0) notes.push(`Would help this person: ${factorNames(fit.unknown)}. Describe your work environment to see what you already offer.`);
  const wanted = modalities.map((m) => MODALITY_LABELS[m].toLowerCase()).join(" or ");
  if (fit.modality === "gap" && v.modality) notes.push(`They prefer ${wanted} work. This job is ${MODALITY_LABELS[v.modality].toLowerCase()}.`);
  if (fit.modality === "unknown") notes.push(`They prefer ${wanted} work. Add the work mode to see if it fits.`);
  return notes;
}

// One person in talent search. Built from the anonymous view on purpose, so a card has no name to show until they say yes.
export type TalentRow = {
  profile: AnonymousProfile;
  name: string | null;
  status: Permission["status"] | null;
  score: number;
  has: number; // essential skills on the profile
  similar: number; // essential skills covered by a similar tool
  total: number;
  reasons: string[];
  notes: string[];
};

// In ranking order. People with none of these skills stay out of the list, unless the employer already invited them.
export function talentRows(v: Vacancy, profiles: WorkProfile[], permissions: Permission[]): TalentRow[] {
  const byId = new Map(profiles.map((p) => [p.id, p]));
  return rankCandidates(v, profiles).flatMap(({ id, score, matches }) => {
    const p = byId.get(id);
    const status = latestPermission(permissions, id, v.id)?.status ?? null;
    if (!p || (score === 0 && !status)) return [];
    return [
      {
        profile: anonymize(p),
        name: identityFor(p, permissions, v.id)?.name ?? null,
        status,
        score,
        has: matches.filter((m) => m.evidence && !m.via).length,
        similar: matches.filter((m) => m.via).length,
        total: matches.length,
        reasons: matches.map(matchReason),
        notes: adjustmentNotes(compatibility(v, p), p.modalities, v),
      },
    ];
  });
}

// Demo talent pool from many kinds of work, not only tech. Names are fictional.
// shortcut: fixed demo profiles with badges marked "demo" because no skills-check module exists yet; replace with
// profiles candidates choose to share once there are accounts.
// shortcut: this pool ships in the browser bundle, so only the screen hides the names; with real people, the server must
// send a name only after a yes.
const DEMO_BADGE = "Constela skill check (demo)";
const verified = (skill: SkillId): ProfileSkill => ({ skill, evidence: "verified", source: DEMO_BADGE });
const declared = (skill: SkillId): ProfileSkill => ({ skill, evidence: "declared" });

export const DEMO_PROFILES: WorkProfile[] = [
  { id: "c-1042", identity: { name: "Maya Torres" }, headline: "Data analyst", skills: [verified("sql"), declared("excel"), declared("tableau")], needs: ["quiet_space", "focus_time", "written_communication"], modalities: ["remote", "hybrid"] },
  { id: "c-2187", identity: { name: "Diego Ramírez" }, headline: "Data analyst", skills: [declared("sql"), verified("google_sheets"), verified("power_bi")], needs: ["predictable_schedule"], modalities: ["remote"] },
  { id: "c-3315", identity: { name: "Ana Lucía Pérez" }, headline: "QA tester", skills: [verified("software_testing"), declared("test_automation"), verified("web_accessibility")], needs: ["stable_priorities", "written_communication"], modalities: [] },
  { id: "c-4480", identity: { name: "Sam Carter" }, headline: "QA tester", skills: [declared("software_testing"), declared("javascript"), declared("git")], needs: [], modalities: ["on-site", "hybrid"] },
  { id: "c-5126", identity: { name: "Jordan Lee" }, headline: "Frontend developer", skills: [verified("typescript"), verified("react"), declared("web_accessibility"), verified("git")], needs: ["focus_time", "flexible_breaks"], modalities: ["remote"] },
  { id: "c-6093", identity: { name: "Valeria Gómez" }, headline: "Frontend developer", skills: [verified("javascript"), declared("vue"), declared("figma")], needs: ["quiet_space"], modalities: ["hybrid", "remote"] },
  { id: "c-7251", identity: { name: "Mateo Cruz" }, headline: "Graphic designer", skills: [verified("figma"), verified("graphic_design"), declared("photo_editing")], needs: ["soft_lighting", "autonomy"], modalities: ["remote"] },
  { id: "c-8364", identity: { name: "Priya Shah" }, headline: "Technical writer", skills: [verified("technical_writing"), declared("proofreading"), declared("research")], needs: ["quiet_space", "steady_pace"], modalities: ["remote"] },
  { id: "c-9417", identity: { name: "Elena Morales" }, headline: "Bookkeeper", skills: [verified("bookkeeping"), declared("quickbooks"), verified("excel")], needs: ["predictable_schedule", "focus_time"], modalities: ["hybrid", "on-site"] },
  { id: "c-1508", identity: { name: "Chris Johnson" }, headline: "Customer support by chat or email", skills: [verified("written_support"), declared("zendesk"), declared("data_entry")], needs: ["limited_public_contact", "written_communication"], modalities: ["remote"] },
  { id: "c-2659", identity: { name: "Sofía Navarro" }, headline: "Administrative assistant", skills: [verified("scheduling"), verified("data_entry"), declared("google_sheets")], needs: ["typed_records", "step_by_step_training"], modalities: ["on-site", "hybrid"] },
  { id: "c-3772", identity: { name: "Andrés Ruiz" }, headline: "Inventory clerk", skills: [verified("inventory"), declared("data_entry"), declared("excel")], needs: ["predictable_schedule", "step_by_step_training"], modalities: ["on-site"] },
  { id: "c-4836", identity: { name: "Taylor Brooks" }, headline: "Quality inspector", skills: [verified("quality_inspection"), declared("electronics_assembly")], needs: ["stable_priorities", "flexible_breaks"], modalities: ["on-site"] },
  { id: "c-5904", identity: { name: "Camila Ortiz" }, headline: "Video editor", skills: [verified("video_editing"), declared("photo_editing"), declared("graphic_design")], needs: ["autonomy", "varied_work"], modalities: ["remote"] },
  { id: "c-6971", identity: { name: "Noah Williams" }, headline: "Translator", skills: [verified("translation"), verified("proofreading"), declared("copywriting")], needs: ["quiet_space", "focus_time"], modalities: ["remote", "hybrid"] },
];
