import type { Metadata } from "next";
import { InvitationList } from "@/components/employers/invitation-list";
import { PageSky } from "@/components/page-sky";

export const metadata: Metadata = { title: "Invitations · Constela" };

export default function InvitationsPage() {
  return (
    <main className="flex flex-col">
      <PageSky>
        <h1 className="text-3xl font-bold text-balance sm:text-4xl">Your invitations</h1>
        <p className="text-pretty text-white/80">You decide. Your name stays hidden unless you say yes, and you can change your answer.</p>
      </PageSky>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8">
        <InvitationList />
      </div>
    </main>
  );
}
