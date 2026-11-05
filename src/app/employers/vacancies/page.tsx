import type { Metadata } from "next";
import { VacancyWorkspace } from "@/components/employers/vacancy-workspace";

export const metadata: Metadata = { title: "Jobs" };

export default function VacanciesPage() {
  return <VacancyWorkspace />;
}
