// What a page shows while it reads this device's saved data: a short line, never a blank page (DESIGN.md).
export function Loading() {
  return (
    <p role="status" className="text-muted-foreground">
      Loading…
    </p>
  );
}
