import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, DEFAULT_ROLES, PRESETS, checkContrast, cleanPrefs, compute, contrast, mix, readableOn, skyFor } from "@/lib/personalization";

describe("personalization", () => {
  it("applies nothing with the default preferences", () => {
    expect(compute(DEFAULT_PREFS)).toEqual({ vars: {}, attrs: {}, focus: false });
  });
  it("computes contrast ratios", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(readableOn("#243b53")).toBe("#ffffff");
  });
  it("mixes colors", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
  it("accepts the default palette and flags a poor one", () => {
    expect(checkContrast(DEFAULT_ROLES).every((c) => c.ok)).toBe(true);
    expect(checkContrast({ ...DEFAULT_ROLES, text: "#cccccc" }).some((c) => !c.ok)).toBe(true);
  });
  it("ships presets that all pass the contrast checks", () => {
    for (const p of PRESETS) if (p.colors) expect(checkContrast(p.colors).filter((c) => !c.ok).map((c) => `${p.name}: ${c.label}`)).toEqual([]);
  });
  it("gives every palette, even a light accent, a sky white text can sit on", () => {
    expect(skyFor(DEFAULT_ROLES)).toBe("#243b53");
    const palettes = [...PRESETS.flatMap((p) => (p.colors ? [p.colors] : [])), { ...DEFAULT_ROLES, accent: "#f2f2f2" }, { ...DEFAULT_ROLES, accent: "#ffcc00" }];
    for (const r of palettes) expect(contrast("#ffffff", skyFor(r))).toBeGreaterThanOrEqual(7);
  });
  it("keeps only well-formed saved values", () => {
    expect(cleanPrefs({ size: 999, font: "comic", colors: { background: "red" }, focus: "yes", lh: 0 })).toEqual(DEFAULT_PREFS);
    expect(cleanPrefs({ size: 120, icons: "text" })).toMatchObject({ size: 120, icons: "text" });
    expect(cleanPrefs("not an object")).toEqual(DEFAULT_PREFS);
  });
  it("only sets what was changed", () => {
    const b = compute({ ...DEFAULT_PREFS, size: 125, icons: "icons" });
    expect(b.vars).toEqual({ "--pz-size": "125" });
    expect(b.attrs).toEqual({ "data-pz": "size", "data-pz-icons": "icons" });
  });
});
