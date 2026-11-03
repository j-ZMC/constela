// Personalization: independent, optional preferences stored on this device only.
// With the defaults, nothing is applied and the app looks exactly as before.
// compute() is pure (testable); applyPrefs() touches <html>; layout.tsx re-applies "pz-boot" before paint.

export type Roles = { background: string; text: string; card: string; border: string; accent: string; soft: string };
export type SavedPreset = { id: string; name: string; colors: Roles };

export const ROLE_LABELS: Record<keyof Roles, string> = {
  background: "Background",
  text: "Text",
  card: "Cards",
  border: "Borders",
  accent: "Accent (buttons)",
  soft: "Soft areas",
};

// Same values as :root in globals.css
export const DEFAULT_ROLES: Roles = {
  background: "#e7f0ed", text: "#243b53", card: "#ffffff", border: "#d0ddd8", accent: "#243b53", soft: "#dde8e4",
};

export const PRESETS: { id: string; name: string; colors: Roles | null }[] = [
  { id: "astralis", name: "Astralis (default)", colors: null },
  { id: "light", name: "Light", colors: { background: "#ffffff", text: "#1a2230", card: "#f6f7f9", border: "#c9d0d8", accent: "#243b53", soft: "#eceff3" } },
  { id: "dark", name: "Dark", colors: { background: "#12171c", text: "#eef2f6", card: "#1b222a", border: "#3a4653", accent: "#8fb8e0", soft: "#252e38" } },
  // The old "Calm" reading mode, now a palette: softer contrast and muted color.
  { id: "calm", name: "Calm", colors: { background: "#edf2f0", text: "#3a4e63", card: "#f8faf9", border: "#d9e3df", accent: "#4a6178", soft: "#e2eae7" } },
  { id: "cream", name: "Cream", colors: { background: "#f6efe0", text: "#2e2a24", card: "#fffdf6", border: "#d9ccb0", accent: "#5b3d1e", soft: "#ece2cb" } },
];

export type Prefs = {
  preset: string; // preset id, "custom", or a saved preset id
  colors: Roles | null; // null = untouched palette
  saved: SavedPreset[];
  font: "default" | "system" | "verdana" | "dyslexic";
  size: number; // % of base font size
  lh: number; // 0 = untouched
  ls: number; // em, 0 = untouched
  width: number; // ch, 0 = untouched
  cursor: "default" | "large" | "xlarge";
  cursorColor: "black" | "white";
  icons: "both" | "icons" | "text";
  iconSize: number; // px, 0 = untouched
  ctlSize: number; // px, 0 = untouched
  detail: "reduced" | "comfortable" | "full";
  focus: boolean;
};

export const DEFAULT_PREFS: Prefs = {
  preset: "astralis", colors: null, saved: [], font: "default", size: 100, lh: 0, ls: 0, width: 0,
  cursor: "default", cursorColor: "black", icons: "both", iconSize: 0, ctlSize: 0, detail: "comfortable", focus: false,
};

const STACKS = { system: "system-ui, 'Segoe UI', Roboto, sans-serif", verdana: "Verdana, sans-serif" } as const;

