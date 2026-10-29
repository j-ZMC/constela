"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { loadProfile } from "@/lib/profile";
import { useHydrated } from "@/lib/use-hydrated";

const action = "h-11 px-5 text-base";

const HOW = [
  { title: "Tell us what helps you", text: "8 short questions about how you work best. Never about a diagnosis." },
  { title: "Get one small step at a time", text: "Your plan shows what to do now, and breaks big tasks into small ones." },
  { title: "Watch your stars light up", text: "Every step you finish lights a star, from getting ready to your first interview." },
];

// One clear way in. Accounts come later (Supabase); until then the account line says so plainly.
export function IntroActions() {
  const hasProfile = useHydrated() && loadProfile() !== null;
  const [how, setHow] = useState(false);
  const [note, setNote] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <Link href={hasProfile ? "/plan" : "/profile"} className={buttonVariants({ className: action })}>
          {hasProfile ? "Continue my plan" : "Get started"}
        </Link>
        <Button variant="outline" className={action} aria-expanded={how} aria-controls="how-it-works" onClick={() => setHow(!how)}>
          {how ? "Hide how it works" : "See how it works"}
        </Button>
      </div>

      {how && (
        <ol id="how-it-works" className="flex flex-col gap-3 rounded-xl bg-secondary p-4">
          {HOW.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-sky text-sm font-semibold text-white">
                {i + 1}
              </span>
              <span className="flex flex-col">
                <span className="font-semibold">{s.title}</span>
                <span className="text-muted-foreground">{s.text}</span>
              </span>
            </li>
          ))}
        </ol>
      )}

      {/* The status line stays in the page (never display:none) so screen readers announce the note. */}
      <div className="flex flex-col">
      <p className="flex flex-wrap items-center gap-x-1 text-muted-foreground">
        Have an account?
        <Button variant="link" className="h-11 px-1 text-base" onClick={() => setNote(true)}>
          Sign in
        </Button>
        or
        <Button variant="link" className="h-11 px-1 text-base" onClick={() => setNote(true)}>
          create one
        </Button>
      </p>
      <p role="status" className="text-sm text-muted-foreground">
        {note && "Accounts are coming soon. You can start now: your progress stays on this device."}
      </p>
      </div>
      <Link href="/privacy" className="w-fit text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
        How we keep your data private
      </Link>
    </div>
  );
}
