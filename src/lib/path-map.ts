// The map in My plan: every branch as a constellation that grows out of one star in the middle, the person.
// Pure, so it can be tested without a browser.
import { BRANCH_STEPS, branchComplete, branchName, currentBranch } from "@/lib/path";
import { BRANCHES, stepKey, type Branch, type Plan, type PlanStep } from "@/lib/plan";

export type MapNode = {
  key: string;
  title: string;
  done: boolean;
  // The plan step behind the star, so it can be opened. Missing for a branch whose steps were all removed.
  step?: PlanStep;
};
export type MapBranch = { branch: Branch | "own"; status: "done" | "now" | "open"; nodes: MapNode[] };

// A kind counts once: a step broken into smaller ones is one star, lit when the last one is done. The kind still
// waiting wins; otherwise the latest done copy (an earlier round's star stays lit).
function nodesOf(steps: PlanStep[]): MapNode[] {
  const byKind = new Map<string, PlanStep>();
  for (const s of steps) {
    const kind = stepKey(s.id);
    const prev = byKind.get(kind);
    if (!prev || (prev.done && (!s.done || (s.doneAt ?? "") >= (prev.doneAt ?? "")))) byKind.set(kind, s);
  }
  return [...byKind].map(([key, step]) => ({ key, title: step.title, done: step.done, step }));
}

// The person's own steps can be many; the map shows the last few, the lists below show them all.
const OWN_SHOWN = 6;

export function pathMap(plan: Plan): MapBranch[] {
  const now = currentBranch(plan);
  const branches: MapBranch[] = BRANCHES.map((branch) => {
    const nodes = nodesOf(plan.steps.filter((s) => s.stage === branch));
    return {
      branch,
      status: branchComplete(plan, branch) ? "done" : branch === now ? "now" : "open",
      // A branch whose steps were all removed keeps its stars, unlit and closed, so the map keeps its shape.
      nodes: nodes.length ? nodes : BRANCH_STEPS[branch].map((def) => ({ key: def.id, title: def.title, done: false })),
    };
  });
  const own = nodesOf(plan.steps.filter((s) => !s.stage)).slice(-OWN_SHOWN);
  if (!own.length) return branches;
  return [...branches, { branch: "own", status: now === "own" ? "now" : own.every((n) => n.done) ? "done" : "open", nodes: own }];
}

// The branches a text names, by their name or one of their steps: what Hey Constela is talking about.
export function branchesIn(text: string, map: MapBranch[]): Array<Branch | "own"> {
  const t = text.toLowerCase();
  return map.filter((b) => [branchName(b.branch), ...b.nodes.map((n) => n.title)].some((name) => t.includes(name.toLowerCase()))).map((b) => b.branch);
}

// Wider than tall: the sideways arms need room for their names.
export const MAP_W = 520;
export const MAP_H = 400;
export const CENTER: readonly [number, number] = [260, 200];
// Eight arms, clockwise from the top. Long branches get the long arms (up and down), short ones the sideways arms.
export const SLOTS: ReadonlyArray<Branch | "own"> = ["setup", "documents", "learn", "interview", "apply", "experience", "search", "own"];
const R0 = 46; // the first star of every arm, just outside the center star
// How far each arm reaches. Names sit past the last star, so arms stop early enough for a two-line name to fit
// inside the sky even on a phone, where text is large next to the map.
const REACH = [120, 115, 80, 115, 120, 115, 80, 115];

const angleOf = (slot: number) => ((-90 + slot * 45) * Math.PI) / 180;
const gapOf = (slot: number, count: number) => Math.min(30, (REACH[slot] - R0) / Math.max(1, count - 1));

// Positions of one arm's stars in map units, from the center outward with a small wave, so arms look hand-drawn.
export function starPositions(slot: number, count: number): Array<[number, number]> {
  const a = angleOf(slot);
  const gap = gapOf(slot, count);
  return Array.from({ length: count }, (_, k) => {
    const r = R0 + k * gap;
    const wave = (k % 2 ? 7 : -7) * (slot % 2 ? 1 : -1);
    return [CENTER[0] + r * Math.cos(a) - wave * Math.sin(a), CENTER[1] + r * Math.sin(a) + wave * Math.cos(a)];
  });
}

export type Label = { x: number; y: number; alignX: "start" | "center" | "end"; alignY: "start" | "center" | "end" };

// Where an arm's name goes: just past its last star, growing away from the center, so it never covers a star.
export function labelPosition(slot: number, count: number): Label {
  const a = angleOf(slot);
  const r = R0 + gapOf(slot, count) * Math.max(0, count - 1) + 16;
  const [cos, sin] = [Math.cos(a), Math.sin(a)];
  const side = (v: number) => (v > 0.3 ? "start" : v < -0.3 ? "end" : "center");
  return { x: CENTER[0] + r * cos, y: CENTER[1] + r * sin, alignX: side(cos), alignY: side(sin) };
}
