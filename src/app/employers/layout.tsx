import type { Metadata } from "next";
import { EmployerNav } from "@/components/employers/employer-nav";

export const metadata: Metadata = {
  title: { default: "Constela for Employers", template: "%s · Constela for Employers" },
  description: "Write clear job posts, find people by their skills, and run a hiring process with no surprises",
};

export default function EmployersLayout({ children }: LayoutProps<"/employers">) {
  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <EmployerNav />
      {/* A long word wraps here at the largest text, even one the employer typed. */}
      <main className="mx-auto w-full max-w-[60rem] min-w-0 flex-1 px-4 py-8 [overflow-wrap:anywhere] lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}
