import Link from "next/link";
import { SealPanel } from "@/components/employers/seal-panel";

export default function EmployersPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold break-words">Constela for Employers</h1>
        <p className="text-muted-foreground">Write clear vacancies, find people by their skills, and run a hiring process with no surprises.</p>
      </div>
      <SealPanel />
      <Link href="/" className="flex min-h-11 w-fit items-center text-muted-foreground underline underline-offset-4 hover:text-foreground">
        Looking for a job? Go to Constela
      </Link>
    </div>
  );
}
