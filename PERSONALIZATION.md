# Personalization

By Regina, adapted into the app. Everything is saved on the device only (localStorage keys `pz` and `pz-boot`). With the default values nothing is applied and the app looks unchanged.

| File | What it does |
|---|---|
| `src/lib/personalization.ts` | Preferences, color presets, contrast checks, `compute()` (CSS variables) and applying them to `<html>`. `cleanPrefs()` validates what comes back from storage |
| `src/lib/personalization.test.ts` | Tests (`npm test`), including "every preset passes contrast" |
| `src/components/personalization-panel.tsx` | The "Personalize" panel: Colors, Text, Cursor, Icons & controls, Information, Experience |
| `src/app/globals.css` | Last block: rules that only act when `<html>` has `data-pz*` or `.focus-strong` |
| `src/app/layout.tsx` | The before-paint script also restores `pz-boot` (only CSS variables and `data-pz*` attributes) |
| `src/components/site-nav.tsx` | "Personalize" replaces the old "Reading" panel; nav labels and icons carry `data-pz-label` / `data-pz-icon` |

## Amount of information
Mark content hidden in the reduced view with `data-detail="extra"`. My plan already marks its hints this way. `data-detail="full"` (shown only in a full view) is supported in CSS, but the panel offers only Reduced and Comfortable until a screen marks content as full.

## Colors
The roles (background, text, cards, borders, accent, soft areas) override the shadcn tokens (`--background`, `--primary`, ...) inline on `<html>`. The old Reading options live here now: OpenDyslexic and size in Text, Reduce motion in Experience, and Calm as a color preset.

## Soft light, Calm mode, Slower AI voice
- **Soft light** (Colors, levels 1 to 3): `softLight()` mixes the background, cards, soft areas and borders toward a warm brown, and lowers the amount until every `checkContrast()` row passes. A palette that already fails stays as it is. A page cannot change the screen's real brightness.
- **Calm mode** (Experience): sets `data-pz-calm` on `<html>`. `globals.css` turns off animations and transitions and hides the glows (`.voice-halo`, `.star-ring`, `.sky-trail`, gold rings). `calmMode()` lets code check it: Hey Constela then answers in text only. Voices the person chose (Talk, Write and listen) still speak.
- **Slower AI voice** (Experience): `voiceSpeed()` gives 0.8 instead of 0.95, sent to `/api/interview/speak` as `speed` and used as the browser voice's rate.
- "What is hard for you?" in the Profile can turn these on (`src/lib/help-picks.ts`).

## Stars and the sky
- Each preset is designed as a whole in `PRESETS`: page colors, a `sky` (menu bar, page headers, My plan) darker than the page, and a `star` color that belongs with that sky and stands out on it (4.5:1 or more, tested). Light (white, royal blue, gold) is its own palette, not the default with a white page.
- **Stars** is a color cell in Colors (`--star`), checked against the sky ("Stars against the menu and sky", 3:1). The sky is not a cell; a custom palette without one gets `skyFor()` from its accent.
- Palettes saved before Stars existed load with the default stars (`cleanRoles`).
