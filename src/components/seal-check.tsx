"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { BadgeCheck, CircleAlert, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SEAL_NAMES, type SealLevel } from "@/lib/seal";
import { forge, headOf, holdsHead, latestFor, verifyChain, verifySeal, type Head, type LogEntry, type Refusal, type SealClaims, type SealJwk } from "@/lib/seal-proof";
import { useHydrated } from "@/lib/use-hydrated";

// 44px at least, and taller when the text is: at the largest settings a long label wraps instead of leaving the screen.
const action = "h-auto min-h-11 max-w-full shrink whitespace-normal px-5 py-2 text-base";
const field = "h-12 border-2 bg-card text-base font-normal md:text-base";
const SEEN_KEY = "seal-history";

type Line = { ok: boolean; text: string };
type Report = { title: string; lines: Line[]; level?: SealLevel | null; token?: string; jwk: SealJwk };
type Ask = { company?: string; token?: string; pressed: boolean };
type Done = { ask: Ask; report: Report | null };

const when = (time: string | number) => new Date(time).toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const sealWords = (level: SealLevel | null) => (level ? `the ${SEAL_NAMES[level]} seal` : "no seal");

const REFUSED: Record<Refusal, string> = {
  format: "This is not a seal token. Copy the whole token and try again.",
  algorithm: "Not signed by Constela. It uses another kind of signature.",
  key: "Not signed by Constela. It was signed with another key.",
  signature: "Not signed by Constela. It was changed after it was signed, or someone else made it.",
  issuer: "Signed with Constela's key, but it doesn't say it comes from Constela.",
  expired: "Signed by Constela, but this signature is out of date. Check again for a fresh one.",
};

async function get(path: string) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

// The history this browser saw last time, so a history rewritten since can't pass unnoticed.
function loadSeen(): Head | null {
  try {
    const seen = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "null");
    return typeof seen?.size === "number" && typeof seen?.head === "string" ? seen : null;
  } catch {
    return null;
  }
}

function saveSeen(head: Head) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(head));
  } catch {
    // Storage blocked: the check still works, it just can't compare with the last visit.
  }
}

// Every line is worked out here, in the browser, from the public key and the public history.
async function check(ask: Ask, now: Date): Promise<{ report: Report; remember?: Head }> {
  const [answer, keys] = await Promise.all([ask.company ? get(`/api/public/seal?company=${encodeURIComponent(ask.company)}`) : null, get("/api/public/seal/keys")]);
  // After the answer, never beside it: asking can add an entry, and the token points to it.
  const log = await get("/api/public/seal/log").catch(() => null);
  const jwk: SealJwk = keys.keys[0];
  const token: string | null = ask.token?.trim() || answer?.token || null;
  const entries: LogEntry[] | null = log?.entries ?? null;
  const lines: Line[] = [];
  let claims: SealClaims | undefined;
  let remember: Head | undefined;

  if (token) {
    const signed = await verifySeal(token, jwk, now);
    if (signed.ok) {
      claims = signed.value;
      lines.push({ ok: true, text: "Signed by Constela. Your browser checked the signature itself, with Constela's public key." });
      lines.push({ ok: true, text: `It says ${claims.sub} has ${sealWords(claims.level)}. Signed ${when(claims.iat * 1000)}, good until ${when(claims.exp * 1000)}.` });
    } else lines.push({ ok: false, text: REFUSED[signed.why] });
  } else if (answer && answer.vacancyIds.length > 0) {
    lines.push({ ok: false, text: "Constela can't sign this seal right now. Try again later." });
  } else if (answer) {
    const last = entries && latestFor(entries, answer.company);
    lines.push({ ok: true, text: last ? `${last.company} has no job posts on Constela now. Its seal ended ${when(last.at)}.` : `Constela has no seal on record for ${answer.company}.` });
  }

  if (!entries) lines.push({ ok: false, text: "The public history of seals can't be read right now." });
  else {
    const chain = await verifyChain(entries);
    const n = entries.length;
    if (!chain.ok) lines.push({ ok: false, text: `The public history of seals was changed at entry ${chain.at + 1}. From there on, its links don't match.` });
    else {
      lines.push({ ok: true, text: `The public history of seals has ${n} ${n === 1 ? "entry" : "entries"}, and none was changed.` });
      const seen = loadSeen();
      if (!seen) lines.push({ ok: true, text: "This browser now remembers the history, and will tell you if anything in it changes." });
      else if (!holdsHead(entries, seen)) lines.push({ ok: false, text: "Since you last checked on this browser, something in the history was rewritten." });
      else lines.push({ ok: true, text: seen.size === n ? "Since you last checked, nothing in it changed." : `Since you last checked, it only grew, by ${n - seen.size}.` });
      if (!seen || holdsHead(entries, seen)) remember = headOf(entries);

      if (claims && claims.log.size > 0) {
        lines.push(
          holdsHead(entries, claims.log)
            ? { ok: true, text: `The signature points to entry ${claims.log.size} of that history, and it is still there.` }
            : { ok: false, text: "The signature points to a history that is not there anymore. Entries were changed or taken out." },
        );
      }
      const last = claims && latestFor(entries, claims.sub);
      if (claims && last) {
        lines.push(
          last.level === claims.level
            ? { ok: true, text: `${last.company} has had ${sealWords(last.level)} since ${when(last.at)}.` }
            : { ok: false, text: `The history shows a newer change: ${last.company} has had ${sealWords(last.level)} since ${when(last.at)}.` },
        );
      }
    }
  }

  const title = claims?.sub ?? answer?.company ?? "This token";
  return { report: { title, lines, level: claims ? claims.level : undefined, token: claims ? token! : undefined, jwk }, remember };
}

