// One star per item (profile question or plan step), joined into a constellation on a small night sky.
// Lit stars use star gold, the color reserved for achievements; waiting stars are dim, never hollow.
const HEIGHTS = [58, 30, 46, 18, 38, 22, 50, 30];
// Wide and short, so the sky fills the content column without the stars growing chunky.
const WIDTH = 520;
const HEIGHT = 76;
const LEFT = 20;
const SPAN = WIDTH - 2 * LEFT;

// Fixed background specks, so the sky looks the same on every render.
const SPECKS = [
  [8, 12], [44, 66], [70, 8], [98, 52], [126, 70], [150, 10], [178, 60], [204, 34], [232, 6], [258, 68], [286, 44], [318, 14],
  [346, 58], [372, 20], [398, 70], [424, 40], [452, 8], [478, 62], [506, 30],
] as const;

// names + onSelect turn each star into a button (My plan); without them it is a picture (Profile).
export function Constellation({
  lit,
  label,
  names,
  onSelect,
  glow,
  current,
}: {
  lit: boolean[];
  label: string;
  names?: string[];
  onSelect?: (index: number) => void;
  // The star that was just lit: it grows in with a soft ring, once.
  glow?: number;
  // The step to do now: a still ring marks "you are here".
  current?: number;
}) {
  const gap = lit.length > 1 ? SPAN / (lit.length - 1) : 0;
  const points = lit.map((_, i) => [LEFT + i * gap, HEIGHTS[i % HEIGHTS.length]] as const);
  // Keep stars from touching when a long plan packs them close together.
  const r = Math.min(6, Math.max(3, gap / 3));

  const picture = (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role={onSelect ? undefined : "img"}
      aria-label={onSelect ? undefined : label}
      aria-hidden={onSelect ? true : undefined}
      className="h-auto w-full overflow-visible"
    >
      {SPECKS.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="0.9" fill="white" opacity="0.3" />
      ))}
      {/* The path walked so far glows; the rest of the way is a faint dotted line. */}
      {points.slice(1).map(([x, y], i) => {
        const [px, py] = points[i];
        const walked = lit[i] && lit[i + 1];
        return (
          <line
            key={i}
            x1={px}
            y1={py}
            x2={x}
            y2={y}
            stroke={walked ? "var(--star)" : "white"}
            strokeOpacity={walked ? 0.85 : 0.25}
            strokeWidth={walked ? 2 : 1.5}
            strokeDasharray={walked ? undefined : "2 4"}
            strokeLinecap="round"
          />
        );
      })}
      {points.map(([x, y], i) =>
        lit[i] ? (
          <g key={i} className={i === glow ? "star-lit" : undefined}>
            {i === glow && <circle cx={x} cy={y} r={r} fill="none" stroke="var(--star)" strokeWidth="2" className="star-ring" />}
            <circle cx={x} cy={y} r={r} fill="var(--star)" className="star-core" />
          </g>
        ) : (
          <g key={i}>
            {i === current && <circle cx={x} cy={y} r={r * 1.9} fill="none" stroke="white" strokeOpacity="0.8" strokeWidth="1.5" />}
            <circle cx={x} cy={y} r={r * 0.6} fill="white" opacity={i === current ? 0.9 : 0.45} />
          </g>
        ),
      )}
    </svg>
  );

  // The sky band: the navy reads as night, and star gold on it is far stronger than on the mint page.
  const sky = "w-full rounded-2xl bg-sky px-4 py-3 sm:px-6 sm:py-4";
  if (!onSelect) return <div className={sky}>{picture}</div>;

  return (
    <div className={sky}>
      <div role="group" aria-label={label} className="relative">
        {picture}
        {points.map(([x, y], i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            aria-label={`${names?.[i] ?? `Step ${i + 1}`}, step ${i + 1} of ${lit.length}, ${lit[i] ? "done" : "not done"}`}
            // shortcut: targets are 44 px while stars are at least 44 px apart (up to about 8 steps); longer plans get smaller targets, but every step stays reachable from the lists below.
            style={{ left: `${(x / WIDTH) * 100}%`, top: `${(y / HEIGHT) * 100}%`, width: gap ? `min(44px, ${(gap / WIDTH) * 100}%)` : "44px" }}
            className="absolute aspect-square min-w-6 -translate-x-1/2 -translate-y-1/2 rounded-full outline-none hover:bg-white/10 hover:ring-2 hover:ring-white/40 focus-visible:ring-3 focus-visible:ring-star"
          />
        ))}
      </div>
    </div>
  );
}
