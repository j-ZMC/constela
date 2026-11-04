"use client";

import { Contact } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { loadLocalAccount, saveLocalAccount } from "@/lib/local-profile";

export function AccountSection() {
  const saved = loadLocalAccount();
  const [name, setName] = useState(saved?.name ?? "");
  const [email, setEmail] = useState(saved?.email ?? "");
  const [status, setStatus] = useState("");

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveLocalAccount({ name: name.trim(), email: email.trim() });
    setStatus("Details saved on this device.");
  }

  return (
    <section aria-labelledby="account-heading" className="flex max-w-xl flex-col gap-5">
      <div>
        <h2 id="account-heading" className="flex items-center gap-2 text-2xl font-semibold"><Contact aria-hidden className="size-7 shrink-0 text-primary" />Contact details</h2>
        <p className="mt-2 text-muted-foreground">Optional. These details stay on this device.</p>
      </div>
      <form onSubmit={save} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2 text-sm font-medium">
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} className="h-11 rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </label>
        <Button type="submit" className="h-11 w-fit px-5 text-base">Save details</Button>
        <p role="status" aria-live="polite" className="min-h-5 text-sm text-muted-foreground">{status}</p>
      </form>
    </section>
  );
}
