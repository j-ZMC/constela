"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ClarityPanel } from "@/components/employers/clarity-panel";
import { MarkedText, PhraseHelp } from "@/components/employers/phrase-help";
import { LongTextField, NumberField, Rows, Section, SelectField, TextField, action } from "@/components/employers/vacancy-fields";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import type { VacancyDraft } from "@/lib/employer-ai";
import { extractVacancy } from "@/lib/employer-ai-client";
import { saveVacancy } from "@/lib/employer-store";
import {
  ALTERNATIVE_FORMATS,
  CURRENCIES,
  ENVIRONMENT,
  ENVIRONMENT_FACTORS,
  MAX_ITEMS,
  MAX_LINE,
  MAX_POSTING,
  MAX_SHORT,
  MAX_STAGES,
  MAX_SUMMARY,
  MINUTES_RANGE,
  MODALITIES,
  MODALITY_LABELS,
  RESPONSE_DAYS_RANGE,
  SALARY_PERIODS,
  SKILLS,
  SKILL_IDS,
  STAGE_FORMATS,
  STAGE_FORMAT_LABELS,
  clarityScore,
  type Requirement,
  type Stage,
  type Vacancy,
} from "@/lib/vacancy";
import { PROCESS_TEMPLATE, cleanVacancy, formFromDraft, publishProblems, saveProblems, toggleFactor, type VacancyForm } from "@/lib/vacancy-editor";

const labelled =<T extends string>(values: readonly T[], label: (value: T) => string) => values.map((value) => ({ value, label: label(value) }));

const MODALITY_OPTIONS = labelled(MODALITIES, (m) => MODALITY_LABELS[m]);
const STAGE_OPTIONS = labelled(STAGE_FORMATS, (f) => STAGE_FORMAT_LABELS[f]);
const ALTERNATIVE_OPTIONS = labelled(ALTERNATIVE_FORMATS, (f) => STAGE_FORMAT_LABELS[f]);
const CURRENCY_OPTIONS = labelled(CURRENCIES, (c) => c);
const PERIOD_OPTIONS = labelled(SALARY_PERIODS, (p) => `Per ${p}`);
const SKILL_OPTIONS = labelled(SKILL_IDS, (s) => SKILLS[s]).sort((a, b) => a.label.localeCompare(b.label));

const BLANK_REQUIREMENT: Requirement = { text: "" };
const BLANK_STAGE: Stage = { name: "", format: "video-call" };

