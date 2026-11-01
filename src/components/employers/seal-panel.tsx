"use client";

import Link from "next/link";
import { Check, Circle, Star } from "lucide-react";
import { action } from "@/components/employers/vacancy-fields";
import { Button } from "@/components/ui/button";
import { saveVacancy, useEmployerData, useSeal } from "@/lib/employer-store";
import { SEAL_LEVELS, nextLevel, type SealCheck, type SealLevel } from "@/lib/seal";
import { useHydrated } from "@/lib/use-hydrated";
import { DEMO_VACANCY } from "@/lib/vacancy";

const NAMES: Record<SealLevel, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold" };

// The seal lives in localStorage data, so render only after hydration (same as the Profile flow).
export function SealPanel() {
  return useHydrated() ? <Panel /> : null;
}

function Panel() {
  const data = useEmployerData();
  const seal = useSeal(data);
  const next = nextLevel(seal);
  const toDo = seal.checks.filter((c) => c.level === next && !c.met).length;

  return (
    <section aria-labelledby="seal-heading" className="flex flex-col gap-5 rounded-xl border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h2 id="seal-heading" className="flex items-center gap-2 text-xl font-semibold">
          {/* Star gold marks achievements only. The outline keeps it visible on white. */}
          {seal.level && <Star aria-hidden className="size-6 shrink-0 fill-star text-foreground" />}
          {seal.level ? `Neuroinclusive seal: ${NAMES[seal.level]}` : "No Neuroinclusive seal yet"}
        </h2>
        <p className="text-muted-foreground">It comes from what you do on Constela. It changes as soon as your data does.</p>
        {next && (
          <p>
            {toDo === 1 ? "1 thing" : `${toDo} things`} to do to reach {NAMES[next]}.
          </p>
        )}
      </div>

      {/* A way to look around, and a way to rehearse the demo if the AI is down. */}
      {data.vacancies.length === 0 && (
        <Button variant="outline" className={`${action} w-fit`} onClick={() => saveVacancy(DEMO_VACANCY)}>
          Load a sample vacancy
        </Button>
      )}

      {SEAL_LEVELS.map((level) => (
        <div key={level} className="flex flex-col gap-2">
          <h3 className="font-semibold">{NAMES[level]}</h3>
          <ul className="flex flex-col gap-2">
            {seal.checks
              .filter((c) => c.level === level)
              .map((check) => (
                <li key={check.id}>
                  <SealRow check={check} />
                </li>
              ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function SealRow({ check }: { check: SealCheck }) {
  const Icon = check.met ? Check : Circle;
  return (
    <div className="flex items-start gap-3 text-sm">
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="flex min-w-0 flex-col gap-1">
        <p>
          <span className="sr-only">{check.met ? "Done: " : "To do: "}</span>
          {check.met ? check.detail : check.todo}
        </p>
        {!check.met && <p className="text-muted-foreground">{check.detail}</p>}
        {!check.met && check.href && (
          <Link href={check.href} aria-label={`Go there: ${check.todo}`} className="flex min-h-11 w-fit items-center font-medium underline underline-offset-4">
            Go there
          </Link>
        )}
      </div>
    </div>
  );
}
