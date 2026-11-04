"use client";

import { useState, useSyncExternalStore } from "react";
import { branchName } from "@/lib/path";
import { CENTER, MAP_H, MAP_W, SLOTS, labelPosition, starPositions, type MapBranch } from "@/lib/path-map";
import type { Branch } from "@/lib/plan";
import { cn } from "@/lib/utils";

// Fixed star dust, so the sky looks the same on every render. In parts of the map, and twice its size each way,
// so it fills the whole screen around the map.
const DUST = (() => {
  let seed = 11;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: 640 }, () => [rand() * 2 - 0.5, rand() * 2 - 0.5, 0.6 + rand() * 1.1, 0.25 + rand() * 0.5] as const);
})();

type Point = [number, number];
// Decoration only: one or two small stars beside each step, so every branch reads as a real constellation without
// adding steps. Fixed per branch (seeded), never clickable, and hidden from screen readers with the rest of the picture.
function satellites(slot: number, points: Point[], center: Point): { from: Point; at: Point; r: number }[] {
  let seed = 97 + slot * 31;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return points.flatMap(([x, y], i) => {
    const [px, py] = i === 0 ? center : points[i - 1];
    const len = Math.hypot(x - px, y - py) || 1;
    const [ux, uy] = [(x - px) / len, (y - py) / len];
    return Array.from({ length: 1 + Math.floor(rand() * 2) }, (_, j) => {
      const side = j % 2 ? -1 : 1;
      const d = 11 + rand() * 13;
      const along = (rand() - 0.3) * 12;
      return { from: [x, y] as Point, at: [x - uy * d * side + ux * along, y + ux * d * side + uy * along] as Point, r: 1.1 + rand() * 1 };
    });
  });
}

// On a screen taller than wide, the map grows this much taller, so it fills a phone instead of a strip of it.
const TALL = 1.7;
const portrait = "(orientation: portrait)";
const subscribe = (change: () => void) => {
  const query = window.matchMedia(portrait);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
};
const useTall = () => useSyncExternalStore(subscribe, () => window.matchMedia(portrait).matches, () => false);
const STATUS = { done: "every step done", now: "working on this now", open: "open" } as const;
const ALIGN_X = { start: "translate-x-0 text-left", center: "-translate-x-1/2 text-center", end: "-translate-x-full text-right" } as const;
const ALIGN_Y = { start: "translate-y-0", center: "-translate-y-1/2", end: "-translate-y-full" } as const;

