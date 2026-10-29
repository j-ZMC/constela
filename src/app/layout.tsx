import type { Metadata } from "next";
import { Atkinson_Hyperlegible_Next, Geist_Mono } from "next/font/google";
import "@fontsource/opendyslexic/400.css";
import "@fontsource/opendyslexic/700.css";
import "./globals.css";
import { MarginSky } from "@/components/night-sky";
import { SiteNav } from "@/components/site-nav";

// Designed by the Braille Institute for maximum legibility.
const atkinson = Atkinson_Hyperlegible_Next({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Constela · by Astralis",
  description: "A step-by-step job search for neurodivergent people",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${atkinson.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies saved reading and personalization settings before first paint (see personalization-panel.tsx).
            Storage can be edited by hand, so only CSS variables and data-pz* attributes are accepted. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=JSON.parse(localStorage.getItem("a11y")||"{}");for(var k in p)if(p[k])document.documentElement.classList.add(k)}catch(e){}try{var b=JSON.parse(localStorage.getItem("pz-boot")||"{}"),h=document.documentElement;for(var v in b.vars)if(v.indexOf("--")===0)h.style.setProperty(v,String(b.vars[v]));for(var a in b.attrs)if(a.indexOf("data-pz")===0)h.setAttribute(a,String(b.attrs[a]));if(b.focus===true)h.classList.add("focus-strong")}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <MarginSky />
        <SiteNav />
        <div className="flex flex-1 flex-col pb-24 lg:pb-0">{children}</div>
      </body>
    </html>
  );
}