export function SealCheck() {
  return useHydrated() ? <Checker /> : null;
}

function Checker() {
  const fromUrl = useSearchParams().get("company")?.trim() ?? "";
  const [company, setCompany] = useState(fromUrl);
  const [ask, setAsk] = useState<Ask | null>(fromUrl ? { company: fromUrl, pressed: false } : null);
  const [done, setDone] = useState<Done | null>(null);
  // Next keeps a visited page alive, so a link to another company can arrive at this one already open: follow the address.
  const [followed, setFollowed] = useState(fromUrl);
  if (fromUrl !== followed) {
    setFollowed(fromUrl);
    setCompany(fromUrl);
    setAsk(fromUrl ? { company: fromUrl, pressed: false } : null);
  }
  const [pasted, setPasted] = useState("");
  const place = useRef<HTMLDivElement>(null);
  const busy = ask !== null && done?.ask !== ask;

  useEffect(() => {
    if (!ask) return;
    let live = true;
    check(ask, new Date())
      .catch(() => null)
      .then((result) => {
        if (!live) return;
        if (result?.remember) saveSeen(result.remember);
        setDone({ ask, report: result?.report ?? null });
      });
    return () => {
      live = false;
    };
  }, [ask]);

  // After a press the result replaces what was there, so focus moves to it. Opening the page doesn't move focus.
  useEffect(() => {
    if (done?.ask.pressed) place.current?.focus();
  }, [done]);

  function checkCompany(e: FormEvent) {
    e.preventDefault();
    const name = company.trim();
    if (!name) return;
    setFollowed(name); // the address change below is this search, not a new one
    window.history.replaceState(null, "", `?company=${encodeURIComponent(name)}`);
    setAsk({ company: name, pressed: true });
  }

  function checkToken(e: FormEvent) {
    e.preventDefault();
    if (pasted.trim()) setAsk({ token: pasted, pressed: true });
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={checkCompany} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 font-medium">
          Company
          <Input value={company} maxLength={80} autoComplete="organization" onChange={(e) => setCompany(e.target.value)} className={field} />
        </label>
        <Button type="submit" className={`${action} w-fit`}>
          Check the seal
        </Button>
      </form>

      <div ref={place} tabIndex={-1} aria-live="polite" className="outline-none">
        {busy && <p>Checking the seal.</p>}
        {!busy && done && (done.report ? <ReportView report={done.report} /> : <p>Constela could not be reached. Try again.</p>)}
      </div>

      <details className="rounded-xl border bg-card p-4">
        <summary className="flex min-h-11 cursor-pointer items-center font-medium">Check a seal token from somewhere else</summary>
        <form onSubmit={checkToken} className="mt-2 flex flex-col gap-3">
          <label className="flex flex-col gap-1 font-medium">
            Seal token
            <Textarea value={pasted} rows={4} spellCheck={false} onChange={(e) => setPasted(e.target.value)} className="min-h-12 border-2 bg-card font-mono text-sm break-all md:text-sm" />
          </label>
          <Button type="submit" variant="outline" className={`${action} w-fit`}>
            Check this token
          </Button>
        </form>
      </details>

      <details className="rounded-xl border bg-card p-4">
        <summary className="flex min-h-11 cursor-pointer items-center font-medium">For developers</summary>
        <ul className="mt-2 flex list-disc flex-col gap-2 pl-6 text-sm leading-relaxed">
          <li>
            <code>GET /api/public/seal?company=…</code> answers with a <code>token</code>: a JWS signed with Ed25519 (EdDSA, RFC 8037). It is good for an hour at most, and never past the next date that could drop the seal.
          </li>
          <li>
            The public key is at{" "}
            <a href="/api/public/seal/keys" className="inline-flex min-h-11 max-w-full items-center break-all underline underline-offset-4">
              /api/public/seal/keys
            </a>
            . Its id is its RFC 7638 thumbprint{done?.report ? <>: <code className="break-all">{done.report.jwk.kid}</code></> : ""}.
          </li>
          <li>
            The history is at{" "}
            <a href="/api/public/seal/log" className="inline-flex min-h-11 max-w-full items-center break-all underline underline-offset-4">
              /api/public/seal/log
            </a>
            . Each entry holds the SHA-256 hash of the one before, and each token signs the size and last hash it saw.
          </li>
        </ul>
      </details>
    </div>
  );
}