// Every branch as a constellation growing out of the person, in the middle. The sky is a picture; the stars that
// can be opened are real buttons on top of it. Its parent is a size container: the map is as big as fits in it.
export function PlanMap({
  branches,
  currentId,
  glowId,
  highlight = [],
  onSelect,
}: {
  branches: MapBranch[];
  // The step on the card above: a still ring marks "you are here".
  currentId?: string;
  // The star that was just lit: it grows in with a soft ring, once.
  glowId?: string;
  // The branches Hey Constela is talking about: they light up in gold while its answer shows.
  highlight?: ReadonlyArray<Branch | "own">;
  onSelect: (stepId: string) => void;
}) {
  const [tip, setTip] = useState<string | null>(null);
  const k = useTall() ? TALL : 1;
  const H = MAP_H * k;
  const at = (x: number, y: number) => ({ left: `${(x / MAP_W) * 100}%`, top: `${(y / H) * 100}%` });
  const placed = branches.map((b) => {
    const slot = SLOTS.indexOf(b.branch);
    const label = labelPosition(slot, b.nodes.length);
    return { ...b, slot, points: starPositions(slot, b.nodes.length).map(([x, y]) => [x, y * k] as [number, number]), label: { ...label, y: label.y * k } };
  });
  const tipNode = placed.flatMap((b) => b.nodes.map((n, k) => ({ id: `${b.branch}:${k}`, title: n.title, p: b.points[k] }))).find((n) => n.id === tip);
  const [cx, cy] = [CENTER[0], CENTER[1] * k];
  // The outer stars of neighbouring branches, joined by a faint line: the branches read as one larger figure.
  const rim = [...placed].sort((a, b) => a.slot - b.slot).map((b) => b.points.at(-1)!);

  return (
    // Wide screens: the figure sits in the middle of its picture, so a little zoom gives it the room around it.
    <div className="relative lg:scale-110 xl:scale-125" style={{ aspectRatio: `${MAP_W} / ${H}`, width: `min(100cqw, ${(MAP_W / H) * 100}cqh)` }}>
      <svg aria-hidden viewBox={`0 0 ${MAP_W} ${H}`} className="absolute inset-0 size-full overflow-visible">
        {DUST.map(([x, y, r, o], i) => (
          <circle key={i} cx={x * MAP_W} cy={y * H} r={r} fill="white" opacity={o} />
        ))}
        {rim.map(([x, y], i) => {
          const [nx, ny] = rim[(i + 1) % rim.length];
          return <line key={`rim-${i}`} x1={x} y1={y} x2={nx} y2={ny} stroke="white" strokeOpacity={0.1} strokeWidth={1} strokeDasharray="1 7" strokeLinecap="round" />;
        })}
        {placed.flatMap((b) =>
          satellites(b.slot, b.points, [cx, cy]).map(({ from, at: [x, y], r }, i) => (
            <g key={`sat-${b.branch}-${i}`}>
              <line x1={from[0]} y1={from[1]} x2={x} y2={y} stroke="white" strokeOpacity={0.16} strokeWidth={0.8} />
              <circle cx={x} cy={y} r={r} fill={b.status === "done" ? "var(--star)" : "white"} opacity={0.6} />
            </g>
          )),
        )}
        {/* From the person to each branch: gold once the branch has a lit star. */}
        {placed.map((b) => {
          const [x, y] = b.points[0];
          const started = b.nodes.some((n) => n.done);
          return (
            <line key={`root-${b.branch}`} x1={cx} y1={cy} x2={x} y2={y} stroke={started ? "var(--star)" : "white"} strokeOpacity={started ? 0.6 : 0.22}
              strokeWidth={1.5} strokeDasharray={started ? "4 5" : "2 6"} strokeLinecap="round" />
          );
        })}
        {placed.map((b) => (
          <g key={b.branch}>
            {/* The branch being worked on has a soft halo; one Constela is talking about glows gold. */}
            {(highlight.includes(b.branch) || b.status === "now") &&
              b.points.map(([x, y], k) => (
                <circle key={`halo-${k}`} cx={x} cy={y} r={highlight.includes(b.branch) ? 10 : 9} fill={highlight.includes(b.branch) ? "var(--star)" : "white"}
                  opacity={highlight.includes(b.branch) ? 0.2 : 0.06} className={highlight.includes(b.branch) ? "branch-glow" : undefined} />
              ))}
            {b.points.slice(1).map(([x, y], k) => {
              const [px, py] = b.points[k];
              const walked = (b.nodes[k].done && b.nodes[k + 1].done) || highlight.includes(b.branch);
              return (
                <line key={k} x1={px} y1={py} x2={x} y2={y} stroke={walked ? "var(--star)" : "white"} strokeOpacity={walked ? 0.85 : 0.3}
                  strokeWidth={walked ? 2 : 1.5} strokeDasharray={walked ? undefined : "2 4"} strokeLinecap="round" />
              );
            })}
            {b.nodes.map((n, k) => {
              const [x, y] = b.points[k];
              const glow = n.done && n.step?.id === glowId;
              return n.done ? (
                <g key={n.key} className={glow ? "star-lit" : undefined}>
                  {glow && <circle cx={x} cy={y} r={5} fill="none" stroke="var(--star)" strokeWidth="2" className="star-ring" />}
                  <circle cx={x} cy={y} r={9} fill="var(--star)" opacity={0.16} />
                  <path d={`M${x - 9} ${y}H${x + 9}M${x} ${y - 9}V${y + 9}`} stroke="var(--star)" strokeOpacity={0.55} strokeWidth={0.8} strokeLinecap="round" />
                  <circle cx={x} cy={y} r={4.5} fill="var(--star)" className="star-core" />
                </g>
              ) : (
                <g key={n.key}>
                  {n.step && n.step.id === currentId && <circle cx={x} cy={y} r={8.5} fill="none" stroke="white" strokeOpacity="0.85" strokeWidth="1.5" />}
                  <circle cx={x} cy={y} r={highlight.includes(b.branch) ? 3.4 : 2.8} fill={highlight.includes(b.branch) ? "var(--star)" : "white"} opacity={n.step ? 0.9 : 0.35} />
                </g>
              );
            })}
          </g>
        ))}
        {/* The person: the star every branch grows from. */}
        <circle cx={cx} cy={cy} r={16} fill="white" opacity={0.08} />
        <circle cx={cx} cy={cy} r={9} fill="none" stroke="white" strokeOpacity={0.7} strokeWidth={1.5} />
        <circle cx={cx} cy={cy} r={4} fill="white" />
      </svg>
      <span aria-hidden style={at(cx, cy)} className="voice-halo pointer-events-none absolute" />
      <p style={at(cx, cy + 26)} className="pointer-events-none absolute -translate-x-1/2 text-sm font-semibold text-white sm:text-base" aria-hidden>
        You
      </p>

      <ol aria-label={`Your plan has ${branches.length} branches`} className="absolute inset-0">
        {placed.map((b) => {
          const gaps = b.points.slice(1).map(([x, y], k) => Math.hypot(x - b.points[k][0], y - b.points[k][1]));
          // Targets are 44 px while stars are that far apart; a crowded branch gets smaller ones, never under 24 px.
          const size = `max(24px, min(44px, ${(Math.min(44, ...gaps) / MAP_W) * 100}cqw))`;
          const lit = b.nodes.filter((n) => n.done).length;
          return (
            <li key={b.branch} aria-labelledby={`map-${b.branch}`} className="pointer-events-none absolute inset-0 [container-type:inline-size]">
              <p
                id={`map-${b.branch}`}
                style={at(b.label.x, b.label.y)}
                className={cn(
                  "absolute max-w-[7.5rem] rounded bg-sky/80 px-1 text-sm leading-tight text-balance sm:max-w-[10rem] sm:text-base",
                  ALIGN_X[b.label.alignX],
                  ALIGN_Y[b.label.alignY],
                  highlight.includes(b.branch) ? "font-semibold text-star ring-1 ring-star/60" : b.status === "now" ? "font-semibold text-white" : b.status === "done" ? "text-star" : "text-white/80",
                )}
              >
                {branchName(b.branch)}
                <span className="sr-only">, {lit} of {b.nodes.length} steps done, {STATUS[b.status]}</span>
              </p>
              {b.nodes.map((n, k) => {
                if (!n.step) return null;
                const id = `${b.branch}:${k}`;
                const step = n.step;
                return (
                  <button
                    key={n.key}
                    type="button"
                    onClick={() => onSelect(step.id)}
                    onMouseEnter={() => setTip(id)}
                    onMouseLeave={() => setTip((t) => (t === id ? null : t))}
                    onFocus={() => setTip(id)}
                    onBlur={() => setTip((t) => (t === id ? null : t))}
                    aria-label={`${n.title}, ${n.done ? "done" : "not done"}`}
                    style={{ ...at(...b.points[k]), width: size }}
                    className="pointer-events-auto absolute aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full outline-none hover:bg-white/10 hover:ring-2 hover:ring-white/40 focus-visible:ring-3 focus-visible:ring-star"
                  />
                );
              })}
            </li>
          );
        })}
      </ol>

      {/* The step's name on hover or keyboard focus; on touch, a tap opens the step itself. */}
      {tipNode && (
        <p
          aria-hidden
          style={{ left: `clamp(6.5rem, ${(tipNode.p[0] / MAP_W) * 100}%, calc(100% - 6.5rem))`, top: `${((tipNode.p[1] - 14) / H) * 100}%` }}
          className="pointer-events-none absolute max-w-[12rem] -translate-x-1/2 -translate-y-full rounded-lg bg-card px-3 py-1.5 text-center text-sm text-card-foreground shadow-[0_6px_20px_-8px_rgb(0_0_0/0.6)]"
        >
          {tipNode.title}
        </p>
      )}
    </div>
  );
}
