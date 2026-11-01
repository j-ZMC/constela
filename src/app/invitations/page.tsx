import type { Metadata } from "next";
import { InvitationList } from "@/components/employers/invitation-list";

export const metadata: Metadata = { title: "Invitations · Constela" };

export default function InvitationsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Your invitations</h1>
        <p className="text-muted-foreground">You decide. Your name stays hidden unless you say yes, and you can change your answer.</p>
      </div>
      <InvitationList />
    </main>
  );
}
