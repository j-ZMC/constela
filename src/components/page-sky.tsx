import type { ReactNode } from "react";
import { NightSky } from "@/components/night-sky";
import { cn } from "@/lib/utils";

// The top of every app page: the intro's night sky, still, edge to edge, with the page title in it.
// The sky stays navy in every palette (--sky), so its text is white and its accents are star gold.
export function PageSky({ width = "max-w-xl", className, children }: { width?: string; className?: string; children: ReactNode }) {
  return (
    <div className="relative isolate overflow-hidden bg-sky text-white">
      <NightSky still className="absolute inset-0 -z-10 h-full w-full opacity-40" />
      <div className={cn("mx-auto flex w-full flex-col gap-2 px-4 pt-8 pb-10 sm:pt-10", width, className)}>{children}</div>
    </div>
  );
}

// Buttons and links that sit on the sky: white, a soft white hover, and the star-gold focus ring that shows on navy.
export const onSky = "text-white hover:bg-white/10 hover:text-white focus-visible:ring-star";
