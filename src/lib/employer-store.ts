// Constela for Employers: everything the employer side keeps in this browser. See SPEC-employers.md.
// shortcut: single-browser demo, move to a database with accounts before any real employer uses it.
import { useSyncExternalStore } from "react";
import { z } from "zod";
import type { InterviewQuestion } from "@/lib/employer-ai";
import { EMPTY_SNAPSHOT, publicSnapshot } from "@/lib/public-employer";
import { computeSeal, type Seal, type SealResponse } from "@/lib/seal";
import { ALTERNATIVE_FORMATS, MAX_ITEMS, MAX_LINE, MAX_QUESTION, MAX_SHORT, MAX_STAGES, vacancySchema, type Vacancy } from "@/lib/vacancy";
import type { Permission } from "@/lib/work-profile";

const STORAGE_KEY = "employers"; // also listed in delete-my-data.tsx
const VERSION = 1;
const DAY_MS = 24 * 60 * 60 * 1000;

// One list of questions per vacancy, so everyone gets the same ones.
export type VacancyInterview = { vacancyId: string; questions: InterviewQuestion[] };
export type StageChoice = { stage: string; format: (typeof ALTERNATIVE_FORMATS)[number] };
export type Booking = { candidateId: string; vacancyId: string; interviewAt?: string; choices: StageChoice[] };

export type EmployerData = {
  vacancies: Vacancy[];
  permissions: Permission[];
  responses: SealResponse[];
  guideRead: boolean;
  interviews: VacancyInterview[];
  bookings: Booking[];
};

// ISO times only: identityFor() sorts them as text, so a hand-edited value could otherwise win as the latest answer.
const time = z.iso.datetime();
const id = z.string().min(1).max(64);
const permissionSchema: z.ZodType<Permission> = z
  .object({ candidateId: id, vacancyId: id, status: z.enum(["invited", "accepted", "declined"]), at: time })
  .strict();
const responseSchema: z.ZodType<SealResponse> = z
  .object({ dueAt: time, answeredAt: time.optional(), candidateId: id.optional(), vacancyId: id.optional() })
  .strict();
const line = (max: number) => z.string().trim().min(1).max(max);
const interviewSchema: z.ZodType<VacancyInterview> = z
  .object({
    vacancyId: id,
    questions: z
      .array(z.object({ requirement: line(MAX_LINE), question: line(MAX_QUESTION), strong: line(MAX_QUESTION), basic: line(MAX_QUESTION) }).strict())
      .min(1)
      .max(MAX_ITEMS),
  })
  .strict();
const bookingSchema: z.ZodType<Booking> = z
  .object({
    candidateId: id,
    vacancyId: id,
    interviewAt: time.optional(),
    choices: z.array(z.object({ stage: line(MAX_SHORT), format: z.enum(ALTERNATIVE_FORMATS) }).strict()).max(MAX_STAGES),
  })
  .strict();

const emptyData = (): EmployerData => ({ vacancies: [], permissions: [], responses: [], guideRead: false, interviews: [], bookings: [] });

// Storage can be edited by hand: keep the items that still pass, so one bad item doesn't lose the others.
function keepValid<T>(schema: z.ZodType<T>, items: unknown): T[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => schema.safeParse(item)).flatMap((r) => (r.success ? [r.data] : []));
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): EmployerData {
  try {
    if (!raw) return emptyData();
    const data = JSON.parse(raw);
    if (data?.version !== VERSION) return emptyData();
    return {
      vacancies: keepValid(vacancySchema, data.vacancies),
      permissions: keepValid(permissionSchema, data.permissions),
      responses: keepValid(responseSchema, data.responses),
      guideRead: data.guideRead === true,
      interviews: keepValid(interviewSchema, data.interviews),
      bookings: keepValid(bookingSchema, data.bookings),
    };
  } catch {
    return emptyData();
  }
}

export const loadEmployerData = (): EmployerData => parse(readRaw());

const listeners = new Set<() => void>();

// False when the browser blocks storage or it is full, so the page can tell the employer their work wasn't saved.
export function saveEmployerData(data: EmployerData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, ...data }));
    listeners.forEach((listener) => listener());
    return true;
  } catch {
    return false;
  }
}

// Reads the store first, so saving a vacancy never overwrites what another page changed since.
export function saveVacancy(vacancy: Vacancy): boolean {
  const data = loadEmployerData();
  const known = data.vacancies.some((v) => v.id === vacancy.id);
  const vacancies = known ? data.vacancies.map((v) => (v.id === vacancy.id ? vacancy : v)) : [...data.vacancies, vacancy];
  return saveEmployerData({ ...data, vacancies });
}

// Every answer stays, in order: latestPermission() reads the last one, so a later no always wins.
export function addPermission(permission: Permission): boolean {
  const data = loadEmployerData();
  return saveEmployerData({ ...data, permissions: [...data.permissions, permission] });
}

