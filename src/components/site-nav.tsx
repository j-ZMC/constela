"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefcaseBusiness, ListChecks, MessagesSquare, UserRound } from "lucide-react";
import { Logo } from "@/components/logo";
import { PersonalizationPanel } from "@/components/personalization-panel";
import { cn } from "@/lib/utils";

const links = [
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/plan", label: "My plan", icon: ListChecks },
  { href: "/jobs", label: "Jobs", icon: BriefcaseBusiness },
  { href: "/interview", label: "Interview", icon: MessagesSquare },
];

export function SiteNav() {
  const pathname = usePathname();
  // The intro asks for one decision only, so the app menu waits until the person starts. Personalize stays.
  const intro = pathname === "/";

  const items = links.map(({ href, label, icon: Icon }) => {
    const active = pathname.startsWith(href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex flex-1 flex-col items-center gap-1 whitespace-nowrap rounded-lg px-1 py-2 text-xs lg:flex-none lg:flex-row lg:gap-2 lg:px-3 lg:text-sm",
          active ? "bg-secondary font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Icon className="size-5" aria-hidden data-pz-icon />
        <span data-pz-label>{label}</span>
      </Link>
    );
  });

  return (
    <>
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="text-lg">
            <Logo />
          </Link>
          {!intro && (
            <nav aria-label="Main" className="hidden gap-1 lg:flex">
              {items}
            </nav>
          )}
          <PersonalizationPanel />
        </div>
      </header>
      {/* On phones and tablets the nav sits at the bottom, within thumb reach; lg leaves room for large text */}
      {!intro && (
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-10 flex border-t bg-background px-2 pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          {items}
        </nav>
      )}
    </>
  );
}