// ---- color math ----
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c: number[]) => "#" + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
const lum = (h: string) => {
  const [r, g, b] = rgb(h).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
/** a + (b - a) * t */
export const mix = (a: string, b: string, t: number) => { const [p, q] = [rgb(a), rgb(b)]; return hex(p.map((v, i) => v + (q[i] - v) * t)); };
export const readableOn = (bg: string) => (contrast("#ffffff", bg) >= contrast("#111111", bg) ? "#ffffff" : "#111111");

export type ContrastCheck = { label: string; ratio: number; min: number; ok: boolean };
export function checkContrast(r: Roles): ContrastCheck[] {
  const muted = mix(r.text, r.background, 0.2);
  const rows: [string, number, number][] = [
    ["Text on background", contrast(r.text, r.background), 4.5],
    ["Text on cards", contrast(r.text, r.card), 4.5],
    ["Secondary text on background", contrast(muted, r.background), 4.5],
    ["Text on soft areas", contrast(r.text, r.soft), 4.5],
    ["Accent against background", contrast(r.accent, r.background), 3],
  ];
  return rows.map(([label, ratio, min]) => ({ label, ratio, min, ok: ratio >= min }));
}

// The night sky (page headers, intro, tour) takes the palette's accent, darkened until white text on it reaches
// 7:1, so its secondary text (white at 80%) still passes 4.5:1. A navy accent stays as it is.
export function skyFor(r: Roles): string {
  let sky = r.accent;
  for (let t = 0.05; contrast("#ffffff", sky) < 7 && t <= 1; t += 0.05) sky = mix(r.accent, "#000000", t);
  return sky;
}

// A dark page background asks the browser for dark scrollbars, selects and date pickers too.
export const isDark = (r: Roles) => lum(r.background) < 0.2;

function roleVars(r: Roles): Record<string, string> {
  return {
    "--background": r.background, "--foreground": r.text,
    "--card": r.card, "--card-foreground": r.text, "--popover": r.card, "--popover-foreground": r.text,
    "--border": r.border, "--input": mix(r.text, r.card, 0.45), "--ring": r.accent,
    "--primary": r.accent, "--primary-foreground": readableOn(r.accent),
    "--secondary": r.soft, "--secondary-foreground": r.text, "--muted": r.soft, "--accent": r.soft, "--accent-foreground": r.text,
    "--muted-foreground": mix(r.text, r.background, 0.2),
    "--sky": skyFor(r),
  };
}

const cursorSvg = (px: number, fill: string, stroke: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 24 24"><path d="M3 2l7 19 3-8 8-3z" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/></svg>`)}") 3 2, auto`;

export type Boot = { vars: Record<string, string>; attrs: Record<string, string>; focus: boolean };

export function compute(p: Prefs): Boot {
  const vars: Record<string, string> = {};
  const on: string[] = [];
  const attrs: Record<string, string> = {};
  if (p.colors) Object.assign(vars, roleVars(p.colors));
  if (p.font === "system" || p.font === "verdana") { vars["--pz-font"] = STACKS[p.font]; on.push("font"); }
  if (p.size !== 100) { vars["--pz-size"] = String(p.size); on.push("size"); }
  if (p.lh) { vars["--pz-lh"] = String(p.lh); on.push("lh"); }
  if (p.ls) { vars["--pz-ls"] = `${p.ls}em`; on.push("ls"); }
  if (p.width) { vars["--pz-w"] = `${p.width}ch`; on.push("w"); }
  if (p.cursor !== "default") {
    const [fill, stroke] = p.cursorColor === "white" ? ["#ffffff", "#000000"] : ["#000000", "#ffffff"];
    vars["--pz-cursor"] = cursorSvg(p.cursor === "xlarge" ? 48 : 32, fill, stroke);
    on.push("cur");
  }
  if (p.iconSize) { vars["--pz-icon"] = `${p.iconSize}px`; on.push("icon"); }
  if (p.ctlSize) { vars["--pz-ctl"] = `${p.ctlSize}px`; on.push("ctl"); }
  if (on.length) attrs["data-pz"] = on.join(" ");
  if (p.icons !== "both") attrs["data-pz-icons"] = p.icons;
  if (p.detail !== "comfortable") attrs["data-pz-detail"] = p.detail;
  if (p.colors && isDark(p.colors)) attrs["data-pz-scheme"] = "dark";
  return { vars, attrs, focus: p.focus };
}

const ALL_VARS = [...Object.keys(roleVars(DEFAULT_ROLES)), "--pz-font", "--pz-size", "--pz-lh", "--pz-ls", "--pz-w", "--pz-cursor", "--pz-icon", "--pz-ctl"];
const ALL_ATTRS = ["data-pz", "data-pz-icons", "data-pz-detail", "data-pz-scheme"];

export function applyPrefs(p: Prefs): void {
  const root = document.documentElement;
  const b = compute(p);
  ALL_VARS.forEach((k) => root.style.removeProperty(k));
  ALL_ATTRS.forEach((k) => root.removeAttribute(k));
  Object.entries(b.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  Object.entries(b.attrs).forEach(([k, v]) => root.setAttribute(k, v));
  root.classList.toggle("focus-strong", b.focus);
}

export const PZ_KEY = "pz";
export const PZ_BOOT_KEY = "pz-boot";

const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T => (options.includes(v as T) ? (v as T) : fallback);
// 0 means "untouched" for the optional sliders.
const inRange = (v: unknown, min: number, max: number, fallback: number, zeroOk = false) =>
  typeof v === "number" && ((zeroOk && v === 0) || (v >= min && v <= max)) ? v : fallback;

function cleanRoles(v: unknown): Roles | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(DEFAULT_ROLES) as (keyof Roles)[];
  return keys.every((k) => isHex(o[k])) ? (Object.fromEntries(keys.map((k) => [k, o[k]])) as Roles) : null;
}

// Storage can be edited by hand: keep only well-formed values, the same way the profile and plan load.
export function cleanPrefs(raw: unknown): Prefs {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const saved = Array.isArray(r.saved)
    ? r.saved.flatMap((s) => {
        const colors = cleanRoles(s?.colors);
        return colors && typeof s.id === "string" && typeof s.name === "string" ? [{ id: s.id, name: s.name.slice(0, 40), colors }] : [];
      })
    : [];
  return {
    preset: typeof r.preset === "string" ? r.preset : DEFAULT_PREFS.preset,
    colors: cleanRoles(r.colors),
    saved,
    font: oneOf(r.font, ["default", "system", "verdana", "dyslexic"], "default"),
    size: inRange(r.size, 90, 150, 100),
    lh: inRange(r.lh, 1.2, 2.2, 0, true),
    ls: inRange(r.ls, 0, 0.15, 0),
    width: inRange(r.width, 40, 90, 0, true),
    cursor: oneOf(r.cursor, ["default", "large", "xlarge"], "default"),
    cursorColor: oneOf(r.cursorColor, ["black", "white"], "black"),
    icons: oneOf(r.icons, ["both", "icons", "text"], "both"),
    iconSize: inRange(r.iconSize, 16, 32, 0, true),
    ctlSize: inRange(r.ctlSize, 32, 56, 0, true),
    detail: oneOf(r.detail, ["reduced", "comfortable", "full"], "comfortable"),
    focus: r.focus === true,
  };
}

export function loadPrefs(): Prefs {
  try { return cleanPrefs(JSON.parse(localStorage.getItem(PZ_KEY) || "{}")); } catch { return DEFAULT_PREFS; }
}

export function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(PZ_KEY, JSON.stringify(p));
    localStorage.setItem(PZ_BOOT_KEY, JSON.stringify(compute(p)));
  } catch {
    // Without localStorage the settings still apply for this visit.
  }
}
