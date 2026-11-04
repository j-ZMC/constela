import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// False on the server and during hydration, true after. Gate anything that reads localStorage behind it
// so the first client render matches the server HTML.
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
