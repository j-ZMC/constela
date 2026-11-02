import type { Metadata } from "next";
import { InterviewQuestions } from "@/components/employers/interview-questions";
import { InterviewerGuide } from "@/components/employers/interviewer-guide";

export const metadata: Metadata = { title: "Guide" };

export default function GuidePage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold break-words">Interviewer guide</h1>
        <p className="text-muted-foreground">Read how to run a fair interview, then prepare the questions for your vacancy.</p>
      </div>
      <InterviewerGuide />
      <InterviewQuestions />
    </div>
  );
}
