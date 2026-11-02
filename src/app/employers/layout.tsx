import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import { EmployerNav } from "@/components/employers/employer-nav";

const notoSans = Noto_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Constela for Employers", template: "%s · Constela for Employers" },
  description: "Write clear job posts, find people by their skills, and run a hiring process with no surprises",
};

export default function EmployersLayout({ children }: LayoutProps<"/employers">) {
  return (
    <>
      {/* On <html>, because dialogs open outside this layout. Loaded here, so candidates never download this font. */}
      <style href="employers-font" precedence="default">{`html[data-area="employers"]{--font-sans:${notoSans.style.fontFamily}}`}</style>
      <div className="flex flex-1 flex-col lg:flex-row">
        <EmployerNav />
        {/* A long word wraps here at the largest text, even one the employer typed. */}
        <main className="w-full max-w-[60rem] min-w-0 flex-1 px-4 py-6 [overflow-wrap:anywhere] lg:px-8 lg:py-8">{children}</main>
      </div>
    </>
  );
}
