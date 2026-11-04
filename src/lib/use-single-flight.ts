import { useCallback, useRef } from "react";

// One action at a time. A disabled button only helps after React draws again, so a quick double tap could still
// send twice (two searches, two uploads, two paid lookups); the ref is set before anything else runs.
export function useSingleFlight() {
  const running = useRef(false);
  return useCallback(async (action: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    try {
      await action();
    } finally {
      running.current = false;
    }
  }, []);
}
