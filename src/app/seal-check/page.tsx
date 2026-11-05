import { Suspense } from "react";
import type { Metadata } from "next";
import { PageSky } from "@/components/page-sky";
import { SealCheck } from "@/components/seal-check";

export const metadata: Metadata = { title: "Check a seal · Constela" };

export default function SealCheckPage() {
  return (
    <main className="flex flex-col">
      <PageSky width="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">Check a seal</h1>
        <p className="text-pretty text-white/80">
          Constela signs every Neuroinclusive seal. Your browser checks the signature itself, with Constela&apos;s public key. A fake seal fails the check.
        </p>
      </PageSky>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
        {/* The company comes from the address, which is only known in the browser. */}
        <Suspense>
          <SealCheck />
        </Suspense>
      </div>
    </main>
  );
}
