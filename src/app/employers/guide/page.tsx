import type { Metadata } from "next";
import { InterviewerGuide } from "@/components/employers/interviewer-guide";

export const metadata: Metadata = { title: "Guide" };

export default function GuidePage() {
  return <InterviewerGuide />;
}
