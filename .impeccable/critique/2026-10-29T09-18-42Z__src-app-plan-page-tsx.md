---
target: My plan (/plan)
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:C:\\Users\\luis0\\Projects\\na-ai-challenge\\src\\app\\plan\\page.tsx"
target_fingerprint: "sha256:c32e58147d456283b5fe9dea3a5dd15b5caa83ce5957b8b32b392161008b7e87"
target_path: "C:\\Users\\luis0\\Projects\\na-ai-challenge\\src\\app\\plan\\page.tsx"
timestamp: 2026-10-29T09-18-42Z
slug: src-app-plan-page-tsx
---
Method: dual-agent (A: design review · B: detector + browser overlay)

## Design Health Score: 27/40 (Acceptable)
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of status | 3 | Header shows the new stage's "0 of N" under the stage-complete card |
| 2 | Match real world | 3 | Stage band counts steps from other stages and the person's own steps |
| 3 | User control | 3 | Unmarking the auto-done profile step leaves a step with no Done |
| 4 | Consistency | 2 | With big-tasks, Done and Break it down look identical |
| 5 | Error prevention | 3 | Manual break-down forces 5 min per step |
| 6 | Recognition | 3 | New broken-down steps land at the end of See what's next |
| 7 | Flexibility | 2 | No reorder, no "do this now", no duration edit |
| 8 | Minimalism | 2 | Current-step card stacks 7 elements; Rest still shows Add a step |
| 9 | Error recovery | 3 | Calm break-down error, three ways out, text kept |
| 10 | Help | 3 | Your path explains stages; nothing explains the band growing |

## Specificity
Mostly specific (sky band, star gold, Stop for today, no-timer Undo); generic identical cards and stock buttons. Detector: 0 findings in CLI and browser (mobile, desktop, Your path dialog), with a positive control confirming the scanner ran.

## Priority issues
- [P0] Done hidden under the bottom nav on phones once Listen, Heads-up and the big-step note stack above it. Fix: buttons under title; Listen inline icon; heads-up one line or below buttons; main bottom padding >= nav. → adapt
- [P1] Stage band mixes other stages, own steps and new habits. Fix: band counts only this stage's steps; others as a quiet line. → layout
- [P1] Stage-complete peak diluted by the new stage's header count and open lists. Fix: hide header band, lists, reply and Add a step while the card shows; same on Rest. → distill
- [P1] Break it down not primary when the profile asks; "big step" note on 5-min steps. Fix: Break it down default, Done outline; note only above ~8 min, gentler copy. → clarify
- [P2] Broken-down steps buried at the end; form stays open; minutes fixed. Fix: insert after current, close form, 2/5/10 chips. → polish

## Persona red flags
Jordan: four things arrive at once; star hint hidden on mobile. Sam: stage change announced twice; Undo focus jumps; 36px stars past 8 steps. Casey: Done under nav; check-in after the step; star count jumps after success. Low-energy: 10-min step with "big step" note; "0 of 10" after finishing a stage; Rest still offers Add a step.

## Minor
Stale weekly goal wording ". Done"; StageDone stars use stage definition count; textareas 42px; five identical "Remove" labels; Break it down on 2-min steps; two nav landmarks named Main.

## Questions
1. Should the band hold only the path? 2. Should the check-in live on the step card ("Too much today?")? 3. Why is the stage-complete moment less calm than the rest screen?
