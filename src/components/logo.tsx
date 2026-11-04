// The Constela mark: a "C" drawn as a small constellation, five stars joined by one line. The first star is the
// star-gold sparkle, the one already lit. Decorative: the word "Constela" always sits next to it.
const STARS = [
  [9, 24.5],
  [6.5, 15.5],
  [12, 7.5],
  [21, 27.5],
] as const;

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 32 32" className={className}>
      <path
        d="M25 6.5 L12 7.5 L6.5 15.5 L9 24.5 L21 27.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
      {STARS.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="2.3" fill="currentColor" />
      ))}
      {/* The lit star: a four-point sparkle in star gold, outlined so it holds up on the light mint page. */}
      <path
        d="M25 1.5 L26.6 4.9 L30 6.5 L26.6 8.1 L25 11.5 L23.4 8.1 L20 6.5 L23.4 4.9 Z"
        fill="var(--star)"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Mark plus the word, in the app's own legible font.
export function Logo({ className }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 font-bold ${className ?? ""}`}>
      <LogoMark className="size-7 shrink-0" />
      Constela
    </span>
  );
}
