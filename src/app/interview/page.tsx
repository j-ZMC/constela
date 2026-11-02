import { InterviewView } from "@/components/interview/interview-view";
import { PageSky } from "@/components/page-sky";

export default function InterviewPage() {
  return (
    <main className="flex flex-col">
      <PageSky>
        <h1 className="text-3xl font-bold text-balance sm:text-4xl">Interview</h1>
        <p className="text-pretty text-white/80">Practice one question at your own pace, or read what an interview day is like.</p>
      </PageSky>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8">
        <InterviewView />
      </div>
    </main>
  );
}
