// The browser side of POST /api/employer-ai. Types only from employer-ai.ts, so the AI SDK stays on the server.
import type { EmployerAiRequest, InterviewQuestion, VacancyDraft } from "@/lib/employer-ai";
import type { Vacancy } from "@/lib/vacancy";

// The route times out at 15 s; this only guards against a network that never answers.
const TIMEOUT_MS = 20_000;

async function ask<T>(body: EmployerAiRequest, signal: AbortSignal): Promise<T> {
  const res = await fetch("/api/employer-ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "failed");
  return data;
}

export async function extractVacancy(text: string, signal: AbortSignal): Promise<VacancyDraft> {
  return (await ask<{ vacancy: VacancyDraft }>({ task: "extract", text }, signal)).vacancy;
}

export async function rewriteLine(text: string, signal: AbortSignal): Promise<string> {
  return (await ask<{ text: string }>({ task: "rewrite", text }, signal)).text;
}

export async function draftInterview(v: Vacancy, signal: AbortSignal): Promise<InterviewQuestion[]> {
  const request: EmployerAiRequest = { task: "interview", title: v.title, tasks: v.tasks, essential: v.essential.map((r) => r.text) };
  return (await ask<{ questions: InterviewQuestion[] }>(request, signal)).questions;
}
