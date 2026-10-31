// Constela for Employers: everything the employer side keeps in this browser. See SPEC-employers.md.
// shortcut: single-browser demo, move to a database with accounts before any real employer uses it.
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

export function loadEmployerData(): EmployerData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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

// False when the browser blocks storage or it is full, so the page can tell the employer their work wasn't saved.
export function saveEmployerData(data: EmployerData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, ...data }));
    return true;
  } catch {
    return false;
  }
}
