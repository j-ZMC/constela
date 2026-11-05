import { useSyncExternalStore } from "react";
import { parseResumeProfile, type ResumeProfile } from "@/lib/resume";

export type LocalAccount = { name: string; email: string };
const VERSION = 1;
const ACCOUNT_KEY = "account-profile";
const RESUME_KEY = "resume-profile";

function read<T>(key: string, parse: (value: unknown) => T | null): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data?.version === VERSION ? parse(data.data) : null;
  } catch {
    return null;
  }
}

export function loadLocalAccount(): LocalAccount | null {
  return read(ACCOUNT_KEY, (value) => {
    if (typeof value !== "object" || value === null) return null;
    const account = value as Record<string, unknown>;
    return typeof account.name === "string" && typeof account.email === "string"
      ? { name: account.name, email: account.email }
      : null;
  });
}

export function saveLocalAccount(account: LocalAccount): void {
  try {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ version: VERSION, data: account }));
  } catch {
    // Storage is optional for the local demo.
  }
}

export function loadResumeProfile(): ResumeProfile | null {
  return read(RESUME_KEY, parseResumeProfile);
}

export function saveResumeProfile(profile: ResumeProfile): void {
  try {
    localStorage.setItem(RESUME_KEY, JSON.stringify({ version: VERSION, data: profile }));
  } catch {
    // Storage is optional for the local demo.
  }
  window.dispatchEvent(new Event(RESUME_CHANGE));
}

export function clearResumeProfile(): void {
  try {
    localStorage.removeItem(RESUME_KEY);
  } catch {
    // Storage is optional for the local demo.
  }
  window.dispatchEvent(new Event(RESUME_CHANGE));
}

// Visited pages stay mounted (cacheComponents), so Jobs listens for a CV added or removed in the Profile.
const RESUME_CHANGE = "resume-profile-change";
function subscribe(onChange: () => void) {
  window.addEventListener(RESUME_CHANGE, onChange);
  window.addEventListener("storage", onChange); // another tab
  return () => {
    window.removeEventListener(RESUME_CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}
const snapshot = () => {
  try {
    return localStorage.getItem(RESUME_KEY);
  } catch {
    return null;
  }
};
// The saved CV as stored text: changes whenever the CV does.
export const useResumeSnapshot = () => useSyncExternalStore(subscribe, snapshot, () => null);
