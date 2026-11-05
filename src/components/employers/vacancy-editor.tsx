"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Info } from "lucide-react";
import { EmployerPage } from "@/components/employers/employer-page";
import { ListDetail, ListRow, ROWS, useOpenRow } from "@/components/employers/list-detail";
import { MarkedText, PhraseHelp } from "@/components/employers/phrase-help";
import { Field, LongTextField, NumberField, Rows, SelectField, TextField, action, longControl, note, outlined, panel } from "@/components/employers/vacancy-fields";
import { onSky } from "@/components/page-sky";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import type { VacancyDraft } from "@/lib/employer-ai";
import { extractVacancy } from "@/lib/employer-ai-client";
import { saveVacancy } from "@/lib/employer-store";
import { cn } from "@/lib/utils";
import {
  ALTERNATIVE_FORMATS,
  CLEAR_SCORE,
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
import {
  PARTS,
  PROCESS_TEMPLATE,
  cleanVacancy,
  formFromDraft,
  leftText,
  partStatuses,
  publishProblems,
  saveProblems,
  toggleFactor,
  type PartId,
  type PartStatus,
  type VacancyForm,
} from "@/lib/vacancy-editor";

const labelled = <T extends string>(values: readonly T[], label: (value: T) => string) => values.map((value) => ({ value, label: label(value) }));

const MODALITY_OPTIONS = labelled(MODALITIES, (m) => MODALITY_LABELS[m]);
const STAGE_OPTIONS = labelled(STAGE_FORMATS, (f) => STAGE_FORMAT_LABELS[f]);
const ALTERNATIVE_OPTIONS = labelled(ALTERNATIVE_FORMATS, (f) => STAGE_FORMAT_LABELS[f]);
const CURRENCY_OPTIONS = labelled(CURRENCIES, (c) => c);
const PERIOD_OPTIONS = labelled(SALARY_PERIODS, (p) => `Per ${p}`);
const SKILL_OPTIONS = labelled(SKILL_IDS, (s) => SKILLS[s]).sort((a, b) => a.label.localeCompare(b.label));

const BLANK_REQUIREMENT: Requirement = { text: "" };
const BLANK_STAGE: Stage = { name: "", format: "video-call" };

type Step = "paste" | "card";
type Change = <K extends keyof VacancyForm>(key: K, value: VacancyForm[K]) => void;

// Work that can't be saved yet stays here when the editor closes, so the menu or the Back gesture never lose it.
// shortcut: it lives in this tab only, and a reload warns first; store it if employers keep unsaved work across visits.
const unsaved = new Map<string, { form: VacancyForm; step: Step; posting: string }>();
export const unsavedForms = () => [...unsaved.values()].map((kept) => kept.form);

export function VacancyEditor({ start, isNew, onClose }: { start: VacancyForm; isNew: boolean; onClose: () => void }) {
  const kept = unsaved.get(start.id);
  const [form, setForm] = useState(kept?.form ?? start);
  const [savedAs, setSavedAs] = useState(() => JSON.stringify(start));
  const [step, setStep] = useState<Step>(kept?.step ?? (isNew ? "paste" : "card"));
  const [posting, setPosting] = useState(kept?.posting ?? "");
  const [fromAi, setFromAi] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const { open, setOpen, title: partTitle } = useOpenRow("part");
  const heading = useRef<HTMLHeadingElement>(null);
  const problemBox = useRef<HTMLDivElement>(null);

  const dirty = step === "paste" ? posting.trim() !== "" : JSON.stringify(form) !== savedAs;

  // The button that opened each step is gone, so keyboard and screen reader users start from the new title.
  useEffect(() => heading.current?.focus(), [step]);

  useEffect(() => {
    if (dirty) unsaved.set(form.id, { form, step, posting });
    else unsaved.delete(form.id);
  }, [dirty, form, step, posting]);

  // A reload or a closed tab would lose what can't be saved yet.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (problems.length > 0) problemBox.current?.focus();
  }, [problems]);

  // False when the browser blocks storage or it is full.
  function store(next: VacancyForm) {
    const stored = saveVacancy(cleanVacancy(next));
    setFailed(!stored);
    if (stored) setSavedAs(JSON.stringify(next));
    return stored;
  }

  // Drafts save themselves. A live job post waits for Save changes, so candidates never read half a sentence.
  function update(next: VacancyForm) {
    setForm(next);
    if (next.status === "draft" && saveProblems(cleanVacancy(next)).length === 0) store(next);
  }

  const change: Change = (key, value) => update({ ...form, [key]: value });

  function save(status: Vacancy["status"]) {
    const next = { ...form, status };
    const vacancy = cleanVacancy(next);
    const found = status === "published" ? publishProblems(vacancy) : saveProblems(vacancy);
    setProblems(found);
    if (found.length > 0 || !store(next)) return;
    setForm(next);
    setFromAi(false);
  }

  function leave() {
    unsaved.delete(form.id);
    onClose();
  }

  // The way back sits in the page sky, above the title. With changes not saved, it asks first, at the top of the page.
  const back = !leaving && (
    <Button variant="ghost" className={cn(action, "w-fit gap-2 px-2 font-normal underline underline-offset-4", onSky)} onClick={() => (dirty ? setLeaving(true) : onClose())}>
      <ArrowLeft aria-hidden className="size-5" />
      Back to jobs
    </Button>
  );
  const askToLeave = leaving && (
    <div role="alert" className={panel}>
      <p>You have changes that are not saved.</p>
      <div className="flex flex-wrap gap-3">
        <Button autoFocus variant="outline" className={outlined} onClick={() => setLeaving(false)}>
          Keep editing
        </Button>
        <Button variant="ghost" className={`${action} font-normal underline underline-offset-4`} onClick={leave}>
          Leave without saving
        </Button>
      </div>
    </div>
  );

  if (step === "paste") {
    return (
      <EmployerPage title="Add a job post" titleRef={heading} intro="Paste your job post. We fill in its parts for you to check." before={back} width="max-w-3xl">
        {askToLeave}
        <PasteStep
          text={posting}
          onText={setPosting}
          onManual={() => setStep("card")}
          onDraft={(draft) => {
            update(formFromDraft(draft, form.id));
            setFromAi(true);
            setStep("card");
          }}
        />
      </EmployerPage>
    );
  }

  const vacancy = cleanVacancy(form);
  const parts = partStatuses(vacancy);
  const left = parts.reduce((sum, part) => sum + part.left, 0);
  const { score } = clarityScore(vacancy);
  const published = form.status === "published";
  const waiting = published ? [] : saveProblems(vacancy);
  const selected = PARTS.find((p) => p.id === open)?.id ?? PARTS[0].id;
  const nextPart = PARTS[PARTS.findIndex((p) => p.id === selected) + 1];
  const part = parts.find((p) => p.id === selected) as PartStatus;
  const ready = !published && left === 0;

  return (
    <EmployerPage
      title={form.title.trim() || "New job post"}
      titleRef={heading}
      before={<div className={open ? "hidden lg:block" : undefined}>{back}</div>}
      after={
        // Stays in the page, so screen readers hear it change.
        <p role="status" className="flex items-start gap-2 text-pretty text-white/80">
          {!failed && !dirty && <Check aria-hidden className="mt-1 size-5 shrink-0" />}
          <span>
            {failed && "This browser could not save the job post. Copy your text somewhere safe and try again."}
            {!failed && published && (dirty ? "Published. You have changes that are not saved." : "Published. Candidates can see this job post on Jobs.")}
            {!failed && !published && (waiting.length > 0 ? `Draft. Not saved yet. ${waiting.join(" ")}` : "Draft. Saved.")}
          </span>
        </p>
      }
    >
      {askToLeave}
      <div className="flex flex-wrap items-center gap-3">
        {/* One main action at a time: Publish takes over from Next part when nothing is left. */}
        <Button variant={published || ready ? "default" : "outline"} className={published || ready ? action : outlined} onClick={() => save("published")}>
          {published ? "Save changes" : "Publish"}
        </Button>
        {published && (
          <Button variant="outline" className={outlined} onClick={() => save("draft")}>
            Unpublish
          </Button>
        )}
        {published && !dirty && (
          <Link href="/jobs" className={`${action} flex items-center font-normal underline underline-offset-4`}>
            See it on Jobs
          </Link>
        )}
      </div>

      {problems.length > 0 && (
        <div ref={problemBox} tabIndex={-1} role="alert" className={`${note} outline-none`}>
          <p className="font-semibold">Before you can publish</p>
          <ul className="list-inside list-disc">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      {fromAi && (
        <p role="status" className={note}>
          AI filled in these parts from your text. Check each part before you publish.
        </p>
      )}

      <ListDetail
        open={open !== null}
        backLabel="Back to all parts"
        onBack={() => setOpen(null)}
        list={
          <div className="flex flex-col gap-3">
            <p role="status" className="font-semibold">
              {leftText(left)}
            </p>
            <nav aria-label="Parts of this job post" className={ROWS}>
              {parts.map((p) => (
                <ListRow key={p.id} id={p.id} selected={p.id === selected} open={open !== null} onOpen={() => setOpen(p.id)} className="items-center justify-between">
                  {p.name}
                  <span className="sr-only">, </span>
                  <PartState part={p} />
                </ListRow>
              ))}
            </nav>
            {/* Always shown, even in the Reduced view: the seal counts this score. */}
            <p>
              Clarity score: {score} of 100. {score >= CLEAR_SCORE ? "This job post is clear." : `A job post is clear at ${CLEAR_SCORE}.`}
            </p>
            {posting.trim() && (
              <details className={panel}>
                <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Your pasted text</summary>
                <MarkedText text={posting} />
              </details>
            )}
          </div>
        }
      >
        <section aria-labelledby="part-title" className={panel}>
          <h2 id="part-title" ref={partTitle} tabIndex={-1} className="text-xl font-semibold outline-none">
            {part.name}
          </h2>
          {part.fixes.length > 0 && (
            <div className={note}>
              <h3 className="font-semibold">To fix here</h3>
              <ul className="flex flex-col gap-1">
                {part.fixes.map((issue) => (
                  <li key={issue.id}>
                    {issue.fix}
                    {issue.points > 0 && <span data-detail="extra"> (+{issue.points} points)</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <PartFields part={selected} form={form} change={change} />
          {nextPart && (
            <Button variant={ready ? "outline" : "default"} className={`${ready ? outlined : action} gap-2 self-end`} onClick={() => setOpen(nextPart.id)}>
              Next part
              <ArrowRight aria-hidden className="size-5" />
            </Button>
          )}
        </section>
      </ListDetail>
    </EmployerPage>
  );
}

function PartState({ part }: { part: PartStatus }) {
  if (part.empty) return <span>Empty</span>;
  const Icon = part.left > 0 ? Info : Check;
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <Icon aria-hidden className="size-5" />
      {part.left > 0 ? `${part.left} to fix` : "Done"}
    </span>
  );
}

function PartFields({ part, form, change }: { part: PartId; form: VacancyForm; change: Change }) {
  switch (part) {
    case "job":
      return (
        <>
          <div className="flex flex-col gap-2">
            <TextField label="Job title" value={form.title} maxLength={MAX_SHORT} onChange={(v) => change("title", v)} />
            <PhraseHelp text={form.title} maxLength={MAX_SHORT} onUse={(v) => change("title", v)} />
          </div>
          <TextField label="Company" value={form.company} maxLength={MAX_SHORT} onChange={(v) => change("company", v)} />
          <div className="flex flex-col gap-2">
            <LongTextField label="Short summary" value={form.summary} maxLength={MAX_SUMMARY} onChange={(v) => change("summary", v)} />
            <PhraseHelp text={form.summary} maxLength={MAX_SUMMARY} onUse={(v) => change("summary", v)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Work mode" value={form.modality} options={MODALITY_OPTIONS} blank="Not chosen yet" onChange={(v) => change("modality", v)} />
            <TextField label="Location" value={form.location} maxLength={MAX_SHORT} onChange={(v) => change("location", v)} />
          </div>
        </>
      );
    case "pay":
      return (
        <>
          <p data-detail="extra">Fill in one amount if the salary is fixed.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField label="Lowest" value={form.salary.min} min={1} onChange={(min) => change("salary", { ...form.salary, min })} />
            <NumberField label="Highest" value={form.salary.max} min={1} onChange={(max) => change("salary", { ...form.salary, max })} />
            <SelectField label="Currency" value={form.salary.currency} options={CURRENCY_OPTIONS} onChange={(currency) => currency && change("salary", { ...form.salary, currency })} />
            <SelectField label="Paid" value={form.salary.period} options={PERIOD_OPTIONS} onChange={(period) => period && change("salary", { ...form.salary, period })} />
          </div>
          <TextField label="Work schedule" value={form.schedule} maxLength={MAX_SHORT} onChange={(v) => change("schedule", v)} />
        </>
      );
    case "day":
      return (
        <>
          <p data-detail="extra">Write the real tasks. Candidates use this to picture the job.</p>
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
        </>
      );
    case "needs":
      return (
        <>
          <p data-detail="extra">People search matches the skill you pick. A requirement with no skill shows to candidates but isn&apos;t ranked.</p>
          <h3 className="font-semibold">Essential</h3>
          <Rows
            items={form.essential}
            blank={BLANK_REQUIREMENT}
            max={MAX_ITEMS}
            noun="essential requirement"
            addLabel="Add an essential requirement"
            onChange={(items) => change("essential", items)}
            render={(item, i, update) => <RequirementRow label={`Essential requirement ${i + 1}`} item={item} onChange={update} />}
          />
          <h3 className="mt-2 font-semibold">Nice to have</h3>
          <Rows
            items={form.niceToHave}
            blank={BLANK_REQUIREMENT}
            max={MAX_ITEMS}
            noun="nice-to-have requirement"
            addLabel="Add a nice-to-have requirement"
            onChange={(items) => change("niceToHave", items)}
            render={(item, i, update) => <RequirementRow label={`Nice to have ${i + 1}`} item={item} onChange={update} />}
          />
        </>
      );
    case "workplace":
      return (
        <>
          <h3 className="font-semibold">What this job offers</h3>
          <p data-detail="extra">Tick what this job really offers. Candidates compare it with what they need.</p>
          <fieldset className="flex flex-col gap-1">
            <legend className="sr-only">What this job offers</legend>
            {ENVIRONMENT_FACTORS.map((factor) => (
              <label key={factor} className="flex min-h-11 cursor-pointer items-center gap-3 py-1">
                <Checkbox
                  checked={form.environment?.includes(factor) ?? false}
                  onCheckedChange={(on) => change("environment", toggleFactor(form.environment, factor, on === true))}
                />
                {ENVIRONMENT[factor]}
              </label>
            ))}
            <label className="flex min-h-11 cursor-pointer items-center gap-3 border-t py-1">
              <Checkbox checked={form.environment?.length === 0} onCheckedChange={(on) => change("environment", on === true ? [] : undefined)} />
              This job offers none of these
            </label>
          </fieldset>
          <h3 className="mt-2 font-semibold">Adjustments you offer</h3>
          <p data-detail="extra">List what every candidate can have without asking, for example questions sent ahead.</p>
          <Rows
            items={form.accommodations}
            blank=""
            max={MAX_ITEMS}
            noun="adjustment"
            addLabel="Add an adjustment"
            onChange={(items) => change("accommodations", items)}
            render={(item, i, update) => <TextField label={`Adjustment ${i + 1}`} value={item} maxLength={MAX_LINE} onChange={update} />}
          />
        </>
      );
    case "steps":
      return (
        <>
          <p data-detail="extra">Candidates see each step, how long it takes and who they will meet.</p>
          {form.process.length === 0 && (
            <Button variant="outline" className={`${outlined} w-fit`} onClick={() => change("process", PROCESS_TEMPLATE)}>
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
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(12rem,100%),1fr))] items-end gap-4 rounded-lg border p-4">
                <TextField label={`Step ${i + 1}`} value={s.name} maxLength={MAX_SHORT} onChange={(name) => update({ ...s, name })} />
                <SelectField label="How it happens" value={s.format} options={STAGE_OPTIONS} onChange={(format) => format && update({ ...s, format })} />
                <NumberField label="Minutes" value={s.minutes} min={MINUTES_RANGE[0]} max={MINUTES_RANGE[1]} onChange={(minutes) => update({ ...s, minutes })} />
                <TextField label="Who the candidate meets" value={s.who} maxLength={MAX_SHORT} onChange={(who) => update({ ...s, who })} />
                <SelectField label="Candidates can choose instead" value={s.alternative} options={ALTERNATIVE_OPTIONS} blank="No other format" onChange={(alternative) => update({ ...s, alternative })} />
              </div>
            )}
          />
          <NumberField label="Days until you answer after each step" value={form.responseDays} min={RESPONSE_DAYS_RANGE[0]} max={RESPONSE_DAYS_RANGE[1]} onChange={(v) => change("responseDays", v)} />
        </>
      );
  }
}

function RequirementRow({ label, item, onChange }: { label: string; item: Requirement; onChange: (next: Requirement) => void }) {
  return (
    <>
      <TextField label={label} value={item.text} maxLength={MAX_LINE} onChange={(text) => onChange({ ...item, text })} />
      <PhraseHelp text={item.text} maxLength={MAX_LINE} onUse={(text) => onChange({ ...item, text })} />
      <SelectField label="Skill for people search" value={item.skill} options={SKILL_OPTIONS} blank="No skill" onChange={(skill) => onChange({ ...item, skill })} />
    </>
  );
}

function PasteStep({
  text,
  onText,
  onManual,
  onDraft,
}: {
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
      <p>Your draft saves itself, and candidates can&apos;t see it until you publish.</p>
      <Field label="Your job post">
        <Textarea value={text} maxLength={MAX_POSTING} rows={10} disabled={status === "loading"} onChange={(e) => onText(e.target.value)} className={`${longControl} min-h-48`} />
      </Field>
      <p data-detail="extra">Only this text goes to an AI service (Groq). Leave out any candidate&apos;s personal details.</p>
      {/* Stays in the page, so screen readers announce the message when it arrives. */}
      <p role="status">
        {status === "loading" && "Reading your job post…"}
        {status === "error" && "We couldn't read this right now. Try again, or fill in the parts yourself. Your text stays here."}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button className={action} disabled={!text.trim() || status === "loading"} onClick={read}>
          {status === "error" ? "Try again" : "Read it for me"}
        </Button>
        <Button variant="outline" className={outlined} disabled={status === "loading"} onClick={onManual}>
          Fill it in by hand
        </Button>
      </div>
      {text.trim() && (
        <div className={panel}>
          <h2 className="font-semibold">Vague phrases in your text</h2>
          <MarkedText text={text} />
        </div>
      )}
    </section>
  );
}
