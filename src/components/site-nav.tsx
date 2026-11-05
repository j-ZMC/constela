"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefcaseBusiness, GraduationCap, ListChecks, MessagesSquare, UserRound, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/logo";
import { useOnboarding } from "@/components/tour";
import { PersonalizationPanel } from "@/components/personalization-panel";
import { cn } from "@/lib/utils";

export type NavLink = { href: string; label: string; icon: LucideIcon };

const links: NavLink[] = [
  { href: "/plan", label: "My plan", icon: ListChecks },
  { href: "/jobs", label: "Jobs", icon: BriefcaseBusiness },
  { href: "/learn", label: "Learn", icon: GraduationCap },
  { href: "/interview", label: "Preparation", icon: MessagesSquare },
  { href: "/profile", label: "Profile", icon: UserRound },
];

export function SiteNav() {
  const pathname = usePathname();
  const setup = useOnboarding();
  // Employers have their own menu (employers/employer-nav.tsx), made of the same bars, so two menus never show together.
  if (pathname.startsWith("/employers")) return null;
  // The intro asks for one decision only, so the app menu waits until the person starts. Personalize stays.
  // During the setup only the Profile (and the page the tour is on) can be opened; the rest waits for the tour.
  const current = (href: string) => pathname.startsWith(href);
  const locked = setup ? (href: string) => href !== "/profile" && !current(href) : undefined;
  return <AppNav home="/" brand={<Logo />} links={links} current={current} locked={locked} menu={pathname !== "/"} />;
}

// The app's bars, the same on each side of Constela. homeLabel names the brand link when its text alone says too little.
// locked: links shown but not usable yet (during the setup), so the menu does not jump around when they open up.
export function AppNav({ home, brand, homeLabel, links, current, locked, menu = true }: { home: string; brand: ReactNode; homeLabel?: string; links: NavLink[]; current: (href: string) => boolean; locked?: (href: string) => boolean; menu?: boolean }) {
  // At the largest text the phone tab bar takes two rows, so the page keeps as much room below as the bar really takes
  // (--tab-bar, read in layout.tsx). Hidden while typing, it takes none.
  const tabBar = useRef<HTMLElement>(null);
  useEffect(() => {
    const bar = tabBar.current;
    if (!bar) return;
    const room = new ResizeObserver(() => document.body.style.setProperty("--tab-bar", `${bar.offsetHeight}px`));
    room.observe(bar);
    return () => {
      room.disconnect();
      document.body.style.removeProperty("--tab-bar");
    };
  }, [menu]);

  // side: the wide-screen bar on the left, one link per row; otherwise the phone tab bar, icon over label.
  const items = (side: boolean) =>
    links.map(({ href, label, icon: Icon }) => {
      const active = current(href);
      const look = cn(
        "press flex min-h-11 items-center rounded-lg text-sm leading-tight outline-none focus-visible:ring-2 focus-visible:ring-star",
        side ? "w-full gap-3 px-3 py-2.5 text-base" : "flex-1 flex-col justify-center gap-1 px-1 py-2 text-center",
      );
      if (locked?.(href)) {
        return (
          <span key={href} aria-disabled="true" title="Finish the setup first" className={cn(look, "cursor-not-allowed text-white/40")}>
            <Icon className="size-5 shrink-0" aria-hidden data-pz-icon />
            <span data-pz-label>{label}</span>
            <span className="sr-only">, after the setup</span>
          </span>
        );
      }
      return (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          className={cn(look, active ? "bg-white/15 font-semibold text-white" : "text-white/80 hover:bg-white/10 hover:text-white")}
        >
          <Icon className="size-5 shrink-0" aria-hidden data-pz-icon />
          <span data-pz-label>{label}</span>
        </Link>
      );
    });

  return (
    <>
      {/* The bars are the dark sky color (--sky, always dark enough for white text, in every palette), so they never
          blend with the page. On wide screens the app menu is the bar on the left, so this top bar shows only on the
          intro and on phones. */}
      <header className={cn("sticky top-0 z-10 border-b border-white/10 bg-sky text-white", menu && "lg:hidden")}>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <Link href={home} aria-label={homeLabel} className="flex min-h-11 items-center text-lg">
            {brand}
          </Link>
          <PersonalizationPanel onSky />
        </div>
      </header>
      {menu && (
        <>
          {/* Wide screens: one bar down the left side; layout.tsx moves the page over by its width (data-side-nav). */}
          <aside
            data-side-nav
            className="fixed inset-y-0 left-0 z-10 hidden w-56 flex-col gap-6 border-r border-white/10 bg-sky px-3 py-4 text-white lg:flex"
          >
            <Link href={home} aria-label={homeLabel} className="flex min-h-11 items-center px-3 text-lg">
              {brand}
            </Link>
            <nav aria-label="Main" className="flex flex-col gap-1">
              {items(true)}
            </nav>
            <div className="mt-auto px-1">
              <PersonalizationPanel onSky />
            </div>
          </aside>
          {/* Phones and tablets: the nav sits at the bottom, within thumb reach. globals.css hides it while the keyboard
              is open (data-mobile-nav), so it never covers the field. It wraps, so the largest text still shows every
              link on the screen. */}
          <nav
            ref={tabBar}
            aria-label="Main"
            data-mobile-nav
            className="fixed inset-x-0 bottom-0 z-10 flex flex-wrap border-t border-white/10 bg-sky px-2 pb-[env(safe-area-inset-bottom)] text-white lg:hidden"
          >
            {items(false)}
          </nav>
        </>
      )}
    </>
  );
}