function ReportView({ report }: { report: Report }) {
  const [fake, setFake] = useState<{ token: string; text: string } | null>(null);
  const failed = report.lines.some((line) => !line.ok);
  const other: SealLevel = report.level === "gold" ? "silver" : "gold";

  async function tryFake() {
    if (!report.token) return;
    const result = await verifySeal(forge(report.token, { level: other }), report.jwk, new Date());
    const verdict = result.ok ? "Signed by Constela." : REFUSED[result.why];
    setFake({ token: report.token, text: `We wrote ${sealWords(other)} into this token and kept Constela's signature. Your browser says: ${verdict}` });
  }

  return (
    <section aria-labelledby="seal-report" className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h2 id="seal-report" className="text-xl font-semibold">
          {report.title}
        </h2>
        {report.level && (
          <p className="inline-flex items-center gap-2 font-semibold text-primary">
            <BadgeCheck aria-hidden className="size-5 shrink-0" />
            Neuroinclusive seal: {SEAL_NAMES[report.level]}
          </p>
        )}
        <p className="font-medium">{failed ? "Something doesn't check out. Read the lines below." : "Everything checks out."}</p>
      </div>
      <ul className="flex flex-col gap-3">
        {report.lines.map((line) => (
          <li key={line.text} className="flex gap-2 leading-relaxed">
            {line.ok ? <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" /> : <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />}
            <span>{line.text}</span>
          </li>
        ))}
      </ul>
      {report.token && (
        <div className="flex flex-col gap-2 border-t-2 pt-3">
          <p>See what happens to a fake: change the level in this seal and keep its signature.</p>
          <Button variant="outline" className={`${action} w-fit`} onClick={tryFake}>
            Try a fake seal
          </Button>
          {fake?.token === report.token && <p role="status">{fake.text}</p>}
        </div>
      )}
    </section>
  );
}