const samePair = (candidateId: string, vacancyId: string) => (x: { candidateId?: string; vacancyId?: string }) => x.candidateId === candidateId && x.vacancyId === vacancyId;

// Saying yes means the employer now owes an answer by the date the vacancy promised. Saying no cancels one not sent yet,
// so a candidate who leaves never counts against the seal.
export function answerInvitation(candidateId: string, vacancy: Vacancy, status: "accepted" | "declined", now: Date): boolean {
  const data = loadEmployerData();
  const pair = samePair(candidateId, vacancy.id);
  const permissions = [...data.permissions, { candidateId, vacancyId: vacancy.id, status, at: now.toISOString() }];
  let responses = data.responses.filter((r) => !(status === "declined" && pair(r) && !r.answeredAt));
  if (status === "accepted" && vacancy.responseDays && !responses.some(pair)) {
    responses = [...responses, { candidateId, vacancyId: vacancy.id, dueAt: new Date(now.getTime() + vacancy.responseDays * DAY_MS).toISOString() }];
  }
  return saveEmployerData({ ...data, permissions, responses });
}

export function markAnswerSent(candidateId: string, vacancyId: string, now: Date): boolean {
  const data = loadEmployerData();
  const pair = samePair(candidateId, vacancyId);
  return saveEmployerData({ ...data, responses: data.responses.map((r) => (pair(r) ? { ...r, answeredAt: now.toISOString() } : r)) });
}

export function saveInterview(interview: VacancyInterview): boolean {
  const data = loadEmployerData();
  return saveEmployerData({ ...data, interviews: [...data.interviews.filter((i) => i.vacancyId !== interview.vacancyId), interview] });
}

export const markGuideRead = () => saveEmployerData({ ...loadEmployerData(), guideRead: true });

function updateBooking(candidateId: string, vacancyId: string, change: (booking: Booking) => Booking): boolean {
  const data = loadEmployerData();
  const pair = samePair(candidateId, vacancyId);
  const booking = data.bookings.find(pair) ?? { candidateId, vacancyId, choices: [] };
  return saveEmployerData({ ...data, bookings: [...data.bookings.filter((b) => !pair(b)), change(booking)] });
}

export const scheduleInterview = (candidateId: string, vacancyId: string, interviewAt: string | undefined) =>
  updateBooking(candidateId, vacancyId, (b) => ({ ...b, interviewAt }));

// No format means the step as planned.
export const chooseFormat = (candidateId: string, vacancyId: string, stage: string, format: StageChoice["format"] | undefined) =>
  updateBooking(candidateId, vacancyId, (b) => ({ ...b, choices: [...b.choices.filter((c) => c.stage !== stage), ...(format ? [{ stage, format }] : [])] }));

let cached: { raw: string | null; data: EmployerData } | undefined;
const SERVER_DATA = emptyData();

export const employerStore = {
  // The same object until the data changes: useSyncExternalStore loops forever otherwise.
  snapshot(): EmployerData {
    const raw = readRaw();
    if (!cached || cached.raw !== raw) cached = { raw, data: parse(raw) };
    return cached.data;
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    window.addEventListener("storage", listener); // another tab saved
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", listener);
    };
  },
};

// Next keeps visited pages alive but hidden, so data read once would go stale. This re-reads when a page comes back.
export function useEmployerData(): EmployerData {
  return useSyncExternalStore(employerStore.subscribe, employerStore.snapshot, () => SERVER_DATA);
}

let sent = JSON.stringify(EMPTY_SNAPSHOT);

// Keeps the public API's copy up to date. Only a change to what is published goes out, so typing in a draft sends nothing,
// and a browser with nothing published never clears the copy. A send that fails goes again with the next change of any kind.
export function syncPublicData(data: EmployerData): void {
  const body = JSON.stringify(publicSnapshot(data));
  if (body === sent) return;
  sent = body;
  const retry = () => {
    if (sent === body) sent = "";
  };
  fetch("/api/employer-sync", { method: "PUT", headers: { "Content-Type": "application/json" }, body })
    // 503 means this server has writes turned off, so trying again would only add noise.
    .then((res) => res.status >= 500 && res.status !== 503 && retry())
    .catch(retry);
}

const noUpdates = () => () => {};

// Worked out from the data on every look and never stored, so it drops as soon as a metric does. Time counts too: an answer
// can pass its date while the page sits hidden, and the minute makes the seal look again when the page comes back.
// shortcut: no candidate ratings exist yet, so gold can't be reached; add them once real candidates can rate a process.
export function useSeal(data: EmployerData): Seal {
  const minute = useSyncExternalStore(noUpdates, () => Math.floor(Date.now() / 60_000), () => 0);
  return computeSeal({ vacancies: data.vacancies, guideRead: data.guideRead, responses: data.responses, ratings: [] }, new Date(minute * 60_000));
}
