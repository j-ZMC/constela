"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Constellation } from "@/components/profile/constellation";
import { HelpPicks } from "@/components/profile/help-picks";
import { ProfileSummary } from "@/components/profile/profile-summary";
import { QuestionStep } from "@/components/profile/question-step";
import { QUESTIONS, type Answers, loadProfile, loadStep, saveProfile, saveStep } from "@/lib/profile";
import { applyHelp, loadHelpPicks, saveHelpPicks } from "@/lib/help-picks";
import { applyPrefs, loadPrefs, savePrefs } from "@/lib/personalization";
import { setReadingOption } from "@/lib/reading";
import { useHydrated } from "@/lib/use-hydrated";
import { Loading } from "@/components/loading";

// Saved answers live in localStorage, which the server can't see. Render the flow only after
// hydration so its lazy state reads storage without a server/client mismatch.
export function ProfileFlow({ onNext }: { onNext: () => void }) {
  return useHydrated() ? <Flow onNext={onNext} /> : <Loading />;
}

function Flow({ onNext }: { onNext: () => void }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>(() => loadProfile() ?? {});
  const [step, setStep] = useState(loadStep);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string | string[] | undefined>();
  // "What is hard for you?" comes first, once; afterwards it opens again from the welcome screen.
  const [asking, setAsking] = useState(() => loadHelpPicks() === null);

  function go(next: number) {
    setStep(next);
    saveStep(next);
  }

  function setAnswer(id: string, value: string | string[] | undefined) {
    const next = { ...answers, [id]: value } as Answers;
    if (value === undefined) delete next[id as keyof Answers];
    setAnswers(next);
    saveProfile(next);
  }

  if (step === -1 && asking) {
    return (
      <HelpPicks
        initial={loadHelpPicks() ?? []}
        onDone={(picks, types) => {
          const next = applyHelp(picks, answers, loadPrefs(), types);
          // OpenDyslexic is switched by the reading class on <html>, the same way the Personalize panel does it.
          if (next.prefs.font === "dyslexic") setReadingOption("dyslexic", true);
          setAnswers(next.answers);
          saveProfile(next.answers);
          savePrefs(next.prefs);
          applyPrefs(next.prefs);
          saveHelpPicks(picks);
          setAsking(false);
        }}
      />
    );
  }

  if (step === -1) {
    return (
      <section className="flex flex-col gap-6">
        <Constellation lit={QUESTIONS.map(() => false)} label={`${QUESTIONS.length} short questions`} />
        <h2 className="text-2xl font-semibold text-balance">Let&apos;s get to know you</h2>
        <p className="text-muted-foreground">
          {QUESTIONS.length} short questions. About 3 minutes. Each answer lights a star, and you can skip any question.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button className="h-11 px-5 text-base" onClick={() => go(0)}>
            Start
          </Button>
          <Button className="h-11 px-5 text-base" variant="outline" onClick={() => router.push("/plan")}>
            Skip for now
          </Button>
          <Button className="h-11 px-5 text-base" variant="ghost" onClick={() => setAsking(true)}>
            What is hard for you?
          </Button>
        </div>
      </section>
    );
  }

  if (step >= QUESTIONS.length) {
    return (
      <ProfileSummary
        answers={answers}
        onNext={onNext}
        onEdit={(i) => {
          setDraft(answers[QUESTIONS[i].id]);
          setEditing(true);
          go(i);
        }}
      />
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
