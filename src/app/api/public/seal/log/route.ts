import { connection } from "next/server";
import { publicJson, publicOptions } from "@/app/api/public/cors";
import { readLog } from "@/lib/seal-log";
import { headOf } from "@/lib/seal-proof";

export const OPTIONS = publicOptions;

// The whole history of seals, exactly as stored, so anyone can check it. Reading it never writes.
export async function GET() {
  await connection(); // read when asked, never frozen into the build
  try {
    const entries = await readLog();
    return publicJson({ ...headOf(entries), entries });
  } catch {
    return publicJson({ error: "failed" }, 500);
  }
}
