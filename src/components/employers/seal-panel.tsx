"use client";

import Link from "next/link";
import { Check, Circle, Star } from "lucide-react";
import { EmployerPage } from "@/components/employers/employer-page";
import { outlined, panel } from "@/components/employers/vacancy-fields";
import { buttonVariants } from "@/components/ui/button";
import { useEmployerData, useSeal } from "@/lib/employer-store";
import { SEAL_LEVELS, SEAL_NAMES, nextLevel, type SealCheck } from "@/lib/seal";
import { Loading } from "@/components/loading";
import { useHydrated } from "@/lib/use-hydrated";

const INTRO = "It comes from what you do on Constela. It changes as soon as your data does.";

// The seal lives in localStorage data, so its level waits for hydration; the sky doesn't.
export function SealPanel() {
  return useHydrated() ? (
    <Panel />
  ) : (
    <EmployerPage title="Your Neuroinclusive seal" intro={INTRO} width="max-w-3xl">
      <Loading />
    </EmployerPage>
  );
}

function Panel() {
  const data = useEmployerData();
  const seal = useSeal(data);
  const next = nextLevel(seal);
  const toDo = seal.checks.filter((c) => c.level === next && !c.met).length;
  const company = data.vacancies.find((v) => v.status === "published")?.company;

  return (
    <EmployerPage
      width="max-w-3xl"
      intro={INTRO}
      title={
        <span className="flex items-center gap-3">
          {/* Star gold marks achievements only, like the logo's lit star: gold, outlined in the sky's white. */}
          {seal.level && <Star aria-hidden className="size-8 shrink-0 fill-star" />}
          {/* Progress, not a deficit: the line below says what is left. */}
          {seal.level ? `Neuroinclusive seal: ${SEAL_NAMES[seal.level]}` : "Your Neuroinclusive seal"}
        </span>
      }
    >
      <div className="flex flex-col gap-2">
        {seal.level && company && (
          <p>
            Constela signs your seal, so anyone can check that it is real.{" "}
            <Link href={`/seal-check?company=${encodeURIComponent(company)}`} className="inline-flex min-h-11 items-center underline underline-offset-4">
              Check it like a candidate
            </Link>
          </p>
        )}
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
    </EmployerPage>
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
