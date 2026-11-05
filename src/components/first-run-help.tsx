"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { keepScreenDark, loadHelpPicks } from "@/lib/help-picks";
import { applyPrefs, loadPrefs, savePrefs } from "@/lib/personalization";

// The first start of the app (or after "Delete my data") begins at the welcome on the home page, which leads through
// the Profile and then the tour. Opening My plan, Jobs, Learn or Preparation before that goes to the welcome first.
// The Profile, Privacy, invitations, the employers' side and the seal check open as they are.
const SETUP_FIRST = /^\/(plan|jobs|learn|interview|recommended)(\/|$)/;

export function FirstRunHelp() {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (SETUP_FIRST.test(pathname) && loadHelpPicks() === null) router.replace("/");
  }, [pathname, router]);
  // A light palette saved while "Bright or busy screens" was on (before it won over Settings) goes dark on every page.
  useEffect(() => {
    const saved = loadPrefs();
    const next = keepScreenDark(saved);
    if (next.colors === saved.colors) return;
    savePrefs(next);
    applyPrefs(next);
  }, []);
  return null;
}
