"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Constellation } from "@/components/profile/constellation";
import { ListenButton } from "@/components/listen-button";
import { QUESTIONS, type Answers, describeAdaptations, toAdaptations } from "@/lib/profile";
import { applyPrefs, loadPrefs, savePrefs } from "@/lib/personalization";
import { setReadingOption } from "@/lib/reading";

// Shown up front; the rest sit behind "more" so the summary stays one screen of reading.
const UP_FRONT = 3;
const action = "h-11 px-5 text-base";

export function ProfileSummary({ answers, onEdit }: { answers: Answers; onEdit: (index: number) => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [aidsOn, setAidsOn] = useState(false);
  useEffect(() => heading.current?.focus(), []);

  const adaptations = toAdaptations(answers);
  const lines = describeAdaptations(adaptations);
  const answered = QUESTIONS.map((q) => answers[q.id] !== undefined);
  const count = answered.filter(Boolean).length;

  const line = (text: string) => (
    <li key={text} className="flex gap-2">
      <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
      {text}
    </li>
  );

  return (
    <section aria-labelledby="summary-heading" className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Constellation lit={answered} label={`${count} of ${QUESTIONS.length} questions answered`} />
        <div className="flex flex-col gap-2">
          <h1 id="summary-heading" ref={heading} tabIndex={-1} className="text-3xl font-bold outline-none">
            Your profile is ready
          </h1>
          <p className="text-muted-foreground">
            You answered {count} of {QUESTIONS.length}. It stays on this device, and you can change it anytime.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-semibold">Here&apos;s how Constela will adapt</h2>
        {adaptations.listenButton && <ListenButton text={`Here's how Constela will adapt. ${lines.join(" ")}`} />}
        <ul className="flex flex-col gap-2">{lines.slice(0, UP_FRONT).map(line)}</ul>
        {lines.length > UP_FRONT && (
          <details className="group">
            <summary className="w-fit cursor-pointer text-sm font-medium underline underline-offset-4">
              {lines.length - UP_FRONT} more {lines.length - UP_FRONT === 1 ? "change" : "changes"}
            </summary>
            <ul className="mt-2 flex flex-col gap-2">{lines.slice(UP_FRONT).map(line)}</ul>
          </details>
        )}
        {adaptations.suggestReadingAids && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-secondary p-4">
            <p className="text-sm">
              {aidsOn
                ? "The dyslexia-friendly font and larger text are on. Change them in Personalize at the top."
                : "Long texts feel hard. Want the dyslexia-friendly font and larger text?"}
            </p>
            {!aidsOn && (
              <Button
                variant="outline"
                className={action}
                onClick={() => {
                  setReadingOption("dyslexic", true);
                  const prefs = { ...loadPrefs(), font: "dyslexic" as const, size: 120 };
                  applyPrefs(prefs);
                  savePrefs(prefs);
                  setAidsOn(true);
                }}
              >
                Turn them on
              </Button>
            )}
          </div>
        )}
      </div>

      <Link href="/plan" className={buttonVariants({ className: `${action} w-fit` })}>
        Go to my plan
      </Link>

      <details className="rounded-xl border bg-card">
        <summary className="cursor-pointer p-4 font-medium">See or change your answers</summary>
        <dl className="flex flex-col divide-y border-t">
          {QUESTIONS.map((q, i) => {
            const value = answers[q.id];
            const chosen = Array.isArray(value) ? value : value ? [value] : [];
            const labels = q.options.filter((o) => (chosen as string[]).includes(o.value)).map((o) => o.label);
            return (
              <div key={q.id} className="flex items-center justify-between gap-4 p-4">
                <div className="flex flex-col gap-1">
                  <dt className="font-medium">{q.text}</dt>
                  <dd className={labels.length ? "" : "text-muted-foreground italic"}>
                    {labels.length ? labels.join(", ") : "Skipped"}
                  </dd>
                </div>
                <Button
                  variant="outline"
                  className={`${action} shrink-0`}
                  onClick={() => onEdit(i)}
                  aria-label={`${labels.length ? "Edit" : "Answer"}: ${q.text}`}
                >
                  {labels.length ? "Edit" : "Answer"}
                </Button>
              </div>
            );
          })}
        </dl>
      </details>
    </section>
  );
}
