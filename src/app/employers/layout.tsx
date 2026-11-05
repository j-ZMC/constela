import type { Metadata } from "next";
import { EmployerNav } from "@/components/employers/employer-nav";

export const metadata: Metadata = {
  title: { default: "Constela for Employers", template: "%s · Constela for Employers" },
  description: "Write clear job posts, find people by their skills, and run a hiring process with no surprises",
};

// The same shell as every Constela page: the menu bars, then a page that opens with its sky (EmployerPage).
export default function EmployersLayout({ children }: LayoutProps<"/employers">) {
  return (
    <>
      <EmployerNav />
      {/* A long word wraps here at the largest text, even one the employer typed. */}
      <main className="flex flex-col [overflow-wrap:anywhere]">{children}</main>
    </>
  );
}
