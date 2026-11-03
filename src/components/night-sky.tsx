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
  // Fisher-Yates, not sort(() => rand() - 0.5): a random comparator orders differently on the server and in the
  // browser, which made the sky fail to hydrate.
  const cells = Array.from({ length: cols * rows }, (_, i) => i);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  cells.length = Math.min(figures, cells.length);
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

// still: the same sky without motion, for page headers where people are working (DESIGN.md: motion only on the intro).
export function NightSky({ className, still = false }: { className?: string; still?: boolean }) {
  return (
    <svg aria-hidden viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className={className}>
      {FULL.dust.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="white" className={still ? undefined : "sky-twinkle"} style={{ animationDelay: `${s.delay}s`, animationDuration: `${s.duration + 2}s` }} />
      ))}
      {FULL.shapes.map((f, n) => {
        const d = f.stars.map((s, i) => `${i ? "L" : "M"}${s.x.toFixed(1)} ${s.y.toFixed(1)}`).join(" ");
        return (
          <g key={n}>
            <path d={d} pathLength={1} fill="none" stroke="white" strokeOpacity="0.28" strokeWidth="1.2" strokeLinejoin="round" className={still ? undefined : "sky-draw"} style={{ animationDelay: `${n * 0.35}s` }} />
            {/* The trail: a short bright stroke that travels along the line, slowly. */}
            {f.trail && !still && (
              <path d={d} pathLength={1} fill="none" stroke="var(--star)" strokeWidth="1.6" strokeLinecap="round" className="sky-trail" style={{ animationDelay: `${3 + n * 1.7}s` }} />
            )}
            {f.stars.map((s, i) => (
              <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={i === 0 ? "var(--star)" : "white"} className={still ? undefined : "sky-twinkle"} style={{ animationDelay: `${s.delay}s`, animationDuration: `${s.duration}s` }} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

// Real constellations for the page background, drawn like the intro sky but in soft gray.
// Each star is [x, y, magnitude] in a 0–1 box (lower magnitude is brighter), and lines join stars by index.
type Real = { name: string; stars: [number, number, number][]; lines: [number, number][] };

const REAL = {
  bigDipper: {
    name: "Big Dipper",
    stars: [[0, 0.12, 1.5], [0.04, 0.46, 1.8], [0.38, 0.56, 2.2], [0.4, 0.22, 3], [0.6, 0.16, 1.6], [0.79, 0.11, 2], [1, 0.3, 1.8]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]],
  },
  orion: {
    name: "Orion",
    stars: [[0.5, 0, 3], [0.18, 0.12, 1], [0.78, 0.18, 1.6], [0.38, 0.52, 1.8], [0.5, 0.49, 1.7], [0.62, 0.46, 2.2], [0.3, 1, 2], [0.86, 0.95, 1]],
    lines: [[0, 1], [0, 2], [1, 3], [2, 5], [3, 4], [4, 5], [3, 6], [5, 7]],
  },
  cassiopeia: {
    name: "Cassiopeia",
    stars: [[0, 0.3, 2.2], [0.25, 0.85, 2.3], [0.5, 0.45, 2.2], [0.74, 0.95, 2.7], [1, 0.2, 3.3]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  cygnus: {
    name: "Cygnus",
    stars: [[0.5, 0, 1.2], [0.5, 0.38, 2.2], [0.52, 1, 3], [0.08, 0.3, 2.5], [0.92, 0.44, 2.9], [0.5, 0.62, 3.2]],
    lines: [[0, 1], [1, 5], [5, 2], [3, 1], [1, 4]],
  },
  lyra: {
    name: "Lyra",
    stars: [[0.25, 0, 1], [0.42, 0.32, 4], [0.74, 0.38, 4.2], [0.66, 1, 3.2], [0.34, 0.94, 3.5]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 1]],
  },
  leo: {
    name: "Leo",
    stars: [[0.18, 1, 1.4], [0.12, 0.66, 3.5], [0.24, 0.42, 2], [0.16, 0.2, 3.4], [0.34, 0, 3], [1, 0.72, 2.1], [0.7, 0.44, 2.6], [0.7, 0.78, 3.3]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 6], [6, 5], [5, 7], [7, 0], [7, 6]],
  },
  crux: {
    name: "Southern Cross",
    stars: [[0.5, 0, 1.6], [0.46, 1, 0.8], [0, 0.45, 1.3], [0.86, 0.38, 2.8], [0.62, 0.62, 4]],
    lines: [[0, 1], [2, 3]],
  },
  scorpius: {
    name: "Scorpius",
    stars: [
      [0, 0.06, 2.6], [0.08, 0.22, 2.3], [0.14, 0.4, 2.9], [0.3, 0.38, 1], [0.38, 0.5, 2.8], [0.44, 0.68, 2.3],
      [0.48, 0.86, 2.7], [0.62, 0.98, 3], [0.8, 0.94, 1.9], [0.88, 0.78, 2.4], [0.98, 0.72, 1.6],
    ],
    lines: [[0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10]],
  },
  gemini: {
    name: "Gemini",
    stars: [[0, 0, 1.6], [0.32, 0.06, 1.2], [0.14, 0.48, 3], [0.26, 1, 2.9], [0.5, 0.44, 3.5], [0.62, 0.96, 1.9]],
    lines: [[0, 1], [0, 2], [2, 3], [1, 4], [4, 5]],
  },
  littleDipper: {
    name: "Little Dipper",
    stars: [[0, 0, 2], [0.26, 0.14, 4.4], [0.46, 0.3, 4.3], [0.62, 0.52, 4.2], [0.96, 0.44, 2.1], [1, 0.76, 3], [0.66, 0.84, 5]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]],
  },
} satisfies Record<string, Real>;

// Where each one sits on a 1800 × 1000 sky: [constellation, x, y, size, rotation in degrees].
// Three loose bands at different sizes and angles, so it reads like a sky rather than a grid. Phones show the middle.
type Placement = [keyof typeof REAL, number, number, number, number];
const PLACEMENTS: Placement[] = [
  ["bigDipper", 80, 40, 230, -8],
  ["cassiopeia", 370, 120, 150, 14],
  ["orion", 120, 330, 190, 6],
  ["lyra", 400, 420, 110, -12],
  ["leo", 70, 640, 220, -4],
  ["crux", 410, 700, 120, 10],
  ["littleDipper", 690, 30, 160, -14],
  ["scorpius", 960, 80, 220, 8],
  ["cygnus", 640, 300, 180, -6],
  ["gemini", 1000, 420, 150, 12],
  ["orion", 700, 620, 170, -10],
  ["bigDipper", 960, 760, 200, 6],
  ["cygnus", 1560, 50, 190, 8],
  ["gemini", 1280, 150, 160, -10],
  ["scorpius", 1500, 360, 240, 4],
  ["littleDipper", 1270, 520, 170, 16],
  ["cassiopeia", 1560, 720, 140, -18],
  ["lyra", 1290, 820, 100, 6],
];

function placeStars(placements: Placement[]) {
  return placements.map(([key, x, y, size, rotate], n) => {
    const c: Real = REAL[key];
    const rad = (rotate * Math.PI) / 180;
    const [cos, sin] = [Math.cos(rad), Math.sin(rad)];
    const stars = c.stars.map(([sx, sy, mag]) => {
      const [dx, dy] = [(sx - 0.5) * size, (sy - 0.5) * size];
      return { x: x + size / 2 + dx * cos - dy * sin, y: y + size / 2 + dx * sin + dy * cos, mag };
    });
    return { name: c.name, stars, lines: c.lines, trail: n % 3 === 1 };
  });
}

function dust(seed: number, count: number) {
  const rand = seeded(seed);
  return Array.from({ length: count }, () => ({
    x: rand() * 1800,
    y: rand() * 1000,
    r: 0.5 + rand() * 1.1,
    o: 0.3 + rand() * 0.7,
    delay: rand() * 6,
    duration: 4 + rand() * 4,
  }));
}

const FIGURES = placeStars(PLACEMENTS);
const DUST = dust(21, 200);

// Brighter stars are bigger and less transparent, like a real sky.
const radius = (mag: number) => Math.max(1, 4.2 - mag * 0.75);
const glow = (mag: number) => Math.min(1, Math.max(0.35, 1.15 - mag * 0.18));

// Behind the content column the sky fades to a third, so text on the page stays easy to read.
const FADE = "linear-gradient(to right, black 18%, rgb(0 0 0 / 0.35) 36%, rgb(0 0 0 / 0.35) 64%, black 82%)";

// The whole page background: real constellations in soft gray, in the intro's style. Cards sit on top of it.
export function BackgroundSky() {
  return (
    <div aria-hidden data-background-sky className="pointer-events-none fixed inset-x-0 top-16 bottom-0 -z-10">
      <svg viewBox="0 0 1800 1000" preserveAspectRatio="xMidYMid slice" className="h-full w-full" style={{ maskImage: FADE }}>
        {/* The intro's motion, slower and in gray. The visible state is the default, so Reduce motion shows a still sky. */}
        <g fill="var(--foreground)" opacity="0.2">
          {DUST.map((s, i) => (
            <g key={i} opacity={s.o}>
              <circle cx={s.x} cy={s.y} r={s.r} className="sky-twinkle" style={{ animationDelay: `${s.delay}s`, animationDuration: `${s.duration}s` }} />
            </g>
          ))}
        </g>
        {FIGURES.map((f, n) => {
          const segments = f.lines
            .map(([a, b]) => `M${f.stars[a].x.toFixed(1)} ${f.stars[a].y.toFixed(1)} L${f.stars[b].x.toFixed(1)} ${f.stars[b].y.toFixed(1)}`)
            .join(" ");
          return (
            <g key={n}>
              <path d={segments} fill="none" stroke="var(--foreground)" strokeOpacity="0.14" strokeWidth="1.2" strokeLinecap="round" />
              {f.trail && (
                <path
                  d={segments}
                  pathLength={1}
                  fill="none"
                  stroke="var(--foreground)"
                  strokeOpacity="0.35"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  className="sky-trail"
                  style={{ animationDelay: `${4 + n * 2.3}s`, animationDuration: "14s" }}
                />
              )}
              {f.stars.map((s, i) => (
                <g key={i} opacity={0.32 * glow(s.mag)}>
                  <circle
                    cx={s.x}
                    cy={s.y}
                    r={radius(s.mag)}
                    fill="var(--foreground)"
                    className="sky-twinkle"
                    style={{ animationDelay: `${(n * 1.3 + i * 0.7) % 6}s`, animationDuration: `${5 + ((n + i) % 4)}s` }}
                  />
                </g>
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
