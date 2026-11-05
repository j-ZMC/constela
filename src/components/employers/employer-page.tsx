import type { ReactNode, RefObject } from "react";
import { PageSky } from "@/components/page-sky";
import { cn } from "@/lib/utils";

// Every employer page opens like the rest of Constela (DESIGN.md, "The page sky"): the night sky with the page's one h1
// and one line of text, then the page itself, as wide as the sky above it.
// before: above the title, such as the way back. after: under the line, such as a status that changes.
export function EmployerPage({
  title,
  intro,
  before,
  after,
  titleRef,
  width = "max-w-5xl",
  children,
}: {
  title: ReactNode;
  intro?: ReactNode;
  before?: ReactNode;
  after?: ReactNode;
  titleRef?: RefObject<HTMLHeadingElement | null>;
  width?: string;
  children: ReactNode;
}) {
  return (
    <>
      <PageSky width={width}>
        {before}
        <h1 ref={titleRef} tabIndex={titleRef ? -1 : undefined} className="text-3xl font-bold tracking-tight text-balance outline-none sm:text-4xl">
          {title}
        </h1>
        {intro && <p className="text-pretty text-white/80">{intro}</p>}
        {after}
      </PageSky>
      <div className={cn("mx-auto flex w-full flex-col gap-6 px-4 py-8", width)}>{children}</div>
    </>
  );
}
