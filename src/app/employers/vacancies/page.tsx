import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/section-placeholder";

export const metadata: Metadata = { title: "Vacancies" };

export default function VacanciesPage() {
  return (
    <SectionPlaceholder
      title="Your vacancies"
      what="Paste a vacancy, see what is missing, and publish a clear version."
      owner="Phase 4"
    />
  );
}
