import Link from "next/link";
import { SectionPlaceholder } from "@/components/section-placeholder";

export default function EmployersPage() {
  return (
    <SectionPlaceholder
      title="Constela for Employers"
      what="Write clear vacancies, find people by their skills, and run a hiring process with no surprises."
      owner="Phase 7"
    >
      <Link href="/" className="flex min-h-11 w-fit items-center text-muted-foreground underline underline-offset-4 hover:text-foreground">
        Looking for a job? Go to Constela
      </Link>
    </SectionPlaceholder>
  );
}
