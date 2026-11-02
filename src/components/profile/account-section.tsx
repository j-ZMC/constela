"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loadLocalAccount, saveLocalAccount } from "@/lib/local-profile";

// Optional details kept on this device. Not a real account: there is no password and nothing on a server.
export function AccountSection() {
  const saved = loadLocalAccount();
  const [name, setName] = useState(saved?.name ?? "");
  const [email, setEmail] = useState(saved?.email ?? "");
  const [status, setStatus] = useState("");

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveLocalAccount({ name: name.trim(), email: email.trim() });
    setStatus("Saved on this device.");
  }

  return (
    <section data-tour="profile-details" aria-labelledby="details-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 id="details-heading" className="text-xl font-semibold">
          Your details
        </h2>
        <p className="text-muted-foreground">Optional. They stay on this device. You do not need an account or a password.</p>
      </div>
      <form onSubmit={save} className="flex flex-col gap-4 rounded-xl border bg-card p-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="details-name" className="text-base">
            Name
          </Label>
          <Input id="details-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 text-base md:text-base" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="details-email" className="text-base">
            Email
          </Label>
          <Input
            id="details-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 text-base md:text-base"
          />
        </div>
        <Button type="submit" size="touch" className="w-fit">
          Save details
        </Button>
        <p role="status" className="text-sm text-muted-foreground">
          {status}
        </p>
      </form>
    </section>
  );
}
