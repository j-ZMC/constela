import { describe, expect, it } from "vitest";
import { fillToday } from "@/lib/path";
import { CENTER, MAP_H, MAP_W, SLOTS, branchesIn, labelPosition, pathMap, starPositions } from "@/lib/path-map";
import { BRANCHES, addSteps, completeStep, removeStep, starterPlan } from "@/lib/plan";

const now = new Date(2026, 9, 29, 10);
const fresh = () => fillToday(starterPlan(), now);

describe("pathMap", () => {
  it("shows every branch, with the one to work on now", () => {
    const map = pathMap(fresh());
    expect(map.map((b) => b.branch)).toEqual([...BRANCHES]);
    expect(map.find((b) => b.status === "now")?.branch).toBe("setup");
    expect(map.find((b) => b.branch === "apply")?.nodes).toHaveLength(5);
  });

  it("lights a star when its step is done, and marks a finished branch", () => {
    let plan = fresh();
    for (const id of ["starter-profile", "path-conditions", "path-wants", "path-cv"]) plan = completeStep(plan, id, now);
    const setup = pathMap(plan).find((b) => b.branch === "setup")!;
    expect(setup.status).toBe("done");
    expect(setup.nodes.every((n) => n.done)).toBe(true);
  });

  it("adds the person's own steps as their own arm, only when there are some", () => {
    expect(pathMap(fresh()).some((b) => b.branch === "own")).toBe(false);
    const plan = addSteps(fresh(), [{ title: "Call Ana", minutes: 5 }], "user");
    expect(pathMap(plan).at(-1)).toMatchObject({ branch: "own", nodes: [{ title: "Call Ana", done: false }] });
  });

  it("keeps a branch's shape when its steps were removed", () => {
    let plan = fresh();
    for (const id of ["path-learn-look", "path-learn-start"]) plan = removeStep(plan, id);
    const learn = pathMap(plan).find((b) => b.branch === "learn")!;
    expect(learn.nodes.map((n) => n.key)).toEqual(["path-learn-look", "path-learn-start"]);
    expect(learn.nodes.every((n) => n.step === undefined)).toBe(true);
  });
});

describe("star positions", () => {
  it("puts every branch on its own arm, growing out of the center, inside the map", () => {
    expect(SLOTS).toHaveLength(8);
    expect(new Set(SLOTS).size).toBe(8);
    for (let slot = 0; slot < SLOTS.length; slot++) {
      const points = starPositions(slot, 6);
      const dist = points.map(([x, y]) => Math.hypot(x - CENTER[0], y - CENTER[1]));
      // Each star is farther out than the one before it.
      dist.slice(1).forEach((d, k) => expect(d).toBeGreaterThan(dist[k]));
      for (const [x, y] of points) {
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThan(MAP_W);
        expect(y).toBeGreaterThan(0);
        expect(y).toBeLessThan(MAP_H);
      }
    }
  });

  it("names each arm past its last star, growing outward", () => {
    const top = labelPosition(SLOTS.indexOf("setup"), 4);
    expect(top).toMatchObject({ alignX: "center", alignY: "end" });
    expect(top.y).toBeLessThan(starPositions(0, 4).at(-1)![1]);
    const right = labelPosition(SLOTS.indexOf("learn"), 2);
    expect(right).toMatchObject({ alignX: "start", alignY: "center" });
    expect(right.x).toBeGreaterThan(starPositions(2, 2).at(-1)![0]);
    expect(labelPosition(SLOTS.indexOf("search"), 3).alignX).toBe("end");
  });
});

describe("branchesIn", () => {
  it("finds the branches an answer names, by name or by one of their steps", () => {
    const map = pathMap(fresh());
    expect(branchesIn('You are working on "Set up your profile".', map)).toEqual(["setup"]);
    expect(branchesIn("Next, practice one interview question. Then Find jobs.", map)).toEqual(expect.arrayContaining(["search"]));
    expect(branchesIn("Take a short break.", map)).toEqual([]);
  });
});
