"use client";

import { useEffect, useRef } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { QUESTIONS, toggleOption } from "@/lib/profile";
import { cn } from "@/lib/utils";

type Question = (typeof QUESTIONS)[number];

const optionRow =
  "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border bg-card px-4 py-3 text-base has-data-checked:border-primary has-data-checked:bg-secondary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background";
// The flow's buttons meet the 44px touch target from the spec.
const action = "h-11 px-5 text-base";
const EXCLUSIVE = ["none", "not-sure"];

export function QuestionStep({
  index,
  value,
  answered,
  editing,
  onChange,
  onBack,
  onSkip,
  onNext,
}: {
  index: number;
  value: string | string[] | undefined;
  answered: boolean[];
  editing: boolean;
  onChange: (value: string | string[]) => void;
  onBack: () => void;
  onSkip: () => void;
  onNext: () => void;
}) {
  const question: Question = QUESTIONS[index];
  const total = QUESTIONS.length;
  const heading = useRef<HTMLHeadingElement>(null);

  // Move focus to the new question so keyboard and screen reader users start in the right place.
  useEffect(() => heading.current?.focus(), [index]);

  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const regular = question.options.filter((o) => !EXCLUSIVE.includes(o.value));
  const exclusive = question.options.filter((o) => EXCLUSIVE.includes(o.value));

  const checkbox = (o: (typeof question.options)[number]) => (
    <label key={o.value} className={optionRow}>
      <Checkbox checked={selected.includes(o.value)} onCheckedChange={() => onChange(toggleOption(selected, o.value))} />
      {o.label}
    </label>
  );

  return (
    <section data-tour="profile-questions" aria-labelledby="question-heading" className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div aria-hidden className="flex gap-1.5">
          {QUESTIONS.map((q, i) => (
            <Star
              key={q.id}
              className={cn(
                "size-4",
                answered[i] ? "fill-star text-star" : i === index ? "text-primary" : "text-border",
              )}
            />
          ))}
        </div>
        <p id="question-progress" className="text-sm text-muted-foreground">
          Question {index + 1} of {total}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h1
          id="question-heading"
          ref={heading}
          tabIndex={-1}
          aria-describedby="question-progress question-hint"
          className="text-2xl font-semibold text-balance outline-none"
        >
          {question.text}
        </h1>
        <p id="question-hint" className="text-sm text-muted-foreground">
          {question.kind === "multi" ? "Choose any that apply, or skip. " : "Choose one, or skip. "}
          You can change this anytime.
        </p>
      </div>

      {question.kind === "single" ? (
        <RadioGroup aria-labelledby="question-heading" value={value ?? null} onValueChange={(v) => onChange(v as string)}>
          {question.options.map((o) => (
            <label key={o.value} className={optionRow}>
              <RadioGroupItem value={o.value} />
              {o.label}
            </label>
          ))}
        </RadioGroup>
      ) : (
        <div role="group" aria-labelledby="question-heading" className="grid gap-2">
          {regular.map(checkbox)}
          {exclusive.length > 0 && (
            <>
              <p className="pt-2 text-sm text-muted-foreground">Or</p>
              {exclusive.map(checkbox)}
            </>
          )}
        </div>
      )}

      {editing ? (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button variant="ghost" className={action} onClick={onBack}>
            Cancel
          </Button>
          <Button className={action} onClick={onNext}>
            Save
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" className={action} onClick={onBack}>
            Back
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" className={action} onClick={onSkip}>
            Skip
          </Button>
          <Button className={action} onClick={selected.length ? onNext : onSkip}>
            {index === total - 1 ? "Finish" : "Next"}
          </Button>
        </div>
      )}
    </section>
  );
}
