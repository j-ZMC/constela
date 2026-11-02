# Constela design rules

Read this before building or changing any screen. The goal: every screen, whoever builds it, looks and behaves like one calm app for neurodivergent young adults looking for a job. When a rule here and your habit disagree, the rule wins; when this file is missing something, ask the team and add it here.

## What Constela should feel like

- **Calm and adult.** Never childish, never alarming. No red, no "overdue", no streaks, no confetti.
- **One thing at a time.** Each screen has one main action. Everything else waits behind a disclosure or on another page. (Kairos: users get distracted by tasks that don't matter yet.)
- **Needs, never diagnoses.** The UI never shows or asks for a diagnosis (ADHD, autism, OCD…). We talk about situations: noise, changes of plan, long texts.
- **A night sky.** Steps are stars; a lit star (star gold) means something was done. The constellation is the one visual idea that is ours.

## Colors

Use the tokens in `src/app/globals.css`, never raw Tailwind colors (`amber-50`, `red-600`…).

| Token | Use |
|---|---|
| `bg-background` (mint `#e7f0ed`) | Page background |
| `bg-card` (white) | Cards and form surfaces |
| `text-foreground` / `bg-primary` (navy `#243b53`) | Text, the one filled button, selected tabs |
| `text-muted-foreground` | Secondary text (5:1 on mint) |
| `bg-secondary` | Soft areas, notes, hover |
| `border-destructive` (terracotta) | "Check this" notes, as a thin border. Never a filled red block |
| `--star` (peach `#f2b880`) | Only for achievements: lit stars, the logo spark. Never for text (1.8:1) |
| `bg-sky` (navy) | The constellation sky and the intro |

Personalize can override these with presets; build with tokens and it just works.

## Layout and widths

| Kind of page | Width | Examples |
|---|---|---|
| Task (one flow, forms, reading) | `max-w-xl` | Profile, My plan, Privacy |
| Browse (lists of results) | `max-w-3xl` | Jobs |
| Header and shell | `max-w-5xl` | `site-nav.tsx` |
| Intro card | `max-w-md` | `/` |

Never wider than the header. Pages use `mx-auto w-full px-4 py-10`.

**The page sky.** App pages open with `PageSky` (`src/components/page-sky.tsx`): the intro's night sky, still, edge to edge, with the `h1` and one line of text in it. Text on it is white (`text-white/80` for secondary), buttons on it add `onSky`, and the content below starts with `py-8`. My plan lets the current step rise into the sky (`-mt-8`). The intro keeps its full-screen sky. Wide screens show faint gray real constellations in the margins (`MarginSky`); content must not cover them.

Spacing: `gap-8` between sections, `gap-5` inside a card, `gap-3` between related controls.

## Type

Atkinson Hyperlegible for everything (OpenDyslexic and others via Personalize).

| Role | Class |
|---|---|
| Page title (exactly one `h1` per screen, in the page sky) | `text-3xl font-bold sm:text-4xl` |
| Section (`h2`) | `text-xl font-semibold` |
| Card or sub-section (`h3`) | `text-lg font-semibold` |
| Body | `text-base` |
| Meta, hints | `text-sm text-muted-foreground` |

Never `text-xs`. No uppercase eyebrows or labels above headings: the heading says it. Use `text-balance` on headings and `text-pretty` on paragraphs.

## Controls

- **Use the house components:** `Button`, `Input`, `Textarea`, `Label`, `Checkbox`, `Switch`, `Dialog` from `src/components/ui/`. Never a raw `<input>` or a hand-styled `<button>`.
- **44px minimum for anything you can tap.** Use `<Button size="touch">` (or `size="icon-touch"` for icon-only). Inputs get `className="h-11 text-base md:text-base"`.
- **One filled button per screen** (`variant="default"`): the main action. Others are `outline` or `ghost`.
- **Links that look like buttons:** `<Link className={buttonVariants({ size: "touch" })}>`. Never put a `<Button>` inside a `<Link>`.
- **Tabs:** Base UI `Tabs` (`@base-ui/react/tabs`), as in `src/components/jobs/jobs-view.tsx`. It gives arrow keys and the right roles. Selected tab: `bg-primary text-primary-foreground`.
- **Selected state, everywhere:** navy fill with white text. `bg-secondary` is only for hover and soft areas.
- **Disclosures:** `<details>` with a `ChevronRight` that rotates (`group-open:rotate-90`), as in the work-conditions survey.

## Surfaces

Two kinds of card only:

- **The "now" card:** `rounded-2xl border border-primary/15 bg-card p-5 sm:p-7` plus the soft navy shadow. At most one per screen: the thing to do now (My plan's current step, stage complete, rest).
- **Quiet card:** `rounded-xl border bg-card p-5`. Everything else.

**Lists** (jobs, vacancies) are one quiet card with rows split by a line (`divide-y`), never a stack of separate boxes.

Notes use `bg-secondary`; things to check use a thin `border-destructive/40`. No stat tiles, no colored left borders, no cards inside cards.

## Copy (Easy Read)

- Short sentences, one idea each. Verb first for actions ("Save this job", "Add my CV").
- Second person, adult tone, no exclamation marks, no praise ("Great job!").
- No technical words in the UI: not "NLP", "embedding", "JSON", "result #3", "threshold", "OpenAI". Explain data use once, on `/privacy`.
- Uncertain things say so plainly: "Probably remote".
- Never blame or alarm: "We can't look for jobs right now. It is not your fault."

## States

Every screen that loads data has all four:

- **Loading:** a short line ("Looking for jobs…") with `role="status"`. Never a blank page.
- **Error:** what happened, in plain words, and what to do next (Try again, Back to my plan). Never a code or a server message.
- **Empty:** one sentence and one action ("Add your CV to see jobs picked for you." + "Add my CV").
- **Done:** say it, then move focus to the next thing.

## Accessibility

- WCAG AA: 4.5:1 for text, 3:1 for borders and icons that carry meaning.
- Every input has a visible `Label`. Icon-only buttons have `aria-label`.
- When an action removes the button the person pressed, move focus to the new heading or message.
- Announce changes in a `role="status"` region.
- Respect Reduce motion: the default state of every animation is the final, still state. Motion only on the intro sky, the slow gray twinkle of the margin constellations (wide screens) and a star lighting up.
- Content marked `data-detail="extra"` hides in the "Reduced" information view.

## Adapting to the person

Read the profile with `toAdaptations(loadProfile() ?? {})` (`src/lib/profile.ts`). Show a Listen button when `listenButton`, short summaries with "Read more" when `summaryMode` (`Summarized` in `src/components/summary.tsx`), one thing at a time when `stepsAtOnce` is 1. The job filter's work conditions come from `effectiveBarrierPreferences()`.

## Before you open a pull request

- One `h1`, house components only, 44px targets, tokens only, no `text-xs`.
- Loading, error and empty states written.
- `npm test`, `npm run lint`, `npx tsc --noEmit` pass.
