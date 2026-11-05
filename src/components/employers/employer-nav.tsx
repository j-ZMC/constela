"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { BookOpen, FileText, House, Star, UsersRound } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { AppNav, type NavLink } from "@/components/site-nav";
import { syncPublicData, useEmployerData } from "@/lib/employer-store";

const LINKS: NavLink[] = [
  { href: "/employers", label: "Home", icon: House },
  { href: "/employers/vacancies", label: "Jobs", icon: FileText },
  { href: "/employers/talent", label: "People", icon: UsersRound },
  { href: "/employers/seal", label: "Seal", icon: Star },
  { href: "/employers/guide", label: "Guide", icon: BookOpen },
];

// Home is the section's root, so every employer page starts with its href: Home is current on itself only.
const isActive = (href: string, pathname: string) => (href === "/employers" ? pathname === href : pathname.startsWith(href));

// The same bars as the rest of Constela (AppNav in site-nav.tsx), with the employer pages in them.
export function EmployerNav() {
  const pathname = usePathname();
  const data = useEmployerData();

  // Here because this menu is on every employer page, so any change that reaches the store goes out.
  useEffect(() => syncPublicData(data), [data]);

  return (
    <AppNav
      home="/employers"
      brand={<EmployerBrand />}
      homeLabel="Constela for Employers"
      links={LINKS}
      current={(href) => isActive(href, pathname)}
    />
  );
}

// The Constela logo, with the side of the app under its name.
function EmployerBrand() {
  return (
    <span className="flex items-center gap-2 font-bold">
      <LogoMark className="size-7 shrink-0" />
      <span className="flex flex-col leading-tight">
        <span>Constela</span>
        <span className="text-sm font-medium text-white/80">for Employers</span>
      </span>
    </span>
  );
}
