"use client";

import Link from "next/link";
import { Check, Circle, Star } from "lucide-react";
import { outlined, pageTitle, panel } from "@/components/employers/vacancy-fields";
import { buttonVariants } from "@/components/ui/button";
import { useEmployerData, useSeal } from "@/lib/employer-store";
import { SEAL_LEVELS, SEAL_NAMES, nextLevel, type SealCheck } from "@/lib/seal";
import { useHydrated } from "@/lib/use-hydrated";

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className={`${pageTitle} flex items-center gap-2`}>
          {/* Star gold marks achievements only. The outline keeps it visible on white. */}
          {seal.level && <Star aria-hidden className="size-7 shrink-0 fill-star text-foreground" />}
          {/* Progress, not a deficit: the line below says what is left. */}
          {seal.level ? `Neuroinclusive seal: ${SEAL_NAMES[seal.level]}` : "Your Neuroinclusive seal"}
        </h1>
        <p data-detail="extra">It comes from what you do on Constela. It changes as soon as your data does.</p>
        {next && (
          <p>
            {toDo === 1 ? "1 thing" : `${toDo} things`} to do to reach {SEAL_NAMES[next]}.
          </p>
        )}
      </div>

      {SEAL_LEVELS.map((level) => (
        <section key={level} className={panel}>
          <h2 className="text-xl font-semibold">{SEAL_NAMES[level]}</h2>
          <ul className="flex flex-col gap-3">
            {seal.checks
              .filter((c) => c.level === level)
              .map((check) => (
                <li key={check.id}>
                  <SealRow check={check} />
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function SealRow({ check }: { check: SealCheck }) {
  const Icon = check.met ? Check : Circle;
  return (
    <div className="flex items-start gap-3">
      <Icon aria-hidden className="mt-1 size-5 shrink-0" />
      <div className="flex min-w-0 flex-col gap-2">
        <div>
          <p>
            <span className="sr-only">{check.met ? "Done: " : "To do: "}</span>
            {check.met ? check.detail : check.todo}
          </p>
          {!check.met && <p>{check.detail}</p>}
        </div>
        {!check.met && check.href && (
          <Link href={check.href} aria-label={`Go there: ${check.todo}`} className={buttonVariants({ variant: "outline", className: `${outlined} w-fit` })}>
            Go there
          </Link>
        )}
      </div>
    </div>
  );
}
