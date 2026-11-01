import { CalendarClock, Clock, FileText, Hand, HelpCircle, MapPin, MessageSquare, NotebookPen, Send, Video } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// No AI here: the same calm guide for everyone, Easy Read, one idea per line.
const PARTS: { title: string; items: [LucideIcon, string][] }[] = [
  {
    title: "Before",
    items: [
      [CalendarClock, "Check the day, the time and who you will meet."],
      [MapPin, "Plan how to get there. Try to arrive 10 minutes early."],
      [FileText, "Bring your CV, a pen and one or two questions to ask."],
      [Video, "Online interview: test your camera, sound and link the day before."],
    ],
  },
  {
    title: "During",
    items: [
      [Clock, "Most interviews take 30 to 60 minutes."],
      [MessageSquare, "They ask about you, your skills and why you want the job."],
      [Hand, "You can ask them to repeat a question. You can take a moment to think."],
      [HelpCircle, "You can ask for what helps you, like a quiet room or the questions in writing."],
    ],
  },
  {
    title: "After",
    items: [
      [Send, "Send a short thank-you message the same day or the next day."],
      [NotebookPen, "Write down what went well while you still remember."],
      [Clock, "They may take days or weeks to answer. That is normal."],
    ],
  },
];

export function WhatToExpect() {
  return (
    <div className="flex flex-col gap-8">
      {PARTS.map((part) => (
        <section key={part.title} className="flex flex-col gap-3 rounded-xl border bg-card p-5">
          <h2 className="text-xl font-semibold">{part.title}</h2>
          <ol className="flex flex-col gap-3">
            {part.items.map(([Icon, text]) => (
              <li key={text} className="flex gap-3">
                <Icon aria-hidden data-pz-icon className="mt-0.5 size-5 shrink-0 text-primary" />
                <span className="text-pretty">{text}</span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
