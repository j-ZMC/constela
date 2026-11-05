"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { InterviewQuestions } from "@/components/employers/interview-questions";
import { EmployerPage } from "@/components/employers/employer-page";
import { useUrlValue } from "@/components/employers/list-detail";
import { action, outlined, panel } from "@/components/employers/vacancy-fields";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { markGuideRead, useEmployerData } from "@/lib/employer-store";
import { Loading } from "@/components/loading";
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

// What is open lives in the URL, so the parts wait for hydration; the sky and title don't.
export function InterviewerGuide() {
  const hydrated = useHydrated();
  return (
    <EmployerPage title="Interviewer guide" intro="Read how to run a fair interview, then prepare the questions for your job post." width="max-w-4xl">
      {hydrated ? <Guide /> : <Loading />}
    </EmployerPage>
  );
}

// The parts as tabs, like the Profile's. The open part lives in the URL, so Back returns to the part before.
function Guide() {
  const { guideRead } = useEmployerData();
  const [open, setOpen] = useUrlValue("part");
  const title = useRef<HTMLHeadingElement>(null);
  // Arrow keys keep focus on the tabs. Next part moves it to the new part's title once that part is open (the URL, and
  // so the open part, changes a render after the click).
  const focusPart = useRef<string | null>(null);
  const selected = PARTS.find((p) => p.id === open) ?? PARTS[0];

  useEffect(() => {
    if (focusPart.current !== selected.id) return;
    focusPart.current = null;
    title.current?.focus();
  }, [selected]);

  return (
    <Tabs value={selected.id} onValueChange={(value) => setOpen(String(value))}>
      <TabsList aria-label="Parts of this guide" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {PARTS.map((p) => (
          <TabsTrigger key={p.id} value={p.id}>
            {p.title}
          </TabsTrigger>
        ))}
      </TabsList>
      {PARTS.map((part, i) => {
        const next = PARTS[i + 1];
        const asksToRead = part.id === LAST_READ && !guideRead;
        return (
          <TabsPanel key={part.id} value={part.id}>
            {part === QUESTIONS ? (
              <InterviewQuestions title={title} />
            ) : (
              <section aria-labelledby="part-title" className={panel}>
                <h2 id="part-title" ref={title} tabIndex={-1} className="text-xl font-semibold outline-none">
                  {part.title}
                </h2>
                <ul className="flex list-disc flex-col gap-2 pl-6">
                  {part.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
                {part.id === LAST_READ && <GuideRead />}
                {next && (
                  <Button
                    variant={asksToRead ? "outline" : "default"}
                    className={`${asksToRead ? outlined : action} gap-2 self-end`}
                    onClick={() => {
                      focusPart.current = next.id;
                      setOpen(next.id);
                    }}
                  >
                    Next part
                    <ArrowRight aria-hidden className="size-5" />
                  </Button>
                )}
              </section>
            )}
          </TabsPanel>
        );
      })}
    </Tabs>
  );
}

function GuideRead() {
  const { guideRead } = useEmployerData();
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3 border-t pt-4">
      {!guideRead && (
        <Button className={action} onClick={() => setFailed(!markGuideRead())}>
          I read it
        </Button>
      )}
      <p role="status">{failed ? "This browser could not save that. Try again." : guideRead && "You read this guide. It counts toward your seal."}</p>
    </div>
  );
}
