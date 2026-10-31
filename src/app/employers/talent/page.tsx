import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/section-placeholder";

export const metadata: Metadata = { title: "Talent" };

export default function TalentPage() {
  return (
    <SectionPlaceholder
      title="Find talent"
      what="See people ranked by the skills your vacancy needs. Names stay hidden until a person says yes."
      owner="Phase 5"
    />
  );
}
