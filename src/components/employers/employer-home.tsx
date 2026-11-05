"use client";

import Link from "next/link";
import { ArrowRight, ChevronRight, FileText, Star, UsersRound, type LucideIcon } from "lucide-react";
import { EmployerPage } from "@/components/employers/employer-page";
import { action, outlined } from "@/components/employers/vacancy-fields";
import { Button, buttonVariants } from "@/components/ui/button";
import { homeSummary } from "@/lib/employer-home";
import { saveVacancy, useEmployerData, useSeal } from "@/lib/employer-store";
import { Loading } from "@/components/loading";
import { useHydrated } from "@/lib/use-hydrated";
import { DEMO_VACANCY } from "@/lib/vacancy";

// The sky and title come first, like every page. What is below comes from localStorage, so it waits for hydration.
export function EmployerHome() {
  const hydrated = useHydrated();
  return (
    <EmployerPage title="Home" intro="Write clear job posts, find people by their skills, and run a hiring process with no surprises." width="max-w-3xl">
      {hydrated ? <Home /> : <Loading />}
    </EmployerPage>
  );
}

function Home() {
  const data = useEmployerData();
  const seal = useSeal(data);
  const { next, jobs, people, seal: sealLines } = homeSummary(data, seal, new Date());

  return (
    <>
      <section aria-labelledby="next-heading" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/15 bg-card p-5 shadow-[0_10px_30px_-14px_rgb(36_59_83/0.35)] sm:p-7">
        <div className="min-w-0">
          <h2 id="next-heading" className="text-xl font-semibold">
            Do this next
          </h2>
          <p>{next ? next.title : "You are up to date."}</p>
          {next?.detail && <p>{next.detail}</p>}
        </div>
        {next && (
          <div className="flex flex-wrap gap-3">
            <Link href={next.href} className={buttonVariants({ className: `${action} gap-2` })}>
              {next.action}
              <ArrowRight aria-hidden className="size-5" />
            </Link>
            {/* A way to look around, and a way to rehearse the demo if the AI is down. */}
            {data.vacancies.length === 0 && (
              <Button variant="outline" className={outlined} onClick={() => saveVacancy(DEMO_VACANCY)}>
                Load a sample job post
              </Button>
            )}
          </div>
        )}
      </section>

      {/* One quiet card with a row each, not a grid of tiles: the next step above is the only action that stands out. */}
      <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">
        <Row icon={FileText} title="Jobs" lines={jobs} href="/employers/vacancies" />
        <Row icon={UsersRound} title="People" lines={people} href="/employers/talent" />
        <Row icon={Star} title="Seal" lines={sealLines} href="/employers/seal" />
      </ul>

      <Link href="/" className="flex min-h-11 w-fit items-center underline underline-offset-4">
        Looking for a job? Go to Constela
      </Link>
    </>
  );
}

function Row({ icon: Icon, title, lines, href }: { icon: LucideIcon; title: string; lines: string[]; href: string }) {
  return (
    <li>
      <Link href={href} className="press flex min-h-11 items-center gap-4 p-5 hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none">
        <Icon aria-hidden className="size-6 shrink-0 text-primary" />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-lg font-semibold">{title}</span>
          {lines.map((line) => (
            <span key={line} className="text-muted-foreground">
              {line}
            </span>
          ))}
        </span>
        <ChevronRight aria-hidden className="size-5 shrink-0" />
      </Link>
    </li>
  );
}
