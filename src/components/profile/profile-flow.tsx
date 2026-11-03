"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Constellation } from "@/components/profile/constellation";
import { ProfileSummary } from "@/components/profile/profile-summary";
import { QuestionStep } from "@/components/profile/question-step";
import { QUESTIONS, type Answers, loadProfile, loadStep, saveProfile, saveStep } from "@/lib/profile";
import { setReadingOption } from "@/lib/reading";
import { useHydrated } from "@/lib/use-hydrated";

// Saved answers live in localStorage, which the server can't see. Render the flow only after
// hydration so its lazy state reads storage without a server/client mismatch.
// `after` (work choices, CV, details) shows on the welcome and summary screens, never between questions.
export function ProfileFlow({ after }: { after?: ReactNode }) {
  return useHydrated() ? <Flow after={after} /> : null;
}

function Flow({ after }: { after?: ReactNode }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>(() => loadProfile() ?? {});
  const [step, setStep] = useState(loadStep);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string | string[] | undefined>();

  function go(next: number) {
    setStep(next);
    saveStep(next);
  }

  function setAnswer(id: string, value: string | string[] | undefined) {
    const next = { ...answers, [id]: value } as Answers;
    if (value === undefined) delete next[id as keyof Answers];
    setAnswers(next);
    saveProfile(next);
    // The answer turns Reduce motion on or off right away; Personalize shows the same switch.
    if (id === "motion" && value !== undefined) setReadingOption("reduce-motion", value === "still");
  }

  if (step === -1) {
    return (
      <>
      <section data-tour="profile-questions" className="flex flex-col gap-6">
        <Constellation lit={QUESTIONS.map(() => false)} label={`${QUESTIONS.length} short questions`} />
        <h1 className="text-3xl font-bold text-balance">Let&apos;s get to know you</h1>
        <p className="text-lg text-muted-foreground">
          {QUESTIONS.length} short questions help Constela fit the way you work best. Each answer lights up a star.
          It takes about 3 minutes, and you can skip any question or change your answers anytime.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button className="h-11 px-5 text-base" onClick={() => go(0)}>
            Start
          </Button>
          <Button className="h-11 px-5 text-base" variant="outline" onClick={() => router.push("/plan")}>
            Skip for now
          </Button>
        </div>
      </section>
      {after}
      </>
    );
  }

  if (step >= QUESTIONS.length) {
    return (
      <>
        <ProfileSummary
          answers={answers}
          onEdit={(i) => {
            setDraft(answers[QUESTIONS[i].id]);
            setEditing(true);
            go(i);
          }}
        />
        {after}
      </>
    );
  }

  const q = QUESTIONS[step];
  const answered = QUESTIONS.map((x) => answers[x.id] !== undefined);

  if (editing) {
    // Edits from the summary stay a draft until Save, so Cancel never changes anything.
    const toSummary = () => {
      setEditing(false);
      go(QUESTIONS.length);
    };
    return (
      <QuestionStep
        key={q.id}
        index={step}
        value={draft}
        answered={answered}
        editing
        onChange={setDraft}
        onBack={toSummary}
        onSkip={toSummary}
        onNext={() => {
          setAnswer(q.id, draft?.length ? draft : undefined);
          toSummary();
        }}
      />
    );
  }

  return (
    <QuestionStep
      key={q.id}
      index={step}
      value={answers[q.id]}
      answered={answered}
      editing={false}
      onChange={(v) => setAnswer(q.id, v)}
      onBack={() => go(step - 1)}
      onSkip={() => {
        setAnswer(q.id, undefined);
        go(step + 1);
      }}
      onNext={() => go(step + 1)}
    />
  );
}
