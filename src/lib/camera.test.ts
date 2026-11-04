import { describe, expect, it } from "vitest";
import { NO_PALM, PALM_HOLD_MS, brightness, faceTension, framingTip, lightTip, palmStep, raisedPalm } from "@/lib/camera";

const frame = (r: number, g: number, b: number, pixels = 4) => new Uint8ClampedArray(Array.from({ length: pixels }, () => [r, g, b, 255]).flat());

describe("brightness", () => {
  it("goes from 0 for black to 1 for white, and weighs green the most, as the eye does", () => {
    expect(brightness(frame(0, 0, 0))).toBe(0);
    expect(brightness(frame(255, 255, 255))).toBeCloseTo(1);
    expect(brightness(frame(0, 255, 0))).toBeGreaterThan(brightness(frame(0, 0, 255)));
    expect(brightness(new Uint8ClampedArray())).toBe(0);
  });
});

describe("framingTip", () => {
  // A 640 x 480 picture; a face 160 px wide is a normal distance.
  const face = (cx: number, cy: number, w = 160) => ({ originX: cx - w / 2, originY: cy - w / 2, width: w, height: w });

  it("says the face is in the middle, or which way to move, as the person sees it mirrored", () => {
    expect(framingTip(face(320, 220), 640, 480)).toBe("Your face is in the middle.");
    // Near the camera's left edge: the person moves to their left.
    expect(framingTip(face(150, 220), 640, 480)).toBe("Move a little to your left.");
    expect(framingTip(face(500, 220), 640, 480)).toBe("Move a little to your right.");
    expect(framingTip(face(320, 80), 640, 480)).toMatch(/Tilt the camera up/);
    expect(framingTip(face(320, 380), 640, 480)).toMatch(/Tilt the camera down/);
  });

  it("asks to move closer or back, and says calmly when there is no face", () => {
    expect(framingTip(face(320, 240, 400), 640, 480)).toBe("Move back a little.");
    expect(framingTip(face(320, 240, 60), 640, 480)).toBe("Move a little closer.");
    expect(framingTip(null, 640, 480)).toMatch(/can't find your face/);
  });
});

describe("lightTip", () => {
  it("speaks only when the light gets in the way", () => {
    expect(lightTip(0.1)).toMatch(/not much light/);
    expect(lightTip(0.95)).toMatch(/very bright/);
    expect(lightTip(0.5)).toBeNull();
  });
});

describe("face tension and the raised palm", () => {
  it("averages the blendshapes that tighten with effort, and ignores the rest", () => {
    expect(faceTension([{ categoryName: "browDownLeft", score: 0.6 }, { categoryName: "mouthPressRight", score: 0.2 }, { categoryName: "eyeBlinkLeft", score: 1 }])).toBeCloseTo(0.4);
    expect(faceTension([{ categoryName: "eyeBlinkLeft", score: 1 }])).toBeNull();
  });

  it("knows a raised open palm from a lowered or closed hand", () => {
    expect(raisedPalm({ categoryName: "Open_Palm", score: 0.9 }, 0.4)).toBe(true);
    // The open-hand test photo: wrist low in the picture, palm high, a modest score. That is a raised palm.
    expect(raisedPalm({ categoryName: "Open_Palm", score: 0.67 }, 0.43)).toBe(true);
    expect(raisedPalm({ categoryName: "Open_Palm", score: 0.9 }, 0.9)).toBe(false);
    expect(raisedPalm({ categoryName: "Open_Palm", score: 0.4 }, 0.4)).toBe(false);
    expect(raisedPalm({ categoryName: "Closed_Fist", score: 0.9 }, 0.4)).toBe(false);
    expect(raisedPalm(undefined, undefined)).toBe(false);
  });

  it("needs the palm held for a moment, once, then rests", () => {
    let s = NO_PALM;
    const step = (palm: boolean, now: number) => {
      const r = palmStep(s, palm, now);
      s = r.state;
      return r.fire;
    };
    expect(step(true, 0)).toBe(false);
    expect(step(true, 1000)).toBe(false);
    expect(step(true, PALM_HOLD_MS)).toBe(true);
    // Still up: not again until it has rested.
    expect(step(true, PALM_HOLD_MS + 2000)).toBe(false);
    // A quick wave, put down before the hold: nothing.
    expect(step(false, 9000)).toBe(false);
    expect(step(true, 9100)).toBe(false);
    expect(step(false, 9500)).toBe(false);
    expect(step(true, 12000)).toBe(false);
    expect(step(true, 12000 + PALM_HOLD_MS)).toBe(true);
  });
});
