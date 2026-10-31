import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/section-placeholder";

export const metadata: Metadata = { title: "Guide" };

export default function GuidePage() {
  return (
    <SectionPlaceholder
      title="Interviewer guide"
      what="Learn how to run a fair interview: the same questions for everyone, judged on the real work."
      owner="Phase 6"
    />
  );
}
