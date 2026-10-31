import type { Metadata } from "next";
import { TalentSearch } from "@/components/employers/talent-search";

export const metadata: Metadata = { title: "Talent" };

export default function TalentPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Find talent</h1>
        <p className="text-muted-foreground">
          People are ranked only by the essential skills your vacancy needs. What a person needs at work never changes the order.
        </p>
        <p className="text-muted-foreground">Names stay hidden until a person says yes.</p>
        <p className="text-sm text-muted-foreground">This is a demo pool: the people are fictional, and verified skills come from a demo check.</p>
      </div>
      <TalentSearch />
    </main>
  );
}
