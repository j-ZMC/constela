import type { Metadata } from "next";
import { TalentSearch } from "@/components/employers/talent-search";

export const metadata: Metadata = { title: "People" };

export default function TalentPage() {
  return <TalentSearch />;
}
