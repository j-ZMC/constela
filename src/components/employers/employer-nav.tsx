"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, FileText, House, UsersRound } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { PersonalizationPanel } from "@/components/personalization-panel";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/employers", label: "Home", icon: House },
  { href: "/employers/vacancies", label: "Jobs", icon: FileText },
  { href: "/employers/talent", label: "People", icon: UsersRound },
  { href: "/employers/guide", label: "Guide", icon: BookOpen },
];

// Home is the section's root, so every employer page starts with its href. The seal opens from Home and has no menu item.
const isActive = (href: string, pathname: string) => (href === "/employers" ? pathname === href || pathname === "/employers/seal" : pathname.startsWith(href));

// The same place on every page: a side menu on a computer. Phones and tablets get the menu at the bottom, within thumb reach.
export function EmployerNav() {
  const pathname = usePathname();

  const items = (className: string) =>
    LINKS.map(({ href, label, icon: Icon }) => {
      const active = isActive(href, pathname);
      return (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          className={cn("flex items-center whitespace-nowrap rounded-lg border-2", active ? "border-primary bg-secondary font-semibold" : "border-transparent hover:bg-secondary", className)}
        >
          <Icon className="size-6 shrink-0" aria-hidden data-pz-icon />
          <span data-pz-label>{label}</span>
        </Link>
      );
    });

  return (
    <>
      <aside className="flex flex-wrap items-center justify-between gap-3 border-b-2 bg-card px-4 py-2 lg:sticky lg:top-0 lg:h-dvh lg:w-50 lg:shrink-0 lg:flex-col lg:flex-nowrap lg:items-stretch lg:justify-start lg:gap-6 lg:overflow-y-auto lg:border-r-2 lg:border-b-0 lg:p-4">
        <Link href="/employers" className="flex min-h-11 items-center gap-2 leading-tight font-semibold">
          <LogoMark className="size-8 shrink-0" />
          <span>
            Constela <span className="hidden lg:inline">for Employers</span>
          </span>
        </Link>
        <nav aria-label="Main" className="hidden flex-col gap-2 lg:flex">
          {items("min-h-13 gap-3 px-3")}
        </nav>
        <PersonalizationPanel className="max-w-full gap-2 border-2 bg-card text-base lg:mt-auto lg:h-13 lg:w-full lg:justify-start lg:gap-3 lg:px-3" />
      </aside>
      {/* It wraps, so the largest text still shows every link. */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-10 flex flex-wrap gap-1 border-t-2 bg-card px-2 py-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] lg:hidden">
        {items("min-h-14 flex-1 flex-col justify-center px-2")}
      </nav>
    </>
  );
}
