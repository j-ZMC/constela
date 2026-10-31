// Constela for Employers: everything the employer side keeps in this browser. See SPEC-employers.md.
// shortcut: single-browser demo, move to a database with accounts before any real employer uses it.
import { useSyncExternalStore } from "react";
import { z } from "zod";
import type { SealResponse } from "@/lib/seal";
import { vacancySchema, type Vacancy } from "@/lib/vacancy";
import type { Permission } from "@/lib/work-profile";

const STORAGE_KEY = "employers"; // also listed in delete-my-data.tsx
const VERSION = 1;

export type EmployerData = { vacancies: Vacancy[]; permissions: Permission[]; responses: SealResponse[]; guideRead: boolean };

// ISO times only: identityFor() sorts them as text, so a hand-edited value could otherwise win as the latest answer.
const time = z.iso.datetime();
const permissionSchema: z.ZodType<Permission> = z
  .object({
    candidateId: z.string().min(1).max(64),
    vacancyId: z.string().min(1).max(64),
    status: z.enum(["invited", "accepted", "declined"]),
    at: time,
  })
  .strict();
const responseSchema: z.ZodType<SealResponse> = z.object({ dueAt: time, answeredAt: time.optional() }).strict();

const emptyData = (): EmployerData => ({ vacancies: [], permissions: [], responses: [], guideRead: false });

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
