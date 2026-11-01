"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Field, Section, SelectField, action } from "@/components/employers/vacancy-fields";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { InterviewQuestion } from "@/lib/employer-ai";
import { draftInterview } from "@/lib/employer-ai-client";
import { saveInterview, useEmployerData } from "@/lib/employer-store";
import { checkQuestion, concreteQuestion, questionProblems, templateQuestions } from "@/lib/interview-questions";
import { useHydrated } from "@/lib/use-hydrated";
import { MAX_QUESTION, type Vacancy } from "@/lib/vacancy";

export function InterviewQuestions() {
  return useHydrated() ? <Questions /> : null;
}

function Questions() {
  const { vacancies, interviews } = useEmployerData();
  const [chosen, setChosen] = useState<string>();
  const published = vacancies.filter((v) => v.status === "published");
  // Next keeps this page alive while the employer is elsewhere, so the chosen vacancy may have been unpublished since.
  const vacancy = published.find((v) => v.id === chosen) ?? published[0];

  if (!vacancy) {
    return (
      <Section title="Interview questions">
        <p>Publish a vacancy to prepare its questions.</p>
        <Link href="/employers/vacancies" className={buttonVariants({ variant: "outline", className: `${action} w-fit` })}>
          Go to your vacancies
        </Link>
      </Section>
    );
  }

  const options = published.map((v) => ({ value: v.id, label: `${v.title} · ${v.company}` }));
  return (
    <Section title="Interview questions" hint="Every candidate for this vacancy gets these questions and this rubric.">
      <SelectField label="Vacancy" value={vacancy.id} options={options} onChange={setChosen} />
      {/* Each vacancy has its own draft. */}
      <Editor key={vacancy.id} vacancy={vacancy} saved={interviews.find((i) => i.vacancyId === vacancy.id)?.questions} />
    </Section>
  );
}

function Editor({ vacancy, saved }: { vacancy: Vacancy; saved?: InterviewQuestion[] }) {
  const [questions, setQuestions] = useState(saved ?? []);
  const [status, setStatus] = useState<"idle" | "loading" | "failed">("idle");
  const [message, setMessage] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const request = useRef<AbortController>(null);

  useEffect(() => () => request.current?.abort(), []);

  const essential = vacancy.essential.map((r) => r.text);
  if (essential.length === 0) return <p>This vacancy has no essential requirements yet. Add them to prepare its questions.</p>;

  function draft() {
    const controller = new AbortController();
    request.current = controller;
    setStatus("loading");
    setMessage("");
    draftInterview(vacancy, controller.signal)
      .then((next) => {
        setQuestions(next);
        setStatus("idle");
        setMessage("AI drafted these questions. Nothing is saved yet. Check each one, then save.");
      })
      .catch(() => setStatus(controller.signal.aborted ? "idle" : "failed"));
  }

  function template() {
    setQuestions(templateQuestions(essential));
    setStatus("idle");
    setMessage("These are simple questions from your requirements. Nothing is saved yet.");
  }

  function save() {
    const found = questionProblems(questions);
    setProblems(found);
    if (found.length > 0) return;
    setMessage(saveInterview({ vacancyId: vacancy.id, questions }) ? "Saved. Every candidate for this vacancy gets these questions." : "This browser could not save the questions. Try again.");
  }

  const change = (i: number, next: InterviewQuestion) => {
    setQuestions(questions.with(i, next));
    setMessage("");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" className={action} disabled={status === "loading"} onClick={draft}>
          {status === "failed" ? "Try again" : "Draft with AI"}
        </Button>
        <Button variant="outline" className={action} disabled={status === "loading"} onClick={template}>
          Use simple questions
        </Button>
      </div>
      {/* Stays in the page, so screen readers announce the message when it arrives. */}
      <p role="status">
        {status === "loading" && "Writing the questions…"}
        {status === "failed" && "We couldn't write the questions right now. Try again, or use simple questions."}
        {status === "idle" && message}
      </p>

      {questions.length > 0 && (
        <>
          <ol className="flex flex-col gap-4">
            {questions.map((q, i) => (
              <li key={q.requirement}>
                <QuestionRow number={i + 1} question={q} onChange={(next) => change(i, next)} />
              </li>
            ))}
          </ol>
          {problems.length > 0 && (
            <ul role="alert" className="list-inside list-disc rounded-lg border border-destructive/30 p-4">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          <Button className={`${action} w-fit`} onClick={save}>
            Save questions
          </Button>
        </>
      )}
    </div>
  );
}

function RubricField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <Textarea value={value} maxLength={MAX_QUESTION} rows={2} onChange={(e) => onChange(e.target.value)} className="min-h-11 bg-card text-base font-normal md:text-base" />
    </Field>
  );
}

function QuestionRow({ number, question: q, onChange }: { number: number; question: InterviewQuestion; onChange: (next: InterviewQuestion) => void }) {
  const flags = checkQuestion(q.question);
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <p className="text-sm font-medium text-muted-foreground">For: {q.requirement}</p>
      <RubricField label={`Question ${number}`} value={q.question} onChange={(question) => onChange({ ...q, question })} />
      {flags.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg bg-secondary p-3 text-sm">
          {flags.map((f) => (
            <p key={f.id}>{f.problem}</p>
          ))}
          <p>A concrete version: {concreteQuestion(q.requirement)}</p>
          <Button variant="outline" className={`${action} w-fit`} aria-label={`Use this version for question ${number}`} onClick={() => onChange({ ...q, question: concreteQuestion(q.requirement) })}>
            Use this version
          </Button>
        </div>
      )}
      <RubricField label="A strong answer shows" value={q.strong} onChange={(strong) => onChange({ ...q, strong })} />
      <RubricField label="A basic answer shows" value={q.basic} onChange={(basic) => onChange({ ...q, basic })} />
    </div>
  );
}
