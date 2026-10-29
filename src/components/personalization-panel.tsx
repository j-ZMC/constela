"use client";

import { useState } from "react";
import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_PREFS, DEFAULT_ROLES, PRESETS, ROLE_LABELS, applyPrefs, checkContrast, loadPrefs, savePrefs,
  type Prefs, type Roles,
} from "@/lib/personalization";
import { setReadingOption } from "@/lib/reading";

const TABS = [
  ["colors", "Colors"], ["text", "Text"], ["cursor", "Cursor"], ["icons", "Icons & controls"], ["detail", "Information"], ["use", "Experience"],
] as const;
type Tab = (typeof TABS)[number][0];

// 44px targets, like every other control in the app.
const tap = "h-11 px-4 text-base";
const field = "h-11 rounded-lg border border-input bg-background px-3 text-base";

function Choice<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map(([v, text]) => (
        <Button key={v} type="button" className={tap} variant={value === v ? "default" : "outline"} aria-pressed={value === v} onClick={() => onChange(v)}>
          {text}
        </Button>
      ))}
    </div>
  );
}

function Slider({ id, label, value, min, max, step, shown, onChange }: { id: string; label: string; value: number; min: number; max: number; step: number; shown: string; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}: <span className="font-normal text-muted-foreground">{shown}</span></Label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="h-11 w-full accent-primary" />
    </div>
  );
}

