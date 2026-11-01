import { InterviewView } from "@/components/interview/interview-view";

export default function InterviewPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold sm:text-3xl">Interview</h1>
        <p className="text-muted-foreground">Practice one question at your own pace, or read what an interview day is like.</p>
      </div>
      <InterviewView />
    </main>
  );
}
