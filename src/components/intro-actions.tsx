"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { loadBarrierPreferences } from "@/lib/barrier-preferences";
import { loadProfile } from "@/lib/profile";
import { useHydrated } from "@/lib/use-hydrated";

const action = "h-11 px-5 text-base";

const HOW = [
  { title: "Tell us what helps you", text: "Answer a few short questions. No diagnosis required." },
  { title: "Get one small step at a time", text: "Your plan shows what to do now, and breaks big tasks into small ones." },
  { title: "Watch your stars light up", text: "Every step you finish lights a star, from getting ready to your first interview." },
];

// One clear way in. Sign-in returns here when accounts exist (Supabase).
export function IntroActions() {
  const hasProfile = useHydrated() && (loadProfile() !== null || loadBarrierPreferences() !== null);
  const [how, setHow] = useState(false);
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

      <p className="text-sm text-muted-foreground">
        No account needed. Your progress stays on this device.{" "}
        <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
          Privacy
        </Link>
      </p>
    </div>
  );
}
