// Personalization: independent, optional preferences stored on this device only.
// With the defaults, nothing is applied and the app looks exactly as before.
// compute() is pure (testable); applyPrefs() touches <html>; layout.tsx re-applies "pz-boot" before paint.

// star: lit stars and achievements, and a role the person can pick. sky: the menu, page headers and My plan's sky;
// presets set it by hand, and a custom palette without one gets skyFor().
export type Roles = { background: string; text: string; card: string; border: string; accent: string; soft: string; star: string; sky?: string };
export type SavedPreset = { id: string; name: string; colors: Roles };

// The color cells in Personalize. The sky is not one: it is designed with each palette.
export const ROLE_LABELS: Record<Exclude<keyof Roles, "sky">, string> = {
  background: "Background",
  text: "Text",
  card: "Cards",
  border: "Borders",
  accent: "Accent (buttons)",
  soft: "Soft areas",
  star: "Stars",
};

// Same values as :root in globals.css
export const DEFAULT_ROLES: Roles = {
  background: "#e7f0ed", text: "#243b53", card: "#ffffff", border: "#d0ddd8", accent: "#243b53", soft: "#dde8e4",
  star: "#f2b880", sky: "#243b53",
};

export const PRESETS: { id: string; name: string; colors: Roles | null }[] = [
  { id: "astralis", name: "Astralis (default)", colors: null },
  // Each palette is designed as a whole: the page, a darker sky for the menu and headers, and a star color that
  // belongs with the sky and still stands out on it.
  // Light: bright white with royal blue, gold stars. Different from Astralis (mint and navy, peach stars).
  { id: "light", name: "Light", colors: { background: "#f7f9fc", text: "#1a2230", card: "#ffffff", border: "#d3dbe7", accent: "#2b59c3", soft: "#e8eef9", star: "#ffc857", sky: "#1b2f5e" } },
  // Dark: a night-blue sky over a dark slate page, peach stars.
  { id: "dark", name: "Dark", colors: { background: "#161b22", text: "#e8edf3", card: "#1f2630", border: "#3a4553", accent: "#8fb8e0", soft: "#28313c", star: "#f2b880", sky: "#0b1120" } },
  // The old "Calm" reading mode, now a palette: softer contrast, a deep teal sky and soft amber stars.
  { id: "calm", name: "Calm", colors: { background: "#edf2f0", text: "#3a4e63", card: "#f8faf9", border: "#d9e3df", accent: "#4a6178", soft: "#e2eae7", star: "#f6c177", sky: "#2c4a52" } },
  // Cream: warm paper, an espresso sky and warm gold stars.
  { id: "cream", name: "Cream", colors: { background: "#f6efe0", text: "#2e2a24", card: "#fffdf6", border: "#d9ccb0", accent: "#5b3d1e", soft: "#ece2cb", star: "#f2c26b", sky: "#2e2014" } },
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
  soft: number; // Soft light: 0 = off, 1 to 3 = how warm and dim
  calm: boolean; // Calm mode: no animation, glow or unasked sound
  slowVoice: boolean; // The AI speaks slower (Kokoro and the browser's voice)
};

export const DEFAULT_PREFS: Prefs = {
  preset: "astralis", colors: null, saved: [], font: "default", size: 100, lh: 0, ls: 0, width: 0,
  cursor: "default", cursorColor: "black", icons: "both", iconSize: 0, ctlSize: 0, detail: "comfortable", focus: false,
  soft: 0, calm: false, slowVoice: false,
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
// On a dark page it keeps going until it is darker than the page too, so the menu and headers are always the dark
// part of the screen, never lighter than what they frame.
export function skyFor(r: Roles): string {
  if (r.sky) return r.sky;
  let sky = r.accent;
  const darkEnough = () => contrast("#ffffff", sky) >= 7 && lum(sky) < lum(r.background) * 0.6;
  for (let t = 0.05; !darkEnough() && t <= 1; t += 0.05) sky = mix(r.accent, "#000000", t);
  return sky;
}

// Soft light: the page, cards and borders lean toward a warm, dimmer tone. A web page cannot change the screen's
// real brightness, so this is the closest it can do. Each level goes as far as it can while every contrast check
// still passes; a palette that already fails stays as it is.
const WARM = "#7a5230";
export const SOFT_LEVELS = [0, 1, 2, 3] as const;
export function softLight(r: Roles, level: number): Roles {
  for (let t = level * 0.12; t > 0.001; t -= 0.01) {
    const dim = { ...r, background: mix(r.background, WARM, t), card: mix(r.card, WARM, t * 0.8), soft: mix(r.soft, WARM, t), border: mix(r.border, WARM, t) };
    if (checkContrast(dim).every((c) => c.ok)) return dim;
  }
  return r;
}

// Lit stars and the map's branch names sit on the sky, so the star color is checked there (shown under the colors).
export const starCheck = (r: Roles): ContrastCheck => {
  const ratio = contrast(r.star, skyFor(r));
  return { label: "Stars against the menu and sky", ratio, min: 3, ok: ratio >= 3 };
};

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
    "--star": r.star,
  };
}

const cursorSvg = (px: number, fill: string, stroke: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 24 24"><path d="M3 2l7 19 3-8 8-3z" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/></svg>`)}") 3 2, auto`;

export type Boot = { vars: Record<string, string>; attrs: Record<string, string>; focus: boolean };

export function compute(p: Prefs): Boot {
  const vars: Record<string, string> = {};
  const on: string[] = [];
  const attrs: Record<string, string> = {};
  const colors = p.soft ? softLight(p.colors ?? DEFAULT_ROLES, p.soft) : p.colors;
  if (colors) Object.assign(vars, roleVars(colors));
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
  if (colors && isDark(colors)) attrs["data-pz-scheme"] = "dark";
  if (p.calm) attrs["data-pz-calm"] = "on";
  return { vars, attrs, focus: p.focus };
}

const ALL_VARS = [...Object.keys(roleVars(DEFAULT_ROLES)), "--pz-font", "--pz-size", "--pz-lh", "--pz-ls", "--pz-w", "--pz-cursor", "--pz-icon", "--pz-ctl"];
const ALL_ATTRS = ["data-pz", "data-pz-icons", "data-pz-detail", "data-pz-scheme", "data-pz-calm"];

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

// Palettes saved before Stars and Menu existed have neither: they get the default stars and a sky from their accent.
const BASE_ROLES = ["background", "text", "card", "border", "accent", "soft"] as const;
function cleanRoles(v: unknown): Roles | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  if (!BASE_ROLES.every((k) => isHex(o[k]))) return null;
  const roles = { ...Object.fromEntries(BASE_ROLES.map((k) => [k, o[k]])), star: isHex(o.star) ? o.star : DEFAULT_ROLES.star } as Roles;
  return isHex(o.sky) ? { ...roles, sky: o.sky } : roles;
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
    soft: SOFT_LEVELS.includes(r.soft as 0) ? (r.soft as number) : 0,
    calm: r.calm === true,
    slowVoice: r.slowVoice === true,
  };
}

// Calm mode is an attribute on <html>, set before paint, so anything can ask without reading storage.
export const calmMode = () => typeof document !== "undefined" && document.documentElement.hasAttribute("data-pz-calm");
// How fast the AI speaks: Kokoro's speed and the browser voice's rate.
export const voiceSpeed = () => (loadPrefs().slowVoice ? 0.8 : 0.95);

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
