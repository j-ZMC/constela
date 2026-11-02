import { InterviewView } from "@/components/interview/interview-view";
import { PageSky, onSky } from "@/components/page-sky";
import { HowItWorks, type TourStep } from "@/components/tour";

const INTERVIEW_TOUR: TourStep[] = [
  { target: "interview-tabs", title: "Two parts", text: "Practice is for answering questions. What to expect explains the interview day, step by step." },
  { target: "interview-question", title: "One question at a time", text: "Open How to answer for 3 short steps. Ask for a new question whenever you want." },
  {
    target: "interview-feedback",
    title: "Write, then get feedback",
    text: "You get one thing that went well and one thing to try. There is no score and no timer, and we do not save your answer.",
  },
];

export default function InterviewPage() {
  return (
    <main className="flex flex-col">
      <PageSky>
        <div className="flex flex-wrap items-center justify-between gap-x-3">
          <h1 className="text-3xl font-bold text-balance sm:text-4xl">Interview</h1>
          <HowItWorks name="interview" steps={INTERVIEW_TOUR} className={onSky} />
        </div>
        <p className="text-pretty text-white/80">Practice one question at your own pace, or read what an interview day is like.</p>
      </PageSky>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8">
        <InterviewView />
      </div>
    </main>
  );
}
