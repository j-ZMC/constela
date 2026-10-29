// A decorative sky of constellations. The layout comes from a fixed seed, so server and client draw the same sky.
// Motion lives in globals.css (sky-*): stars twinkle slowly, lines draw in once and a few carry a soft trail.
// Every animation starts from the final, visible state, so Reduce motion simply shows a still sky.

const W = 1200;
const H = 800;

// Small deterministic random generator (mulberry32).
function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Star = { x: number; y: number; r: number; delay: number; duration: number };
type Figure = { stars: Star[]; trail: boolean };

function makeSky(seed: number, figures: number, specks: number, w = W, h = H, cols = 4, rows = 3) {
  const rand = seeded(seed);
  const star = (x: number, y: number, r: number): Star => ({ x, y, r, delay: rand() * 6, duration: 3 + rand() * 4 });
  // One constellation per grid cell, so they spread across the sky instead of clumping.
  const [cw, ch] = [w / cols, h / rows];
  const cells = Array.from({ length: cols * rows }, (_, i) => i).sort(() => rand() - 0.5).slice(0, figures);
  const shapes: Figure[] = cells.map((cell, n) => {
    const cx = ((cell % cols) + 0.5) * cw;
    const cy = (Math.floor(cell / cols) + 0.5) * ch;
    const count = 4 + Math.floor(rand() * 3);
    const stars = Array.from({ length: count }, () => star(cx + (rand() - 0.5) * cw * 0.8, cy + (rand() - 0.5) * ch * 0.75, 2 + rand() * 2));
    return { stars, trail: n % 2 === 0 };
  });
  const dust = Array.from({ length: specks }, () => star(rand() * w, rand() * h, 0.6 + rand() * 0.9));
  return { shapes, dust, w, h };
}

const FULL = makeSky(7, 7, 90);

export function NightSky({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className={className}>
      {FULL.dust.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="white" className="sky-twinkle" style={{ animationDelay: `${s.delay}s`, animationDuration: `${s.duration + 2}s` }} />
      ))}
      {FULL.shapes.map((f, n) => {
        const d = f.stars.map((s, i) => `${i ? "L" : "M"}${s.x.toFixed(1)} ${s.y.toFixed(1)}`).join(" ");
        return (
          <g key={n}>
            <path d={d} pathLength={1} fill="none" stroke="white" strokeOpacity="0.28" strokeWidth="1.2" strokeLinejoin="round" className="sky-draw" style={{ animationDelay: `${n * 0.35}s` }} />
            {/* The trail: a short bright stroke that travels along the line, slowly. */}
            {f.trail && (
              <path d={d} pathLength={1} fill="none" stroke="var(--star)" strokeWidth="1.6" strokeLinecap="round" className="sky-trail" style={{ animationDelay: `${3 + n * 1.7}s` }} />
            )}
            {f.stars.map((s, i) => (
              <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={i === 0 ? "var(--star)" : "white"} className="sky-twinkle" style={{ animationDelay: `${s.delay}s`, animationDuration: `${s.duration}s` }} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

// Faint, still constellations for the empty sides of wide screens. No motion: people are working there.
// Tall and narrow, one constellation per row, to fit the side margins.
const LEFT = makeSky(21, 3, 0, 300, 900, 1, 3);
const RIGHT = makeSky(42, 3, 0, 300, 900, 1, 3);

function Side({ sky, side }: { sky: ReturnType<typeof makeSky>; side: "left" | "right" }) {
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${sky.w} ${sky.h}`}
      preserveAspectRatio="xMidYMid meet"
      className={`absolute top-16 bottom-0 w-[16vw] ${side === "left" ? "left-[2vw]" : "right-[2vw]"}`}
    >
      {sky.shapes.map((f, n) => (
        <g key={n} opacity="0.13">
          <path d={f.stars.map((s, i) => `${i ? "L" : "M"}${s.x.toFixed(1)} ${s.y.toFixed(1)}`).join(" ")} fill="none" stroke="var(--foreground)" strokeWidth="1.5" strokeLinejoin="round" />
          {f.stars.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r * 1.2} fill="var(--foreground)" />
          ))}
        </g>
      ))}
    </svg>
  );
}

export function MarginSky() {
  // Only on wide screens, where the content column leaves real empty space on both sides.
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 hidden xl:block">
      <Side sky={LEFT} side="left" />
      <Side sky={RIGHT} side="right" />
    </div>
  );
}
