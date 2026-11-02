"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, FileText, Star, UsersRound } from "lucide-react";
import { action, outlined, pageTitle, panel } from "@/components/employers/vacancy-fields";
import { Button, buttonVariants } from "@/components/ui/button";
import { homeSummary } from "@/lib/employer-home";
import { saveVacancy, useEmployerData, useSeal } from "@/lib/employer-store";
import { useHydrated } from "@/lib/use-hydrated";
import { DEMO_VACANCY } from "@/lib/vacancy";

// Everything here comes from localStorage, so render only after hydration (same as the Profile flow).
export function EmployerHome() {
  return useHydrated() ? <Home /> : null;
}

function Home() {
  const data = useEmployerData();
  const seal = useSeal(data);
  const { next, jobs, people, seal: sealLines } = homeSummary(data, seal, new Date());

  return (
    <div className="flex flex-col gap-6">
      <h1 className={pageTitle}>Home</h1>

      <section aria-labelledby="next-heading" className="flex flex-wrap items-center justify-between gap-4 rounded-lg border-2 border-primary bg-secondary p-5">
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

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(13rem,100%),1fr))] gap-5">
        <Box icon={<FileText aria-hidden className="size-6 shrink-0" />} title="Jobs" lines={jobs} href="/employers/vacancies" label="Open jobs" />
        <Box icon={<UsersRound aria-hidden className="size-6 shrink-0" />} title="People" lines={people} href="/employers/talent" label="Open people" />
        <Box icon={<Star aria-hidden className="size-6 shrink-0" />} title="Seal" lines={sealLines} href="/employers/seal" label="See what to do" />
      </div>

      <Link href="/" className="flex min-h-11 w-fit items-center underline underline-offset-4">
        Looking for a job? Go to Constela
      </Link>
    </div>
  );
}

function Box({ icon, title, lines, href, label }: { icon: ReactNode; title: string; lines: string[]; href: string; label: string }) {
  return (
    <section className={panel}>
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        {icon}
        {title}
      </h2>
      <div className="flex flex-col gap-1">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      <Link href={href} className={buttonVariants({ variant: "outline", className: `${outlined} mt-auto` })}>
        {label}
      </Link>
    </section>
  );
}
