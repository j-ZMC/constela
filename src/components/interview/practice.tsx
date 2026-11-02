"use client";

import { useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Feedback, InterviewErrorCode, Question } from "@/lib/interview";
import { gentleTone, loadPlan, markEvent, todayEnergy } from "@/lib/plan";
import { loadProfile, toAdaptations } from "@/lib/profile";

// Used first, and whenever the AI can't make a new question.
const STANDARD: Question[] = [
  { question: "Tell me about yourself.", steps: ["Say who you are in one sentence.", "Share one thing you do well.", "Say what kind of work you want."] },
  { question: "Why do you want this job?", steps: ["Name one thing about the job you like.", "Link it to one skill you have.", "Say what you want to learn."] },
  { question: "What are you good at?", steps: ["Pick one strength.", "Give one real example.", "Say how it helps at work."] },
  { question: "Tell me about a time you solved a problem.", steps: ["Say what the problem was.", "Say what you did.", "Say what happened after."] },
];

const MESSAGES: Record<InterviewErrorCode, string> = {
  invalid_input: "Write a little more, then try again.",
  not_configured: "The AI helper is not set up yet.",
  timeout: "The AI helper took too long to answer.",
  failed: "The AI helper is not available right now.",
};

const MAX = 2000;

async function ask<T>(body: object): Promise<T> {
  const res = await fetch("/api/interview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error in MESSAGES ? data.error : "failed");
  return data as T;
}

// Rendered after hydration (reads the profile and today's check-in). The answer is never saved.
export function Practice() {
  const [flags] = useState(() => ({
    summaryMode: toAdaptations(loadProfile() ?? {}).summaryMode,
    gentleTone: gentleTone(todayEnergy(loadPlan(), new Date())),
  }));
  const [showSteps] = useState(() => toAdaptations(loadProfile() ?? {}).explicitSteps);
  const [question, setQuestion] = useState<Question>(STANDARD[0]);
  const [asked, setAsked] = useState<string[]>([]);
  const [answer, setAnswer] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ code: InterviewErrorCode; retry: "feedback" | "followup" } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [checking, setChecking] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  function show(next: Question, message: string | null = null) {
    setAsked((list) => [...list, question.question].slice(-8));
    setQuestion(next);
    setAnswer("");
    setFeedback(null);
    setError(null);
    setChecking(false);
    setNote(message);
    // The buttons the person pressed are gone; move focus to the new question.
    setTimeout(() => heading.current?.focus());
  }

  async function getFeedback() {
    if (!answer.trim()) return;
    setBusy("Reading your answer…");
    setError(null);
    setChecking(false);
    try {
      const data = await ask<{ feedback: Feedback }>({ mode: "practice", question: question.question, answer, ...flags });
      setFeedback(data.feedback);
      markEvent("practice-done");
    } catch (e) {
      setError({ code: (e as Error).message as InterviewErrorCode, retry: "feedback" });
    } finally {
      setBusy(null);
    }
  }

  async function newQuestion() {
    setBusy("Choosing a question…");
    try {
      const data = await ask<{ question: Question }>({ mode: "question", role, previous: [...asked, question.question].slice(-8), ...flags });
      show(data.question);
    } catch {
      const next = STANDARD.find((q) => q.question !== question.question && !asked.includes(q.question)) ?? STANDARD[0];
      show(next, "The AI could not make a question. Here is a common one.");
    } finally {
      setBusy(null);
    }
  }

  async function followUp() {
    setBusy("Choosing a follow-up question…");
    setError(null);
    try {
      const data = await ask<{ question: Question }>({ mode: "followup", role, question: question.question, answer, ...flags });
      show(data.question);
    } catch (e) {
      setError({ code: (e as Error).message as InterviewErrorCode, retry: "followup" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section data-tour="interview-question" aria-labelledby="question" className="flex flex-col gap-5 rounded-xl border bg-card p-5">
        <h2 id="question" ref={heading} tabIndex={-1} className="text-xl font-semibold text-balance outline-none">
          {question.question}
        </h2>
        {note && <p className="text-muted-foreground">{note}</p>}

        {question.steps.length > 0 && (
          <details open={showSteps} className="group">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-medium">
              <ChevronRight aria-hidden className="size-5 transition-transform group-open:rotate-90" />
              How to answer
            </summary>
            <ol className="mt-2 flex list-inside list-decimal flex-col gap-1">
              {question.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </details>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="answer" className="text-base">
            Your answer
          </Label>
          <Textarea
            id="answer"
            value={answer}
            maxLength={MAX}
            onChange={(e) => setAnswer(e.target.value)}
            aria-describedby="answer-hint"
            className="min-h-36 text-base md:text-base"
          />
          <p id="answer-hint" className="text-sm text-muted-foreground">
            Write it like you would say it. There is no timer and no score. We do not save your answer.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button data-tour="interview-feedback" size="touch" onClick={getFeedback} disabled={!answer.trim() || busy !== null}>
            Get feedback
          </Button>
          <Button variant="outline" size="touch" onClick={newQuestion} disabled={busy !== null}>
            New question
          </Button>
        </div>

        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-medium">
            <ChevronRight aria-hidden className="size-5 transition-transform group-open:rotate-90" />
            Practice for a specific job
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            <Label htmlFor="role" className="text-base">
              Job title (optional)
            </Label>
            <Input id="role" value={role} maxLength={100} onChange={(e) => setRole(e.target.value)} className="h-11 text-base md:text-base" />
            <p className="text-sm text-muted-foreground">New questions will fit this job.</p>
          </div>
        </details>
      </section>

      <div role="status" className="flex flex-col gap-6">
        {busy && <p className="text-muted-foreground">{busy}</p>}

        {error && (
          <div className="flex flex-col gap-3 rounded-xl border border-destructive/40 bg-secondary p-5">
            <p>{MESSAGES[error.code]} Your answer is still here.</p>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="touch" onClick={error.retry === "feedback" ? getFeedback : followUp}>
                Try again
              </Button>
              {error.retry === "feedback" && (
                <Button variant="ghost" size="touch" onClick={() => setChecking(true)}>
                  Check it myself
                </Button>
              )}
            </div>
          </div>
        )}

        {checking && (
          <div className="flex flex-col gap-2 rounded-xl border bg-card p-5">
            <h3 className="text-lg font-semibold">Check your answer</h3>
            <p>Did your answer do each of these?</p>
            <ul className="list-inside list-disc">
              {question.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </div>
        )}

        {feedback && (
          <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
            <div>
              <h3 className="text-lg font-semibold">What went well</h3>
              <p className="text-pretty">{feedback.wentWell}</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold">One thing to try</h3>
              <p className="text-pretty">{feedback.suggestion}</p>
            </div>
            <div className="flex flex-wrap gap-3 border-t pt-4">
              <Button variant="outline" size="touch" onClick={followUp} disabled={busy !== null}>
                Ask me a follow-up question
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
