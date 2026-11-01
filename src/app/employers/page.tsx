import Link from "next/link";
import { SealPanel } from "@/components/employers/seal-panel";

export default function EmployersPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold break-words">Constela for Employers</h1>
        <p className="text-muted-foreground">Write clear vacancies, find people by their skills, and run a hiring process with no surprises.</p>
      </div>
      <SealPanel />
      <Link href="/" className="flex min-h-11 w-fit items-center text-muted-foreground underline underline-offset-4 hover:text-foreground">
        Looking for a job? Go to Constela
      </Link>
    </main>
  );
}
