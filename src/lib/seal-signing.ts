// Constela for Employers: signs what the public API says about a seal. Server only. The checking side is seal-proof.ts.
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { SealJwk } from "@/lib/seal-proof";

const base64url = (data: string | Buffer) => Buffer.from(data).toString("base64url");

// RFC 7638: a key's id is the hash of its required members, in this exact order, so anyone can work it out from the key.
export const thumbprint = (x: string) => base64url(createHash("sha256").update(JSON.stringify({ crv: "Ed25519", kty: "OKP", x })).digest());

export function signCompact(header: object, payload: string, key: KeyObject): string {
  const input = `${base64url(JSON.stringify(header))}.${base64url(payload)}`;
  return `${input}.${base64url(sign(null, Buffer.from(input), key))}`;
}

// SEAL_SIGNING_KEY (a PKCS#8 PEM) on a real server. Otherwise a key made on first use and kept in .data, which git ignores,
// so a local demo needs no setup.
// shortcut: a key kept on disk goes with the disk; set SEAL_SIGNING_KEY wherever tokens must stay checkable after a redeploy.
let cached: { source: string; key: KeyObject } | undefined;

export function signingKey(): KeyObject {
  const pem = process.env.SEAL_SIGNING_KEY?.replace(/\\n/g, "\n");
  const file = join(process.cwd(), ".data", "seal-signing-key.pem");
  const source = pem ?? file;
  if (cached?.source === source) return cached.key;
  let key: KeyObject;
  if (pem) key = createPrivateKey(pem);
  else {
    try {
      key = createPrivateKey(readFileSync(file, "utf8"));
    } catch {
      key = generateKeyPairSync("ed25519").privateKey;
      mkdirSync(dirname(file), { recursive: true });
      // "wx": never replace a key another process just made; read that one instead.
      try {
        writeFileSync(file, key.export({ type: "pkcs8", format: "pem" }), { mode: 0o600, flag: "wx" });
      } catch {
        key = createPrivateKey(readFileSync(file, "utf8"));
      }
    }
  }
  cached = { source, key };
  return key;
}

export function publicJwk(key = signingKey()): SealJwk {
  const { x } = createPublicKey(key).export({ format: "jwk" }) as { x: string };
  return { kty: "OKP", crv: "Ed25519", x, kid: thumbprint(x) };
}

export const signClaims = (claims: object, key = signingKey()) => signCompact({ alg: "EdDSA", kid: publicJwk(key).kid, typ: "JWT" }, JSON.stringify(claims), key);
