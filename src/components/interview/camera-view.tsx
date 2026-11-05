"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NO_PALM, brightness, framingTip, lightTip, palmStep, raisedPalm, type FaceBox } from "@/lib/camera";
import { cn } from "@/lib/utils";

// How often the light is checked, on a tiny copy of the picture.
const CHECK_MS = 2000;
// MediaPipe's program, the same version as package.json. Its 29 MB are not copied into the app.
const MEDIAPIPE_WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm";

// The person's camera in a video call practice, like a meeting app: their picture in a tile, mirrored, that they
// can hide (seeing yourself tires many people) or turn off. Nothing is recorded or sent; the picture only shows here.
// `check`: before the call, also show where to put the camera.
// `on` and `hidden` given: the meeting's control bar runs the camera, so the tile shows only the picture.
// In the call: `onPalm` when the person holds up an open hand ("I need a moment"). It reads the picture on this device
// and keeps nothing. Facial expressions are not read: they can misread people whose expression differs.
export function CameraView({
  check = false,
  on: onProp,
  hidden: hiddenProp,
  onPalm,
}: {
  check?: boolean;
  on?: boolean;
  hidden?: boolean;
  onPalm?: () => void;
}) {
  const controlled = onProp !== undefined;
  const video = useRef<HTMLVideoElement>(null);
  const [onState, setOn] = useState(true);
  const [hiddenState, setHidden] = useState(false);
  const on = onProp ?? onState;
  const hidden = hiddenProp ?? hiddenState;
  const [status, setStatus] = useState<"starting" | "on" | "off" | "error">("starting");
  const [tip, setTip] = useState<string | null>(null);
  // "Your camera is off" is said once, never again in this practice.
  const [toldOff, setToldOff] = useState(false);

  useEffect(() => {
    if (!on) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let stopped = false;
    const goneOff = () => {
      if (stopped) return;
      setStatus("off");
      setToldOff(true);
    };
    // One retry: going from the preview into the call, the camera may still be closing ("device not found" or "in use").
    const open = () => navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false });
    const wait = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));
    // A short wait first: a component mounted twice in a row (React's strict mode in development) must not open the
    // camera twice at once; closing one of two opens at once can end the camera for the whole page.
    wait(50)
      .then(() => (stopped ? Promise.reject(new Error("stopped")) : open()))
      .catch(() => (stopped ? Promise.reject(new Error("stopped")) : wait(600).then(open)))
      .then((s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        const [track] = s.getVideoTracks();
        // The browser or another app can take the camera away: say so calmly, once.
        track.addEventListener("ended", goneOff);
        track.addEventListener("mute", goneOff);
        track.addEventListener("unmute", () => !stopped && setStatus("on"));
        if (video.current) video.current.srcObject = s;
        setStatus("on");
        if (controlled) return;
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 48;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        timer = setInterval(() => {
          if (!ctx || !video.current || video.current.readyState < 2) return;
          ctx.drawImage(video.current, 0, 0, canvas.width, canvas.height);
          setTip(lightTip(brightness(ctx.getImageData(0, 0, canvas.width, canvas.height).data)));
        }, CHECK_MS);
      })
      .catch(() => !stopped && setStatus("error"));
    return () => {
      stopped = true;
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop()); // the camera light goes off right away
    };
  }, [on, controlled]);

  // Before the call: MediaPipe finds the face in the picture, on this device, once a second. Its program comes from
  // a public website the first time; the picture itself never leaves the browser.
  const [framing, setFraming] = useState<string | null>(null);
  useEffect(() => {
    if (!check || status !== "on") return;
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let detector: { detectForVideo: (v: HTMLVideoElement, t: number) => { detections: { boundingBox?: FaceBox }[] }; close: () => void } | undefined;
    (async () => {
      try {
        const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
        const files = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
        const made = await FaceDetector.createFromOptions(files, {
          baseOptions: { modelAssetPath: "/models/blaze_face_short_range.tflite", delegate: "CPU" },
          runningMode: "VIDEO",
        });
        if (stopped) return made.close();
        detector = made;
        timer = setInterval(() => {
          const v = video.current;
          if (!v || v.readyState < 2 || !detector) return;
          const box = detector.detectForVideo(v, performance.now()).detections[0]?.boundingBox ?? null;
          setFraming(framingTip(box, v.videoWidth, v.videoHeight));
        }, 1000);
      } catch {
        // Without the face finder, the written advice below is still there.
        setFraming(null);
      }
    })();
    return () => {
      stopped = true;
      clearInterval(timer);
      detector?.close();
    };
  }, [check, status]);

  // The newest callback, so a re-render does not restart MediaPipe.
  const palmRef = useRef(onPalm);
  useEffect(() => {
    palmRef.current = onPalm;
  });
  const wantsPalm = Boolean(onPalm);
  // Shown on the tile while an open hand is up, so the person knows the camera sees it.
  const [palmSeen, setPalmSeen] = useState(false);

  // In the call: MediaPipe's Gesture Recognizer (Apache 2.0), on this device, 2.5 times a second.
  useEffect(() => {
    if (status !== "on" || !wantsPalm) return;
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let hands: Awaited<ReturnType<typeof import("@mediapipe/tasks-vision").GestureRecognizer.createFromOptions>> | undefined;
    (async () => {
      try {
        const { FilesetResolver, GestureRecognizer } = await import("@mediapipe/tasks-vision");
        const files = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
        const made = await GestureRecognizer.createFromOptions(files, {
          baseOptions: { modelAssetPath: "/models/gesture_recognizer.task", delegate: "CPU" },
          runningMode: "VIDEO",
          numHands: 1,
        });
        if (stopped) return made.close();
        hands = made;
        let palm = NO_PALM;
        timer = setInterval(() => {
          const v = video.current;
          if (!v || v.readyState < 2 || !hands) return;
          const now = performance.now();
          const seen = hands.recognizeForVideo(v, now);
          const step = palmStep(palm, raisedPalm(seen.gestures[0]?.[0], seen.landmarks[0]?.[9]?.y), now);
          palm = step.state;
          setPalmSeen(palm.since !== null);
          if (step.fire) palmRef.current?.();
        }, 400);
      } catch {
        // Without MediaPipe, the buttons still do the same.
      }
    })();
    return () => {
      stopped = true;
      clearInterval(timer);
      hands?.close();
    };
  }, [status, wantsPalm]);

  function turn(next: boolean) {
    setOn(next);
    setTip(null);
    setStatus(next ? "starting" : "off");
    if (!next) setToldOff(true);
  }

  const live = on && status === "on";
  const message =
    status === "error"
      ? "Constela can't use the camera. Allow it in your browser, or practice without it."
      : !on || status === "off"
        ? "Your camera is off."
        : hidden
          ? controlled
            ? "Hidden from you"
            : "You are hidden from yourself. Your camera is still on."
          : "Starting the camera.";
  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-sky text-white shadow-[0_4px_16px_-6px_rgb(0_0_0/0.6)]">
        {/* Mirrored, as people expect to see themselves. Kept mounted so hiding does not restart the camera. */}
        <video ref={video} autoPlay muted playsInline aria-label="Your camera" className={cn("size-full -scale-x-100 object-cover", (!live || hidden) && "invisible")} />
        {(!live || hidden) && (
          <p className={cn("absolute inset-0 grid place-items-center px-3 text-center text-white/80", controlled ? "text-xs sm:text-sm" : "text-sm")}>{message}</p>
        )}
        <span className="absolute bottom-1.5 left-1.5 rounded bg-black/50 px-1.5 py-0.5 text-xs sm:text-sm">You</span>
        {live && palmSeen && (
          <span role="status" className="absolute inset-x-1.5 top-1.5 rounded bg-black/65 px-1.5 py-0.5 text-center text-xs sm:text-sm">
            Hand seen. Keep it up to pause.
          </span>
        )}
      </div>

      {!controlled && (
        <>
          <div className="flex flex-wrap gap-2">
            {live && (
              <Button type="button" variant="outline" size="touch" onClick={() => setHidden((h) => !h)}>
                {hidden ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
                {hidden ? "Show me" : "Hide me"}
              </Button>
            )}
            {status !== "error" && (
              <Button type="button" variant="outline" size="touch" onClick={() => turn(!on)}>
                {on ? <VideoOff aria-hidden /> : <Video aria-hidden />}
                {on ? "Turn camera off" : "Turn camera on"}
              </Button>
            )}
          </div>
          <div aria-live="polite" className="flex flex-col gap-1 text-sm text-muted-foreground">
            {toldOff && !live && <p>Your camera is off. That is okay if you prefer it.</p>}
            {live && tip && <p>{tip}</p>}
            {check && live && framing && <p className="font-medium text-foreground">{framing}</p>}
            {check && live && <p>Put the camera at the height of your eyes. Keep your face in the middle, with your shoulders in view.</p>}
          </div>
        </>
      )}
    </div>
  );
}