export function VacancyEditor({ start, isNew, onClose }: { start: VacancyForm; isNew: boolean; onClose: () => void }) {
  const [form, setForm] = useState(start);
  const [savedAs, setSavedAs] = useState(() => JSON.stringify(start));
  const [step, setStep] = useState<"paste" | "card">(isNew ? "paste" : "card");
  const [posting, setPosting] = useState("");
  const [fromAi, setFromAi] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [saved, setSaved] = useState<Vacancy["status"] | "">("");
  const [leaving, setLeaving] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const problemBox = useRef<HTMLDivElement>(null);

  const dirty = step === "paste" ? posting.trim() !== "" : JSON.stringify(form) !== savedAs;

  // The button that opened each step is gone, so keyboard and screen reader users start from the new title.
  useEffect(() => heading.current?.focus(), [step]);

  // Moving around the app keeps this form, because Next keeps the page alive. A reload or a closed tab doesn't.
  // shortcut: Next keeps only 3 routes alive, so work is lost without a warning after visiting several pages; autosave drafts if employers hit this.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (problems.length > 0) problemBox.current?.focus();
  }, [problems]);

  function change<K extends keyof VacancyForm>(key: K, value: VacancyForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved("");
  }

  function save(status: Vacancy["status"]) {
    const next = { ...form, status };
    const vacancy = cleanVacancy(next);
    const found = status === "published" ? publishProblems(vacancy) : saveProblems(vacancy);
    if (found.length === 0 && !saveVacancy(vacancy)) found.push("This browser could not save the vacancy. Copy your text somewhere safe and try again.");
    setProblems(found);
    if (found.length > 0) return;
    setForm(next);
    setSavedAs(JSON.stringify(next));
    setFromAi(false);
    setSaved(status);
  }

  const published = form.status === "published";
  const clarity = clarityScore(cleanVacancy(form));
  const { essential, niceToHave } = form;

  const back = leaving ? (
    <div role="alert" className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <p>You have changes that are not saved.</p>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" className={action} onClick={() => setLeaving(false)}>
          Keep editing
        </Button>
        <Button variant="ghost" className={action} onClick={onClose}>
          Leave without saving
        </Button>
      </div>
    </div>
  ) : (
    <Button variant="ghost" className={`${action} w-fit`} onClick={() => (dirty ? setLeaving(true) : onClose())}>
      Back to vacancies
    </Button>
  );

  if (step === "paste") {
    return (
      <div className="flex max-w-2xl flex-col gap-6">
        {back}
        <PasteStep
          heading={heading}
          text={posting}
          onText={setPosting}
          onManual={() => setStep("card")}
          onDraft={(draft) => {
            setForm(formFromDraft(draft, form.id));
            setFromAi(true);
            setStep("card");
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {back}
      <div className="flex flex-col gap-2">
        <h1 ref={heading} tabIndex={-1} className="text-3xl font-bold outline-none">
          {isNew ? "Your new vacancy" : "Edit your vacancy"}
        </h1>
        {fromAi && (
          <p role="status" className="max-w-2xl rounded-lg bg-secondary p-3">
            AI filled in this card from your text. Nothing is saved yet. Check every field, then save it.
          </p>
        )}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="lg:sticky lg:top-24 lg:order-2">
          <ClarityPanel clarity={clarity} />
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {posting.trim() && (
            <details className="rounded-xl border bg-card p-5">
              <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Your pasted text</summary>
              <div className="pt-3">
                <MarkedText text={posting} />
              </div>
            </details>
          )}

          <Section title="The job">
            <TextField label="Job title" value={form.title} maxLength={MAX_SHORT} onChange={(v) => change("title", v)} />
            <PhraseHelp text={form.title} maxLength={MAX_SHORT} onUse={(v) => change("title", v)} />
            <TextField label="Company" value={form.company} maxLength={MAX_SHORT} onChange={(v) => change("company", v)} />
            <LongTextField label="Short summary" value={form.summary} maxLength={MAX_SUMMARY} onChange={(v) => change("summary", v)} />
            <PhraseHelp text={form.summary} maxLength={MAX_SUMMARY} onUse={(v) => change("summary", v)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Work mode" value={form.modality} options={MODALITY_OPTIONS} blank="Not chosen yet" onChange={(v) => change("modality", v)} />
              <TextField label="Location" value={form.location} maxLength={MAX_SHORT} onChange={(v) => change("location", v)} />
            </div>
            <TextField label="Work schedule" value={form.schedule} maxLength={MAX_SHORT} onChange={(v) => change("schedule", v)} />
          </Section>

          <Section title="Salary" hint="Fill in one amount if the salary is fixed.">
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField label="Lowest" value={form.salary.min} min={1} onChange={(min) => change("salary", { ...form.salary, min })} />
              <NumberField label="Highest" value={form.salary.max} min={1} onChange={(max) => change("salary", { ...form.salary, max })} />
              <SelectField label="Currency" value={form.salary.currency} options={CURRENCY_OPTIONS} onChange={(currency) => currency && change("salary", { ...form.salary, currency })} />
              <SelectField label="Paid" value={form.salary.period} options={PERIOD_OPTIONS} onChange={(period) => period && change("salary", { ...form.salary, period })} />
            </div>
          </Section>

          <Section title="A typical day" hint="List the real tasks. Candidates use this to picture the job.">
            <Rows
              items={form.tasks}
              blank=""
              max={MAX_ITEMS}
              noun="task"
              addLabel="Add a task"
              onChange={(tasks) => change("tasks", tasks)}
              render={(task, i, update) => (
                <>
                  <TextField label={`Task ${i + 1}`} value={task} maxLength={MAX_LINE} onChange={update} />
                  <PhraseHelp text={task} maxLength={MAX_LINE} onUse={update} />
                </>
              )}
            />
          </Section>

          <Section title="What the job needs" hint="Talent search matches the skill you pick. A requirement with no skill shows to candidates but isn't ranked.">
            <h3 className="font-semibold">Essential</h3>
            <Rows
              items={essential}
              blank={BLANK_REQUIREMENT}
              max={MAX_ITEMS}
              noun="essential requirement"
              addLabel="Add an essential requirement"
              onChange={(items) => change("essential", items)}
              render={(item, i, update) => <RequirementRow label={`Essential requirement ${i + 1}`} item={item} onChange={update} />}
            />
            <h3 className="mt-2 font-semibold">Nice to have</h3>
            <Rows
              items={niceToHave}
              blank={BLANK_REQUIREMENT}
              max={MAX_ITEMS}
              noun="nice-to-have requirement"
              addLabel="Add a nice-to-have requirement"
              onChange={(items) => change("niceToHave", items)}
              render={(item, i, update) => <RequirementRow label={`Nice to have ${i + 1}`} item={item} onChange={update} />}
            />
          </Section>

          <Section title="Work environment" hint="Tick what this job really offers. Candidates compare it with what they need.">
            <fieldset className="flex flex-col gap-1">
              <legend className="sr-only">What this job offers</legend>
              <div className="grid gap-x-4 sm:grid-cols-2">
                {ENVIRONMENT_FACTORS.map((factor) => (
                  <label key={factor} className="flex min-h-11 cursor-pointer items-center gap-3 py-1 text-sm">
                    <Checkbox
                      checked={form.environment?.includes(factor) ?? false}
                      onCheckedChange={(on) => change("environment", toggleFactor(form.environment, factor, on === true))}
                    />
                    {ENVIRONMENT[factor]}
                  </label>
                ))}
              </div>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 border-t py-1 text-sm">
                <Checkbox checked={form.environment?.length === 0} onCheckedChange={(on) => change("environment", on === true ? [] : undefined)} />
                This job offers none of these
              </label>
            </fieldset>
          </Section>

          <Section title="Adjustments you offer" hint="List what every candidate can have without asking, for example questions sent ahead.">
            <Rows
              items={form.accommodations}
              blank=""
              max={MAX_ITEMS}
              noun="adjustment"
              addLabel="Add an adjustment"
              onChange={(items) => change("accommodations", items)}
              render={(item, i, update) => <TextField label={`Adjustment ${i + 1}`} value={item} maxLength={MAX_LINE} onChange={update} />}
            />
          </Section>

          <Section title="Hiring process" hint="Candidates see each step, how long it takes and who they will meet.">
            {form.process.length === 0 && (
              <Button variant="outline" className={`${action} w-fit`} onClick={() => change("process", PROCESS_TEMPLATE)}>
                Start from the template
              </Button>
            )}
            <Rows
              items={form.process}
              blank={BLANK_STAGE}
              max={MAX_STAGES}
              noun="hiring step"
              addLabel="Add a hiring step"
              onChange={(steps) => change("process", steps)}
              render={(s, i, update) => (
                <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
                  <TextField label={`Step ${i + 1}`} value={s.name} maxLength={MAX_SHORT} onChange={(name) => update({ ...s, name })} />
                  <SelectField label="How it happens" value={s.format} options={STAGE_OPTIONS} onChange={(format) => format && update({ ...s, format })} />
                  <NumberField label="Minutes" value={s.minutes} min={MINUTES_RANGE[0]} max={MINUTES_RANGE[1]} onChange={(minutes) => update({ ...s, minutes })} />
                  <TextField label="Who the candidate meets" value={s.who} maxLength={MAX_SHORT} onChange={(who) => update({ ...s, who })} />
                  <SelectField label="Candidates can choose instead" value={s.alternative} options={ALTERNATIVE_OPTIONS} blank="No other format" onChange={(alternative) => update({ ...s, alternative })} />
                </div>
              )}
            />
            <NumberField label="Days until you answer after each step" value={form.responseDays} min={RESPONSE_DAYS_RANGE[0]} max={RESPONSE_DAYS_RANGE[1]} onChange={(v) => change("responseDays", v)} />
          </Section>

          <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
            {problems.length > 0 && (
              <div ref={problemBox} tabIndex={-1} role="alert" className="rounded-lg border border-destructive/30 p-4 outline-none">
                <p className="font-semibold">Before you can save</p>
                <ul className="mt-1 list-inside list-disc">
                  {problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {/* On a phone the score panel is far above this point. */}
            <p className="text-sm text-muted-foreground lg:hidden">Clarity score: {clarity.score} of 100</p>
            <p role="status">
              {saved === "published" && "Published. Candidates can see this vacancy on Jobs."}
              {saved === "draft" && "Saved as a draft. Candidates can't see it."}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className={action} onClick={() => save("draft")}>
                {published ? "Unpublish" : "Save draft"}
              </Button>
              <Button className={action} onClick={() => save("published")}>
                {published ? "Save changes" : "Publish"}
              </Button>
              {saved === "published" && (
                <Link href="/jobs" className={buttonVariants({ variant: "ghost", className: action })}>
                  See it on Jobs
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RequirementRow({ label, item, onChange }: { label: string; item: Requirement; onChange: (next: Requirement) => void }) {
  return (
    <>
      <TextField label={label} value={item.text} maxLength={MAX_LINE} onChange={(text) => onChange({ ...item, text })} />
      <PhraseHelp text={item.text} maxLength={MAX_LINE} onUse={(text) => onChange({ ...item, text })} />
      <SelectField label="Skill for talent search" value={item.skill} options={SKILL_OPTIONS} blank="No skill" onChange={(skill) => onChange({ ...item, skill })} />
    </>
  );
}

function PasteStep({
  heading,
  text,
  onText,
  onManual,
  onDraft,
}: {
  heading: React.RefObject<HTMLHeadingElement | null>;
  text: string;
  onText: (text: string) => void;
  onManual: () => void;
  onDraft: (draft: VacancyDraft) => void;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const request = useRef<AbortController>(null);

  useEffect(() => () => request.current?.abort(), []);

  function read() {
    const controller = new AbortController();
    request.current = controller;
    setStatus("loading");
    extractVacancy(text, controller.signal)
      .then(onDraft)
      .catch(() => setStatus(controller.signal.aborted ? "idle" : "error"));
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 ref={heading} tabIndex={-1} className="text-3xl font-bold outline-none">
          Add a vacancy
        </h1>
        <p className="text-muted-foreground">Paste your vacancy. We fill in a card for you to check. Nothing is saved until you say so.</p>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Your vacancy
        <Textarea
          value={text}
          maxLength={MAX_POSTING}
          rows={10}
          disabled={status === "loading"}
          onChange={(e) => onText(e.target.value)}
          className="min-h-48 bg-card text-base font-normal md:text-base"
        />
      </label>
      <p className="text-sm text-muted-foreground">Only this text goes to an AI service (Groq). Leave out any candidate&apos;s personal details.</p>
      {/* Stays in the page, so screen readers announce the message when it arrives. */}
      <p role="status">
        {status === "loading" && "Reading your vacancy…"}
        {status === "error" && "We couldn't read this right now. Try again, or fill in the card yourself. Your text stays here."}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button className={action} disabled={!text.trim() || status === "loading"} onClick={read}>
          {status === "error" ? "Try again" : "Read it for me"}
        </Button>
        <Button variant="outline" className={action} disabled={status === "loading"} onClick={onManual}>
          Fill it in by hand
        </Button>
      </div>
      {text.trim() && (
        <div className="flex flex-col gap-2 rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Vague phrases in your text</h2>
          <MarkedText text={text} />
        </div>
      )}
    </section>
  );
}
