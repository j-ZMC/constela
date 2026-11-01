"use client";

import { useState } from "react";
import { action } from "@/components/employers/vacancy-fields";
import { Button } from "@/components/ui/button";
import { markGuideRead, useEmployerData } from "@/lib/employer-store";
import { useHydrated } from "@/lib/use-hydrated";

const GUIDE = [
  {
    title: "Before the interview",
    points: [
      "Send the questions 48 hours before. Constela shows them to the candidate for you.",
      "Say who will be there and how long it takes.",
      "Offer another format, such as written answers, a work sample or a paid task.",
    ],
  },
  {
    title: "During the interview",
    points: [
      "Ask everyone the same questions, in the same order.",
      "Ask one thing at a time, and wait. Silence is thinking time.",
      "Let people read the question, take notes and use what they prepared.",
      "Score the answer with the rubric: what the person did and the result.",
    ],
  },
  {
    title: "Never do this",
    points: [
      "Never judge eye contact, voice, speed, small talk or confidence.",
      "Never ask about health, disability, age, family or religion.",
      "Never ask what the person would do in an imagined situation. Ask about real work.",
    ],
  },
  {
    title: "After the interview",
    points: ["Send your answer by the date you promised, even when it is no.", "Say which requirement was not met, if the person asks."],
  },
];

// Stays readable before hydration: only the button needs the browser.
export function InterviewerGuide() {
  return (
    <section aria-labelledby="guide-heading" className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <h2 id="guide-heading" className="text-xl font-semibold">
        How to run a fair interview
      </h2>
      {GUIDE.map((part) => (
        <div key={part.title} className="flex flex-col gap-1">
          <h3 className="font-semibold">{part.title}</h3>
          <ul className="list-disc space-y-1 pl-6">
            {part.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      ))}
      <GuideRead />
    </section>
  );
}

function GuideRead() {
  return useHydrated() ? <ReadButton /> : null;
}

function ReadButton() {
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
