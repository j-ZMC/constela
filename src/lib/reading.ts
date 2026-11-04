// Reading settings are classes on <html>, persisted under "a11y" (layout.tsx re-applies them before paint).
export const READING_KEY = "a11y";

export type ReadingOption = "dyslexic" | "text-large" | "calm" | "reduce-motion";

export function setReadingOption(key: ReadingOption, on: boolean): void {
  document.documentElement.classList.toggle(key, on);
  try {
    const prefs = JSON.parse(localStorage.getItem(READING_KEY) || "{}");
    localStorage.setItem(READING_KEY, JSON.stringify({ ...prefs, [key]: on }));
  } catch {
    // Without localStorage (private mode) the option still works for this visit.
  }
}
