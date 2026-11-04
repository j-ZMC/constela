import { Suspense } from "react";
import type { Metadata } from "next";
import { SealCheck } from "@/components/seal-check";

export const metadata: Metadata = { title: "Check a seal · Constela" };

export default function SealCheckPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Check a seal</h1>
        <p className="text-muted-foreground">
          Constela signs every Neuroinclusive seal. Your browser checks the signature itself, with Constela&apos;s public key. A fake seal fails the check.
        </p>
      </div>
      {/* The company comes from the address, which is only known in the browser. */}
      <Suspense>
        <SealCheck />
      </Suspense>
    </main>
  );
}
