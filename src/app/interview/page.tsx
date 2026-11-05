import { Suspense } from "react";
import { InterviewChat } from "@/components/interview/interview-chat";
import { PageSky } from "@/components/page-sky";
import { FirstVisitTour, type TourStep } from "@/components/tour";

const PREPARATION_TOUR: TourStep[] = [
  { target: "prep-choose", title: "Get ready to apply", text: "Choose what to work on: practice an interview, answer common questions, understand or write a message, or work on your CV." },
  { target: "prep-choose", title: "Write or talk", text: "Answer by typing or out loud, whatever is easier. The AI can talk back, with captions. If a question feels hard, the next one gets easier." },
  { target: "prep-choose", title: "You are ready", text: "That is the tour. Your plan tells you what to do next, one step at a time. You can change anything in Profile and Settings." },
];

export default function InterviewPage() {
  return (
    <main className="flex flex-col">
      <PageSky width="max-w-4xl">
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">Get ready to apply</h1>
        <p className="text-pretty text-white/80">
          Work on your CV, practice with an AI interviewer, or understand a message. Write or talk, whatever is easier for you.
        </p>
      </PageSky>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
        {/* InterviewChat reads ?saved= from the URL, so it renders in the browser only. */}
        <Suspense><InterviewChat /></Suspense>
        <FirstVisitTour name="preparation" steps={PREPARATION_TOUR} />
      </div>
    </main>
  );
}
