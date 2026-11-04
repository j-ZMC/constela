// Constela for Employers: checks a signed seal and the history behind it. It runs the same in a browser and in Node, on
// WebCrypto, so a candidate's own browser can check a seal without taking this server's word for it.
// Tokens are compact JWS signed with Ed25519 (RFC 7515, RFC 8037), so any JOSE library can check them too.
import type { SealLevel } from "@/lib/seal";

export type SealJwk = { kty: "OKP"; crv: "Ed25519"; x: string; kid: string };
export type SealClaims = { iss: "constela"; sub: string; level: SealLevel | null; vacancyIds: string[]; iat: number; exp: number; log: { size: number; head: string } };
export type LogEntry = { seq: number; at: string; company: string; level: SealLevel | null; prev: string; hash: string };

export const ISSUER = "constela";
export const GENESIS = "0".repeat(64); // what the first entry of the history points back to

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const fromBase64url = (text: string) => Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
const toBase64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// What an entry's hash covers, in a fixed order. Each entry also covers the hash before it, so changing or taking out any
// entry breaks every one after it.
export const entryText = (e: Omit<LogEntry, "hash">) => JSON.stringify([e.seq, e.at, e.company, e.level, e.prev]);

export async function verifyChain(entries: LogEntry[]): Promise<{ ok: true } | { ok: false; at: number }> {
  let prev = GENESIS;
  for (const [at, e] of entries.entries()) {
    if (e.seq !== at || e.prev !== prev || (await sha256(entryText(e))) !== e.hash) return { ok: false, at };
    prev = e.hash;
  }
  return { ok: true };
}

// A head is a size and the hash of the last entry at that size. A history that still holds it was only added to since;
// one where it is gone had entries changed or taken out.
export type Head = { size: number; head: string };
export const holdsHead = (entries: LogEntry[], { size, head }: Head) => (size === 0 ? head === GENESIS : entries[size - 1]?.hash === head);
export const headOf = (entries: LogEntry[]): Head => ({ size: entries.length, head: entries.at(-1)?.hash ?? GENESIS });

// The history records only changes, so a company's latest entry is when its current level began.
export const latestFor = (entries: LogEntry[], company: string) => entries.findLast((e) => e.company.toLowerCase() === company.trim().toLowerCase());

export type Refusal = "format" | "algorithm" | "key" | "signature" | "issuer" | "expired";
export type Checked<T> = { ok: true; value: T } | { ok: false; why: Refusal };

// Only EdDSA passes, whatever the token says about itself, so "alg": "none" or a swapped algorithm never does.
export async function verifyToken(token: string, jwk: Pick<SealJwk, "x" | "kid">): Promise<Checked<string>> {
  const parts = token.trim().split(".");
  if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]*$/.test(part))) return { ok: false, why: "format" };
  const [header, payload, signature] = parts;
  let alg: unknown;
  let kid: unknown;
  try {
    ({ alg, kid } = JSON.parse(decoder.decode(fromBase64url(header))));
  } catch {
    return { ok: false, why: "format" };
  }
  if (alg !== "EdDSA") return { ok: false, why: "algorithm" };
  if (kid !== undefined && kid !== jwk.kid) return { ok: false, why: "key" };
  const key = await crypto.subtle.importKey("jwk", { kty: "OKP", crv: "Ed25519", x: jwk.x }, { name: "Ed25519" }, false, ["verify"]);
  const valid = await crypto.subtle.verify({ name: "Ed25519" }, key, fromBase64url(signature), encoder.encode(`${header}.${payload}`));
  return valid ? { ok: true, value: decoder.decode(fromBase64url(payload)) } : { ok: false, why: "signature" };
}

export async function verifySeal(token: string, jwk: SealJwk, now: Date): Promise<Checked<SealClaims>> {
  const checked = await verifyToken(token, jwk);
  if (!checked.ok) return checked;
  let claims: SealClaims;
  try {
    claims = JSON.parse(checked.value);
  } catch {
    return { ok: false, why: "format" };
  }
  if (claims.iss !== ISSUER) return { ok: false, why: "issuer" };
  if (claims.exp * 1000 < now.getTime()) return { ok: false, why: "expired" };
  return { ok: true, value: claims };
}

// What a forger would try: the same token with a claim changed and the old signature kept. The check page shows it failing.
export function forge(token: string, change: Partial<SealClaims>): string {
  const [header, payload, signature] = token.split(".");
  const claims = JSON.parse(decoder.decode(fromBase64url(payload)));
  return `${header}.${toBase64url(encoder.encode(JSON.stringify({ ...claims, ...change })))}.${signature}`;
}
