import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, DEFAULT_ROLES, PRESETS, checkContrast, cleanPrefs, compute, contrast, mix, readableOn, skyFor, softLight, starCheck } from "@/lib/personalization";

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
  it("keeps only well-formed saved values", () => {
    expect(cleanPrefs({ size: 999, font: "comic", colors: { background: "red" }, focus: "yes", lh: 0 })).toEqual(DEFAULT_PREFS);
    expect(cleanPrefs({ size: 120, icons: "text" })).toMatchObject({ size: 120, icons: "text" });
    expect(cleanPrefs("not an object")).toEqual(DEFAULT_PREFS);
  });
  it("dims every palette with soft light, never below the contrast minimums", () => {
    for (const p of PRESETS) {
      const base = p.colors ?? DEFAULT_ROLES;
      let previous = base.background;
      for (const level of [1, 2, 3]) {
        const dim = softLight(base, level);
        expect(checkContrast(dim).filter((c) => !c.ok).map((c) => `${p.name} ${level}: ${c.label}`)).toEqual([]);
        expect(dim.text).toBe(base.text);
        // Each level moves at least as far as the one before.
        expect(contrast(dim.background, base.background)).toBeGreaterThanOrEqual(contrast(previous, base.background) - 1e-9);
        previous = dim.background;
      }
    }
    expect(softLight(DEFAULT_ROLES, 2).background).not.toBe(DEFAULT_ROLES.background);
    const poor = { ...DEFAULT_ROLES, text: "#cccccc" };
    expect(softLight(poor, 3)).toEqual(poor);
  });
  it("keeps the sky (menu, headers) dark and darker than the page in every palette", () => {
    for (const p of PRESETS) {
      const r = p.colors ?? DEFAULT_ROLES;
      const sky = skyFor(r);
      expect(contrast("#ffffff", sky), p.name).toBeGreaterThanOrEqual(7);
      expect(contrast(sky, "#000000"), p.name).toBeLessThan(contrast(r.background, "#000000"));
    }
    expect(skyFor(DEFAULT_ROLES)).toBe(DEFAULT_ROLES.accent);
  });
  it("designs every palette with its own sky and stars that stand out on it", () => {
    for (const p of PRESETS) {
      const r = p.colors ?? DEFAULT_ROLES;
      expect(contrast(r.star, skyFor(r)), p.name).toBeGreaterThanOrEqual(4.5);
      expect(starCheck(r).ok, p.name).toBe(true);
    }
    // Light is its own palette, not the default with a white page.
    const light = PRESETS.find((p) => p.id === "light")!.colors!;
    expect(skyFor(light)).not.toBe(skyFor(DEFAULT_ROLES));
    expect(light.star).not.toBe(DEFAULT_ROLES.star);
    // The Stars cell sets --star.
    expect(compute({ ...DEFAULT_PREFS, colors: { ...DEFAULT_ROLES, star: "#ffd166" } }).vars["--star"]).toBe("#ffd166");
  });
  it("loads palettes saved before Stars existed", () => {
    const old = { background: "#ffffff", text: "#1a2230", card: "#f6f7f9", border: "#c9d0d8", accent: "#243b53", soft: "#eceff3" };
    expect(cleanPrefs({ colors: old }).colors).toEqual({ ...old, star: DEFAULT_ROLES.star });
  });
  it("turns soft light and calm mode into variables and an attribute", () => {
    const b = compute({ ...DEFAULT_PREFS, soft: 2, calm: true });
    expect(b.vars["--background"]).toBe(softLight(DEFAULT_ROLES, 2).background);
    expect(b.attrs["data-pz-calm"]).toBe("on");
    expect(cleanPrefs({ soft: 2, calm: true, slowVoice: true })).toMatchObject({ soft: 2, calm: true, slowVoice: true });
    expect(cleanPrefs({ soft: 9, calm: "yes" })).toMatchObject({ soft: 0, calm: false });
  });
  it("only sets what was changed", () => {
    const b = compute({ ...DEFAULT_PREFS, size: 125, icons: "icons" });
    expect(b.vars).toEqual({ "--pz-size": "125" });
    expect(b.attrs).toEqual({ "data-pz": "size", "data-pz-icons": "icons" });
  });
});
