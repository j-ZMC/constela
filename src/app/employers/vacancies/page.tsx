import type { Metadata } from "next";
import { VacancyWorkspace } from "@/components/employers/vacancy-workspace";

export const metadata: Metadata = { title: "Vacancies" };

export default function VacanciesPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <VacancyWorkspace />
    </main>
  );
}
