// Constela for Employers: the server's copy of what is published. Server only.
// shortcut: one JSON file on one server holds one employer, enough for a demo; move to a database with accounts before any real employer uses the public API.
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { EMPTY_SNAPSHOT, publicSnapshotSchema, type PublicSnapshot } from "@/lib/public-employer";

const folder = () => join(process.cwd(), ".data");
const file = () => join(folder(), "public-employer.json");
const BUSY = ["EPERM", "EBUSY", "EACCES"];

// No file yet, or one edited by hand: the public API shows nothing rather than failing or trusting it.
export async function readSnapshot(): Promise<PublicSnapshot> {
  try {
    return publicSnapshotSchema.parse(JSON.parse(await readFile(file(), "utf8")));
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

// Windows refuses to replace a file while a reader has it open, which lasts milliseconds, so it tries again for about a second.
async function replace(from: string, to: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await rename(from, to);
    } catch (error) {
      if (attempt >= 40 || !BUSY.includes((error as NodeJS.ErrnoException).code ?? "")) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
}

export async function writeSnapshot(snapshot: PublicSnapshot): Promise<void> {
  await mkdir(folder(), { recursive: true });
  const temporary = `${file()}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(snapshot));
  try {
    await replace(temporary, file()); // so a reader never finds half a file
  } finally {
    await rm(temporary, { force: true });
  }
}

export const clearSnapshot = () => rm(file(), { force: true });
