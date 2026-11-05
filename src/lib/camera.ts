// The camera in a video call practice: how much light the picture has, said as a calm tip. Everything happens
// in the browser; no picture is kept or sent.

// How bright an RGBA frame is, from 0 (black) to 1 (white): the average light the eye sees (Rec. 601).
export function brightness(rgba: Uint8ClampedArray): number {
  let sum = 0;
  for (let i = 0; i < rgba.length; i += 4) sum += 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
  return rgba.length ? sum / (rgba.length / 4) / 255 : 0;
}

// The face MediaPipe found, in pixels of the camera picture (not mirrored).
export type FaceBox = { originX: number; originY: number; width: number; height: number };

// Where the face sits, as one calm tip about the camera, never about the person.
export function framingTip(box: FaceBox | null, width: number, height: number): string {
  if (!box || !width || !height) return "Constela can't find your face in the picture.";
  const x = (box.originX + box.width / 2) / width;
  const y = (box.originY + box.height / 2) / height;
  const size = box.width / width;
  if (size > 0.55) return "Move back a little.";
  if (size < 0.15) return "Move a little closer.";
  // The camera's left is the person's right, and the picture shows mirrored: they move toward their other side.
  if (x < 0.38) return "Move a little to your left.";
  if (x > 0.62) return "Move a little to your right.";
  if (y < 0.25) return "Your face is near the top. Tilt the camera up a little.";
  if (y > 0.65) return "Your face is near the bottom. Tilt the camera down a little.";
  return "Your face is in the middle.";
}

// A tip only when the light gets in the way; null when the picture is fine.
export function lightTip(level: number): string | null {
  if (level < 0.22) return "There is not much light. Try facing a window or a lamp.";
  if (level > 0.85) return "The picture is very bright. Try moving away from the strongest light.";
  return null;
}

// "I need a moment" by raising an open hand: the palm has to stay up for PALM_HOLD_MS, so a quick wave or a movement
// the person did not choose (a tic, for example) never sets it off. Then it waits PALM_REST_MS before it can again.
export const PALM_HOLD_MS = 1500;
export const PALM_REST_MS = 5000;
export type PalmState = { since: number | null; last: number };
export const NO_PALM: PalmState = { since: null, last: -Infinity };

// An open palm, held up: MediaPipe's "Open_Palm" gesture, with the middle of the palm (hand landmark 9) in the upper
// part of the picture. Not the wrist: on a webcam a hand raised beside the face often has its wrist near the bottom
// or out of view (a test photo of an open palm: palm at 0.43, wrist at 0.82, Open_Palm 0.67).
export function raisedPalm(gesture: { categoryName: string; score: number } | undefined, palmY: number | undefined): boolean {
  return gesture?.categoryName === "Open_Palm" && gesture.score >= 0.5 && palmY !== undefined && palmY < 0.8;
}

export function palmStep(state: PalmState, palm: boolean, now: number): { state: PalmState; fire: boolean } {
  if (!palm) return { state: { ...state, since: null }, fire: false };
  const since = state.since ?? now;
  if (now - since >= PALM_HOLD_MS && now - state.last >= PALM_REST_MS) return { state: { since: null, last: now }, fire: true };
  return { state: { ...state, since }, fire: false };
}
