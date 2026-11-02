"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { InterviewQuestions } from "@/components/employers/interview-questions";
import { ListDetail, ListRow, useOpenRow } from "@/components/employers/list-detail";
import { action, outlined, pageTitle, panel } from "@/components/employers/vacancy-fields";
import { Button } from "@/components/ui/button";
import { markGuideRead, useEmployerData } from "@/lib/employer-store";
import { useHydrated } from "@/lib/use-hydrated";

const GUIDE = [
  {
    id: "before",
    title: "Before the interview",
    points: [
      "Send the questions 48 hours before. Constela shows them to the candidate for you.",
      "Say who will be there and how long it takes.",
      "Offer another format, such as written answers, a work sample or a paid task.",
    ],
  },
  {
    id: "during",
    title: "During the interview",
    points: [
      "Ask everyone the same questions, in the same order.",
      "Ask one thing at a time, and wait. Silence is thinking time.",
      "Let people read the question, take notes and use what they prepared.",
      "Score the answer with the rubric: what the person did and the result.",
    ],
  },
  {
    id: "never",
    title: "Never do this",
    points: [
      "Never judge eye contact, voice, speed, small talk or confidence.",
      "Never ask about health, disability, age, family or religion.",
      "Never ask what the person would do in an imagined situation. Ask about real work.",
    ],
  },
  {
    id: "after",
    title: "After the interview",
    points: ["Send your answer by the date you promised, even when it is no.", "Say which requirement was not met, if the person asks."],
  },
];
const QUESTIONS = { id: "questions", title: "Interview questions", points: [] };
const PARTS = [...GUIDE, QUESTIONS];
const LAST_READ = GUIDE[GUIDE.length - 1].id;

// What is open lives in the URL, so render only after hydration (same as the Profile flow).
export function InterviewerGuide() {
  return useHydrated() ? <Guide /> : null;
}

function Guide() {
  const { guideRead } = useEmployerData();
  const { open, setOpen, title } = useOpenRow("part");
  const selected = PARTS.find((p) => p.id === open) ?? PARTS[0];
  const next = PARTS[PARTS.indexOf(selected) + 1];
  const asksToRead = selected.id === LAST_READ && !guideRead;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className={pageTitle}>Interviewer guide</h1>
        <p data-detail="extra">Read how to run a fair interview, then prepare the questions for your job post.</p>
      </div>
      <ListDetail
        open={open !== null}
        backLabel="Back to all parts"
        onBack={() => setOpen(null)}
        list={
          <nav aria-label="Parts of this guide" className="flex flex-col gap-2">
            {PARTS.map((p) => (
              <ListRow key={p.id} id={p.id} selected={p === selected} open={open !== null} onOpen={() => setOpen(p.id)} className="items-center">
                {p.title}
              </ListRow>
            ))}
          </nav>
        }
      >
        {selected === QUESTIONS ? (
          <InterviewQuestions title={title} />
        ) : (
          <section aria-labelledby="part-title" className={panel}>
            <h2 id="part-title" ref={title} tabIndex={-1} className="text-xl font-semibold outline-none">
              {selected.title}
            </h2>
            <ul className="flex list-disc flex-col gap-2 pl-6">
              {selected.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            {selected.id === LAST_READ && <GuideRead />}
            {next && (
              <Button variant={asksToRead ? "outline" : "default"} className={`${asksToRead ? outlined : action} gap-2 self-end`} onClick={() => setOpen(next.id)}>
                Next part
                <ArrowRight aria-hidden className="size-5" />
              </Button>
            )}
          </section>
        )}
      </ListDetail>
    </div>
  );
}

function GuideRead() {
  const { guideRead } = useEmployerData();
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3 border-t-2 pt-4">
      {!guideRead && (
        <Button className={action} onClick={() => setFailed(!markGuideRead())}>
          I read it
        </Button>
      )}
      <p role="status">{failed ? "This browser could not save that. Try again." : guideRead && "You read this guide. It counts toward your seal."}</p>
    </div>
  );
}