export function PersonalizationPanel() {
  const [p, setP] = useState<Prefs>(DEFAULT_PREFS);
  const [tab, setTab] = useState<Tab>("colors");
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState("");
  const [rm, setRm] = useState(false);

  function update(next: Partial<Prefs>) {
    const n = { ...p, ...next };
    setP(n);
    applyPrefs(n);
    savePrefs(n);
  }

  const roles: Roles = p.colors ?? DEFAULT_ROLES;
  const checks = p.colors ? checkContrast(p.colors) : [];
  const setRole = (k: keyof Roles, v: string) => update({ colors: { ...roles, [k]: v }, preset: "custom" });
  const choosePreset = (id: string, colors: Roles | null) => update({ colors, preset: id });

  function setFont(font: Prefs["font"]) {
    setReadingOption("dyslexic", font === "dyslexic"); // reuses the existing "Reading" mechanism
    update({ font });
  }

  function resetAll() {
    setReadingOption("dyslexic", false);
    setReadingOption("reduce-motion", false);
    setReadingOption("calm", false); // no longer has its own toggle, so a saved value must not stay stuck
    setReadingOption("text-large", false);
    setRm(false);
    update({ ...DEFAULT_PREFS, saved: p.saved }); // saved color presets are kept
  }

  return (
    <Dialog onOpenChange={(open) => {
      if (!open) return;
      setRm(document.documentElement.classList.contains("reduce-motion"));
      const l = loadPrefs();
      // The "Reading" panel can also toggle OpenDyslexic, so trust <html>
      const dys = document.documentElement.classList.contains("dyslexic");
      setP({ ...l, font: dys ? "dyslexic" : l.font === "dyslexic" ? "default" : l.font });
    }}>
      <DialogTrigger render={<Button data-tour="personalize" variant="outline" size="sm" />}>
        <Palette aria-hidden data-pz-icon />
        <span data-pz-label>Personalize</span>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Personalize</DialogTitle>
          <DialogDescription>Every option is independent and optional. Nothing is shared; it is saved on this device.</DialogDescription>
        </DialogHeader>

        <div role="tablist" aria-label="Categories" className="flex flex-wrap gap-2">
          {TABS.map(([id, text]) => (
            <Button key={id} role="tab" type="button" className={tap} variant={tab === id ? "secondary" : "ghost"} aria-selected={tab === id} onClick={() => setTab(id)}>
              {text}
            </Button>
          ))}
        </div>

        <div role="tabpanel" className="flex flex-col gap-4">
          {tab === "colors" && (
            <>
              <div className="flex flex-wrap gap-2">
                {[...PRESETS, ...p.saved].map((s) => (
                  <Button key={s.id} type="button" className={tap} variant={p.preset === s.id ? "default" : "outline"} aria-pressed={p.preset === s.id} onClick={() => choosePreset(s.id, s.colors)}>
                    {s.name}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(ROLE_LABELS) as (keyof Roles)[]).map((k) => (
                  <Label key={k} htmlFor={`pz-${k}`} className="flex items-center gap-2">
                    <input id={`pz-${k}`} type="color" value={roles[k]} onChange={(e) => setRole(k, e.target.value)} className="h-11 w-14 rounded border border-input bg-background" />
                    {ROLE_LABELS[k]}
                  </Label>
                ))}
              </div>
              <ul aria-live="polite" className="flex flex-col gap-1 text-sm">
                {checks.map((c) => (
                  <li key={c.label}>{c.ok ? "OK" : "Low contrast"} · {c.label}: {c.ratio.toFixed(1)}:1 (needs {c.min}:1)</li>
                ))}
              </ul>
              <div className="rounded-xl border bg-card p-4 text-card-foreground">
                <p className="font-semibold">Preview</p>
                <p className="text-sm text-muted-foreground">Text, cards, borders and buttons update as you choose.</p>
                <Button className={`${tap} mt-2`} type="button">Sample button</Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input aria-label="Name for a new preset" placeholder="Preset name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 max-w-48 text-base" />
                <Button type="button" className={tap} variant="outline" disabled={!p.colors || !name.trim()} onClick={() => { const id = `u-${Date.now()}`; update({ saved: [...p.saved, { id, name: name.trim(), colors: roles }], preset: id }); setName(""); }}>
                  Save as preset
                </Button>
                <Button type="button" className={tap} variant="ghost" onClick={() => update({ colors: null, preset: "astralis" })}>Reset colors</Button>
              </div>
              {p.saved.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {p.saved.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-2">
                      <Input aria-label={`Name of preset ${s.name}`} defaultValue={s.name} className="h-11 max-w-48 text-base"
                        onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.name) update({ saved: p.saved.map((x) => (x.id === s.id ? { ...x, name: v } : x)) }); }} />
                      {confirm === s.id ? (
                        <>
                          <Button type="button" className={tap} onClick={() => { update({ saved: p.saved.filter((x) => x.id !== s.id), ...(p.preset === s.id ? { preset: "custom" } : {}) }); setConfirm(""); }}>Yes, delete</Button>
                          <Button type="button" className={tap} variant="ghost" onClick={() => setConfirm("")}>No</Button>
                        </>
                      ) : (
                        <Button type="button" className={tap} variant="ghost" aria-label={`Delete preset ${s.name}`} onClick={() => setConfirm(s.id)}>Delete</Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {tab === "text" && (
            <>
              <Label htmlFor="pz-font" className="flex flex-col items-start gap-1">Font
                <select id="pz-font" className={field} value={p.font} onChange={(e) => setFont(e.target.value as Prefs["font"])}>
                  <option value="default">Default (Atkinson Hyperlegible)</option>
                  <option value="system">System sans-serif</option>
                  <option value="verdana">Verdana</option>
                  <option value="dyslexic">OpenDyslexic</option>
                </select>
              </Label>
              <Slider id="pz-size" label="Text size" value={p.size} min={90} max={150} step={5} shown={`${p.size}%`} onChange={(size) => update({ size })} />
              <Slider id="pz-lh" label="Line spacing" value={p.lh || 1.5} min={1.2} max={2.2} step={0.1} shown={p.lh ? String(p.lh) : "default"} onChange={(lh) => update({ lh })} />
              <Slider id="pz-ls" label="Letter spacing" value={p.ls} min={0} max={0.15} step={0.01} shown={p.ls ? `${p.ls}em` : "default"} onChange={(ls) => update({ ls })} />
              <Slider id="pz-w" label="Text block width" value={p.width || 70} min={40} max={90} step={5} shown={p.width ? `${p.width} characters` : "default"} onChange={(width) => update({ width })} />
              <div><Button type="button" className={tap} variant="ghost" onClick={() => { setReadingOption("dyslexic", false); update({ font: "default", size: 100, lh: 0, ls: 0, width: 0 }); }}>Reset text</Button></div>
            </>
          )}

          {tab === "cursor" && (
            <>
              <p className="text-sm font-medium">Cursor size</p>
              <Choice label="Cursor size" value={p.cursor} onChange={(cursor) => update({ cursor })} options={[["default", "Default"], ["large", "Large"], ["xlarge", "Extra large"]]} />
              <p className="text-sm font-medium">Cursor color</p>
              <Choice label="Cursor color" value={p.cursorColor} onChange={(cursorColor) => update({ cursorColor })} options={[["black", "Black"], ["white", "White"]]} />
            </>
          )}

          {tab === "icons" && (
            <>
              <p className="text-sm font-medium">Navigation shows</p>
              <Choice label="Navigation shows" value={p.icons} onChange={(icons) => update({ icons })} options={[["both", "Icons and labels"], ["icons", "Icons only"], ["text", "Text only"]]} />
              <Slider id="pz-icon" label="Icon size" value={p.iconSize || 20} min={16} max={32} step={2} shown={p.iconSize ? `${p.iconSize}px` : "default"} onChange={(iconSize) => update({ iconSize })} />
              <Slider id="pz-ctl" label="Control height" value={p.ctlSize || 32} min={32} max={56} step={4} shown={p.ctlSize ? `${p.ctlSize}px` : "default"} onChange={(ctlSize) => update({ ctlSize })} />
              <div><Button type="button" className={tap} variant="ghost" onClick={() => update({ icons: "both", iconSize: 0, ctlSize: 0 })}>Reset icons & controls</Button></div>
            </>
          )}

          {tab === "detail" && (
            <>
              {/* shortcut: "full" has no content marked yet, so only two choices are offered; add it back when screens mark data-detail="full". */}
              <Choice label="Amount of information" value={p.detail === "full" ? "comfortable" : p.detail} onChange={(detail) => update({ detail })} options={[["reduced", "Reduced: essentials only"], ["comfortable", "Comfortable"]]} />
              <p className="text-sm text-muted-foreground">Reduced hides extra hints and tips, so each screen shows only what you need to do.</p>
            </>
          )}

          {tab === "use" && (
            <>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="pz-focus" className="flex flex-col items-start gap-0.5"><span>Stronger keyboard focus</span><span className="text-sm font-normal text-muted-foreground">A thicker outline on the element you are on</span></Label>
                <Switch id="pz-focus" aria-label="Stronger keyboard focus" checked={p.focus} onCheckedChange={(focus) => update({ focus })} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="pz-motion" className="flex flex-col items-start gap-0.5"><span>Reduce motion</span><span className="text-sm font-normal text-muted-foreground">Remove movement and transitions</span></Label>
                <Switch id="pz-motion" aria-label="Reduce motion" checked={rm} onCheckedChange={(on) => { setRm(on); setReadingOption("reduce-motion", on); }} />
              </div>
              <div><Button type="button" className={tap} variant="outline" onClick={resetAll}>Reset all personalization</Button></div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
