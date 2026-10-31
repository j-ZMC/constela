import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Constela for Employers", template: "%s · Constela for Employers" },
  description: "Write clear vacancies, find people by their skills, and run a hiring process with no surprises",
};

// The employer menu lives in SiteNav, which swaps on this path, so the two menus can never show together.
export default function EmployersLayout({ children }: LayoutProps<"/employers">) {
  return children;
}
