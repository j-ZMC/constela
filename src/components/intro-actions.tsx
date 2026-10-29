"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { loadProfile } from "@/lib/profile";
import { useHydrated } from "@/lib/use-hydrated";

const action = "h-11 px-5 text-base";

// Starting never needs an account. Accounts come later (Supabase); until then the buttons say so plainly.
export function IntroActions() {
  const hasProfile = useHydrated() && loadProfile() !== null;
  const [note, setNote] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <Link href={hasProfile ? "/plan" : "/profile"} className={buttonVariants({ className: `${action} w-full sm:w-fit` })}>
        {hasProfile ? "Go to my plan" : "Try without an account"}
      </Link>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" className={action} onClick={() => setNote(true)}>
          Create account
        </Button>
        <Button variant="ghost" className={action} onClick={() => setNote(true)}>
          Sign in
        </Button>
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        {note && "Accounts are coming soon. You can start now: your progress stays on this device."}
      </p>
    </div>
  );
}
