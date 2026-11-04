import { connection } from "next/server";
import { publicJson, publicOptions } from "@/app/api/public/cors";
import { publicJwk } from "@/lib/seal-signing";

export const OPTIONS = publicOptions;

// The public key that checks seal tokens, as a standard JWK Set. Its kid is the RFC 7638 thumbprint, so a tool can pin it.
export async function GET() {
  await connection(); // the key is read when asked, never frozen into the build
  try {
    return publicJson({ keys: [{ ...publicJwk(), alg: "EdDSA", use: "sig" }] });
  } catch {
    return publicJson({ error: "failed" }, 500);
  }
}
