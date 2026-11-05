import { IntroActions } from "@/components/intro-actions";
import { NightSky } from "@/components/night-sky";

// The intro: a night sky of constellations around one card that says what Constela is and how to start. The first
// time (or after "Delete my data") it welcomes the person and starts the setup instead.
export default function Home() {
  return (
    // The intro has no bottom nav, so the sky cancels the layout's bottom padding meant for it (no mint strip).
    <main className="relative isolate -mb-24 flex flex-1 items-center justify-center overflow-hidden bg-sky px-4 py-12 lg:mb-0">
      <NightSky className="absolute inset-0 -z-10 h-full w-full" />
      <section className="flex w-full max-w-md flex-col gap-5 rounded-2xl bg-card p-6 shadow-[0_20px_60px_-20px_rgb(0_0_0/0.6)] sm:p-8">
        <IntroActions />
      </section>
    </main>
  );
}
