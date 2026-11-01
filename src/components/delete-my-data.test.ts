import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DELETED_KEYS } from "@/components/delete-my-data";

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.includes(".test.") ? [path] : [];
  });
}

describe("Delete my data", () => {
  // /privacy promises to delete everything, so a key that isn't on the list breaks a promise to the person.
  it("removes every key the app stores in this browser", () => {
    const stored = sources("src").flatMap((file) => [...readFileSync(file, "utf8").matchAll(/\b\w*KEY\s*=\s*"([a-z0-9-]+)"/g)].map((match) => match[1]));
    expect(stored.length).toBeGreaterThan(5); // the scan really found them
    expect(stored.filter((key) => !DELETED_KEYS.includes(key))).toEqual([]);
  });
});
