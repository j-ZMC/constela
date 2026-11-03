# Constela · by Astralis

**Find a job, one step at a time.**

Constela is an AI copilot for the job search, made for two groups of people:

- **Neurodivergent people**, for whom a job search is a heavy load on planning, focus and change.
- **Young people of Gen Z** looking for work, often their first job, who need someone to guide them through each step.

It turns "get a job" into small, clear steps, from building a profile to the interview and the follow-up. Every step is a star; together they form your constellation, your path to a job.

Built for the [North American AI Challenge](https://tech.asu.edu/na-ai-challenge) (ASU Enterprise Technology and the Spark Center for Innovation in Learning), with Kairos as our challenge partner.

## Why

The challenge asks for AI that supports **executive function**: planning, focus, task management and transitions. Job hunting is one of the heaviest executive-function tasks there is: many steps, deadlines, uncertainty, interview anxiety and a big routine change once you're hired. The same gaps hit Gen Z job seekers who have never applied before: they do not know the steps, the words recruiters use, or what an interview is like. Constela gives both groups one clear next step, plain language, and practice before the real thing.

## What's in the app

| Module | What it does | Route | Owner |
| --- | --- | --- | --- |
| Home | One way in: "Get started" or "Continue my plan". No account needed | `/` | |
| Profile | Four parts, in order, that open where you left off: **Your needs** (short questions about needs, not diagnoses), **Job conditions** (workplace conditions to flag, plus your own words as tags), **CV** (PDF read on this computer) and optional **Contact details** ([SPEC-profile.md](SPEC-profile.md)) | `/profile` | Luis |
| My plan | Today's one step, and an **interactive constellation map** with the person in the middle and eight branches you can work on in any order: Set up your profile, Find jobs, Applications and follow-up, Interview prep, Documents and references, Learn and prepare, Experience and portfolio, and Your own steps. "All branches" shows each one's progress and lets you choose which to work on next. Saving a job, sending an application and practicing an interview light their stars by themselves. Plans saved before the branches keep their stars (their stages map to branches). The page is one sky: the map as big as the screen allows (taller on phones), with today's step beside it (under it on phones). **Hey Constela** is spoken: press it (or turn on "Listen for Hey Constela" and say the name) and ask; the local AI (Ollama, activity `plan` in `src/lib/interview.ts`) answers out loud in Kokoro's voice (the browser's voice if Kokoro is not ready), sentence by sentence, with a caption. The map is its face: the "You" star glows with your voice and pulses while it talks (`data-voice` and `--level`, `.voice-halo` in `globals.css`), and the branches the answer names light up in gold (`branchesIn` in `path-map.ts`). A question ends after a 1.5 s pause, with "Done talking", or by saying "stop" (for loud rooms: Whisper checks what was said so far every 2.5 s). After the first "Hey Constela", "Constela" alone is enough until the person leaves My plan. "Type instead" is the fallback. Whisper hears the voice on this computer (`src/lib/listen.ts`). It cannot change the plan. Also "Break it down for me" and a quiet "Need an easier step today?" ([SPEC-plan.md](SPEC-plan.md), [SPEC-path.md](SPEC-path.md)) | `/plan` | Luis |
| Jobs | **Jobs**: a search box over "Jobs for you" (picked from your CV); each search can go **Back** to the one before. **Internships**: only from companies with inclusion data; all of them, closest to your words first. Results have filters for work mode (also read from the location and text), pay bands (by the middle of the range, as a full-time year), company size and inclusion data; each choice shows how many jobs it leaves. Pay shows on a job when the posting gives a range, even only in its text. Every job has **Save**; the **Saved** tab keeps them on the device, with "Get to know the company" (inclusion scores, size, what the company pays, the experience the job's page asks for, and a web search about it with sources) and "I sent my application". Saving and applying move My plan forward. Jobs that match a condition or one of your words are shown apart to review, never hidden ([SPEC-jobs.md](SPEC-jobs.md)) | `/jobs` | Zahid & Juan |
| Job filter backend | Cleaned US jobs dataset, barrier detection with embeddings, your own words as exact matches, and a company inclusion score ([backend/README.md](backend/README.md)) | `backend/` | Zahid |
| Learn | Courses, certificates, programs, free guides on GitHub and forums in the United States, hand-picked and checked (`src/lib/learn-resources.ts`). **Picked for your saved jobs**: what your saved jobs ask for that your CV does not show, and what teaches it (on this device). **Search company courses**: a web search limited to the official course sites of Anthropic, AWS, Google, Microsoft, NVIDIA and others. Filters by area, type, cost, format and "only for college students". Any resource can be added to My plan. The first, Mexico-only list is kept as `MEXICO_RESOURCES_LEGACY`, not shown | `/learn` | |
| Interview | A local AI with five activities: practice an interview, common questions, short lessons, what to expect, and "Translate a message" from a recruiter. Five interview types. Write, talk, or write and listen. Can practice for a saved job, using its posting and what a web search found about the company | `/interview` | Evy |
| Personalization | Colors, text, cursor, icons, amount of information and motion, saved on the device ([PERSONALIZATION.md](PERSONALIZATION.md)) | Personalize panel | Regina |
| Privacy | What is kept, what leaves the device, and "Delete my data" | `/privacy` | |
| LinkedIn extension (optional) | A "less chaotic" mode with the same look and settings | — | Regina |

AI lives inside each feature with a clear purpose instead of a blank chatbot, so nobody has to figure out what to ask.

### Interview in detail

- **Activities:** Practice an interview (a question, then one thing that worked and one tip), Common questions (why they ask it and an example answer), Learn how to answer (six short lessons, such as answering with a short story), What to expect (an interview day step by step) and Translate a message (what a recruiter's message means and a reply to send, with blanks like `[your time]` instead of made-up facts).
- **Interview types:** General, Phone call, Video call, Experience questions and First job.
- **Ways to practice:** Write; **Talk**, hands-free: it listens, sends when you stop talking (after a 2.5 s pause), speaks the reply sentence by sentence and listens again; and Write and listen.
- **A natural voice:** the AI speaks with [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) on this computer. Each sentence is made while the next one is still being written, so the voice starts about a second after the reply does. If Kokoro is not ready, the browser's voice reads instead.
- **Fits the person:** with "Use my CV and plan" on, the AI gets the skills, sectors, experience and projects from the CV and the steps of My plan, never the name or contact details.
- **Stays on topic:** it never recommends other websites or job boards (LinkedIn, Indeed, Glassdoor); it points to Constela's Jobs and Interview pages.
- Answering a practice question tells My plan, which can complete the Interview stage.

## Where data goes

Profile answers, job conditions, the parsed CV, the plan and settings are saved in the browser only. There are no accounts. AI is used like this:

| Feature | Runs on | What it receives |
| --- | --- | --- |
| Interview chat | **Ollama, on this computer** | Your choices, job title, the chat, and (if allowed) the CV and plan summary |
| Talk mode, your voice | **Whisper, on this computer** | The recording, deleted right after it is written down |
| The AI's voice (Talk, Write and listen) | **Kokoro, on this computer** (the browser's voice if Kokoro is not ready) | The reply text, one sentence at a time |
| CV reading | Constela's server (`backend/resume_parser.py`) | The PDF, which is not saved |
| Job search, Internships | OpenAI (embeddings) | Only the search words; your conditions and words stay with Constela |
| Jobs for you | OpenAI (embeddings) | Skills, sectors, experience and projects from the CV, plus your work preference |
| Learn, picks for you | **This browser** | Your saved jobs and your CV's skills; nothing is sent |
| Learn, "Search company courses" | OpenAI `gpt-5-mini` (web search limited to official course sites) | Only the search words and the company chosen |
| "Look up" on a saved job | OpenAI `gpt-5-mini` (with web search) | The company name, job title and place, and the text of the job's own page (Constela's server opens it) |
| Interview for a saved job | **Ollama, on this computer** | The start of the posting, what it asks for, and what the web search found |
| Break it down for me | Groq | The task text and three settings that shape the answer |

Saved jobs, what "Look up" found, and "I sent my application" stay in the browser too (`saved-jobs` in localStorage). Pay, work mode and company size on a job are read from Constela's own data; nothing about the person is used for them.

The [privacy page](src/app/privacy/page.tsx) says the same in Easy Read. Keep the two in step when this changes.

## Design principles

- Adapt by needs, not by diagnosis. Nothing asks how the person feels.
- One clear next step on every screen; everything else waits behind it.
- Calm by default: mint background, navy text, star gold only for achievements, no alarm red. Motion only on the intro and when a star lights up.
- [Atkinson Hyperlegible](https://www.brailleinstitute.org/freefont/) as the main font; OpenDyslexic as an option.
- WCAG AA contrast on every text color, 44 px targets, keyboard and screen-reader use.
- Respect the system "reduce motion" setting.

## Tech stack

[Next.js 16](https://nextjs.org) · [shadcn/ui](https://ui.shadcn.com) on [Base UI](https://base-ui.com) · [AI SDK](https://ai-sdk.dev) · Tailwind CSS · TypeScript · Python (job filter, CV parser, Whisper, Kokoro) · [Ollama](https://ollama.com) · [faster-whisper](https://github.com/SYSTRAN/faster-whisper) · [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx)

## Getting started

You need Node.js 20 or newer, Python 3.12 and, for Interview, [Ollama](https://ollama.com).

```bash
npm install
cp .env.example .env.local   # then add your keys
npm run dev
```

Open http://localhost:3000.

### Environment variables

Set these in `.env.local`. Only the keys for the features you use are needed.

| Variable | Used by | Notes |
| --- | --- | --- |
| `GROQ_API_KEY` | Break it down for me | Free key at https://console.groq.com/keys |
| `GROQ_MODEL` | Break it down for me | Optional; defaults to `openai/gpt-oss-20b` |
| `OPENAI_API_KEY` | Jobs and Internships; "Look up" on a saved job; `backend/company_sizes.py` | Embeds the search words; `gpt-5-mini` reads a saved job's page and searches the web about its company (about 10 seconds), and estimates company sizes |
| `PYTHON_EXECUTABLE` | Jobs, CV, Talk mode | Optional; defaults to `.venv` at the project root |
| `OLLAMA_URL` | Interview | Optional; defaults to `http://127.0.0.1:11434` |
| `OLLAMA_MODEL` | Interview | Optional; defaults to `llama3.1:8b` |
| `WHISPER_MODEL` | Talk mode | Optional; defaults to `small.en` |
| `KOKORO_VOICE` | The AI's voice | Optional; defaults to `af_heart`. Others: `af_bella`, `af_nicole`, `am_michael`, `am_adam`, `bf_emma`, `bm_george` |
| `KOKORO_SPEED` | The AI's voice | Optional; defaults to `0.95`, a little slower than normal speech |

### Python backend

The Next.js server runs the Python scripts itself; there is no separate backend server. It uses the virtual environment at `.venv` in the project root. In PowerShell from the repository root:

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

For Jobs, prepare the data once (see the [backend README](backend/README.md)):

```powershell
cd backend
..\.venv\Scripts\python.exe company_inclusion.py
..\.venv\Scripts\python.exe select_qualified_companies.py
..\.venv\Scripts\python.exe pretokenize_openai.py
# Company size filter: B Corp, Y Combinator, the posting itself, an AI estimate; --web searches the rest
# (re-run after collecting new jobs; --web 200 took 3 minutes and found 91 of 200)
..\.venv\Scripts\python.exe company_sizes.py --web 200
# Internships tab: collect them, then embed them (run weekly: internships are seasonal)
..\.venv\Scripts\python.exe collect_internships.py
..\.venv\Scripts\python.exe pretokenize_openai.py --jobs data/raw/jobs/internships.json --emb data/processed/embeddings/internships_openai_embeddings.npy --ids data/processed/embeddings/internships_openai_ids.json
cd ..
```

### Interview: Ollama, Whisper and Kokoro

```powershell
ollama pull llama3.1:8b
```

Ollama must be running when you practice. Constela asks it for an 8,192-token window (Ollama's default for this model is 65,536 and uses about 14 GB) and keeps the model loaded for 30 minutes. Opening the Interview page loads the model and reads the shared instructions in advance, so the first answer comes in about a second.

**Use the GPU.** Check with `ollama ps`: the PROCESSOR column should say `100% GPU`. On laptops with two graphics chips, Ollama can start before the NVIDIA GPU wakes up and then run on the CPU, 5 to 10 times slower. Quit Ollama and open it again; its log (`%LOCALAPPDATA%\Ollama\server.log`) should then show `library=CUDA`. The first load after an Ollama update can take about 90 seconds while CUDA sets up; after that it takes about 2.

Talk mode turns speech into text with Whisper on the same computer. It is installed with `backend/requirements.txt`, uses an NVIDIA GPU when there is one (otherwise the CPU), and downloads the `small.en` model (about 500 MB) the first time. Choosing Talk starts loading it.

The AI's voice is Kokoro-82M through `kokoro-onnx`, which runs the model without PyTorch. It runs on the CPU, which is fast enough for a model this small (a 5-second sentence takes about half a second) and leaves the GPU to Ollama and Whisper. The first time, `backend/speak_server.py` downloads the model files (about 340 MB) into `backend/models/kokoro/`, which git ignores. Choosing Talk or Write and listen starts loading it.

## Commands

Run these commands from the project root:

| Command | Description |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm start` | Start the production server after building |
| `npm run lint` | Check the code with ESLint |
| `npm test` | Run the web test suite (Vitest) |
| `cd backend; ..\.venv\Scripts\python.exe -m unittest` | Run the Python tests |

## Project map

| Folder | What is there |
| --- | --- |
| `src/app/` | Pages (`/`, `/profile`, `/plan`, `/jobs`, `/learn`, `/interview`, `/privacy`; `/recommended` redirects to `/jobs`) and API routes (`/api/jobs`, `/api/jobs/posting`, `/api/company/research`, `/api/learn/search`, `/api/resume/parse`, `/api/breakdown`, `/api/interview`, `/api/interview/warm`, `/api/interview/transcribe`, `/api/interview/speak`) |
| `src/components/` | Screens by module (`profile/`, `plan/`, `jobs/`, `interview/`) and shared UI in `ui/` |
| `src/lib/` | Logic without screens, with tests next to it: the plan and path, the constellation map, jobs (schema, filters, saved jobs, company facts, web research, job page reading), the interview prompt and context, the Python workers for Whisper and Kokoro |
| `backend/` | Python: collectors (`collect_bulk.py`, `collect_internships.py`), company data (`company_inclusion.py`, `select_qualified_companies.py`, `company_sizes.py`), embeddings and the job filter (`pretokenize_openai.py`, `filter_jobs_openai.py`), CV parser, `transcribe_server.py` (Whisper) and `speak_server.py` (Kokoro) on the shared `worker_protocol.py`, data and tests |

## Connecting your module to My plan

Everything lives in the browser, so modules talk to My plan through two functions in `src/lib/plan.ts`:

```ts
import { addStepToPlan, markEvent } from "@/lib/plan";

// Add a concrete next step. It shows first in My plan. `stage` is optional and names the branch:
// "setup" | "search" | "apply" | "interview" | "documents" | "learn" | "experience" (old stage names still work).
addStepToPlan({ title: "Read the job at Acme", minutes: 5, icon: "briefcase", href: "/jobs", stage: "apply" });

// Say that something happened, so My plan can move to the next stage.
markEvent("job-saved");        // Jobs: a job was saved (lights "Save one job you like")
markEvent("application-sent"); // Jobs: an application was sent
markEvent("practice-done");    // Interview: a practice question was answered (Interview already calls this)
```

To adapt your screen to the person, read their profile:

```ts
import { loadProfile, toAdaptations, toJobPreferences } from "@/lib/profile";

const answers = loadProfile() ?? {};
const a = toAdaptations(answers);       // summaryMode, explicitSteps, stepsAtOnce, gentlePacing, ...
const jobs = toJobPreferences(answers); // { barriers: ["sound", ...], workplace: ["remote"] } for the job filter
```

Rules every screen follows: Easy Read copy (short sentences, verb first, no exclamation marks), 44 px targets, keyboard and screen-reader use, no red or "overdue", and AI only receives the text it needs. Profile answers never go to an AI; the CV and plan go only to the local Interview AI, and only when the person allows it.

## Known limits

- The UI is in English, and Whisper is set to English.
- Interview needs Ollama on the computer that runs Constela. A hosted copy without Ollama shows "Open Ollama, then try again".
- Talk mode was tested in Chrome with a simulated microphone. Browsers only play the AI's voice after the person has clicked on the page, which pressing Start does. Very quiet microphones may need a lower `SPEECH_LEVEL` in `src/components/interview/interview-chat.tsx`.
- Your own words in Job conditions match whole words only: "night shift" does not match "night shifts".
- An 8B model sometimes skips the tip or writes a little more than asked.
- The job data is a snapshot (latest postings from late October 2026). Internships go stale fastest; re-run `collect_internships.py` weekly.
- Only about 15% of postings give pay, so the pay filter always leaves many out. The main file was collected with descriptions cut at 4,000 characters, which loses pay ranges written at the end; new collections read pay first.
- Company size is unknown for about 10% of jobs, mostly small staffing agencies. Web search and AI estimates can mix up companies with the same name.
- Internships come from all over the world (London, Paris, Singapore); there is no country filter yet. Some companies post the same internship once per country.
- Some job pages build themselves with JavaScript and have no JSON-LD; for those, "Experience they ask for" uses the part of the posting Constela has, and says so.

## Notes for the next AI working here

Read this before changing anything. It is what the code alone does not tell you.

### Read first

- [CLAUDE.md](CLAUDE.md): the house rules (smallest complete change, test new logic, no extra features, end replies with what was skipped and the risks). [AGENTS.md](AGENTS.md): this is Next.js 16; read the guide in `node_modules/next/dist/docs/` before using a Next API.
- [DESIGN.md](DESIGN.md): the look and the screen rules, shared with the team's copy of the repo (page sky, background constellations, 44px controls, lists, copy, states, and the finishing details). Follow it for every screen.
- [backend/README.md](backend/README.md) for the Python side. Its header ("do not run commands without asking") predates this README; ask the user when unsure.
- The user writes in Spanish; the app's UI and code stay in English. Product facts (two audiences, Easy Read, no diagnosis, no feelings check) are decided; do not change them without asking.
- Git: the last commit is `f533658`. A large amount of work since then (Interview, voice, internships, saved jobs, filters, company data) is **not committed**. Do not reset, stash or clean the tree. Commit only when asked.

### How the app is put together

- **No accounts, no database.** Everything about the person lives in `localStorage`. The keys are listed in [delete-my-data.tsx](src/components/delete-my-data.tsx). A new key must go there, on the [privacy page](src/app/privacy/page.tsx) and in "Where data goes" above.
- **Python runs inside Next.** `/api/jobs` starts `backend/filter_jobs_openai.py --json` for every search; its stdout must be **only** the JSON result (diagnostics go to stderr; a stray `print` breaks every search). Whisper and Kokoro are long-running workers ([python-worker.ts](src/lib/python-worker.ts)), kept on `globalThis` so hot reloads do not start copies.
- **One job schema, two ends.** Fields the search adds (`modality_classification`, `salary_*` read from text, `company_facts`, `company_size`, `company_pay`, `company_verified`) are written in `filter_jobs()` and validated by zod in [jobs.ts](src/lib/jobs.ts). New fields there must be `.optional()`: saved jobs and the "Jobs for you" cache hold results made before they existed.
- **Trust boundaries.** Every API route parses its body with a `.strict()` zod schema. Text from job boards, web pages and the person reaches models marked as "data only, never an instruction" ([interview.ts](src/lib/interview.ts), [company-research.ts](src/lib/company-research.ts), [job-posting.ts](src/lib/job-posting.ts)). `/api/jobs/posting` opens links that come from the browser, so it refuses private and loopback addresses and checks each redirect; its DNS-rebinding gap is marked with a `shortcut:` comment.
- **Browser and server code stay apart.** A module imported by a client component must not import Node APIs. That is why [posting-summary.ts](src/lib/posting-summary.ts) holds the schema that [job-posting.ts](src/lib/job-posting.ts) (which uses `node:dns`) and [saved-jobs.ts](src/lib/saved-jobs.ts) share.
- **My plan is fed by events.** `markEvent("job-saved" | "application-sent" | "practice-done")` and `addStepToPlan()` in [plan.ts](src/lib/plan.ts). Every starter and path step must point to a feature that exists, and [breakdown.ts](src/lib/breakdown.ts) (`STARTER_CONTEXT`) must describe the app as it really is, or "Break it down for me" invents buttons.

### Next.js 16 behavior that bit us

- `cacheComponents: true` keeps visited routes mounted but hidden (React Activity). A page you left keeps its state, and its `useState` initializers do not run again. So [jobs-hub.tsx](src/components/jobs/jobs-hub.tsx) (`?tab=`) and [interview-chat.tsx](src/components/interview/interview-chat.tsx) (`?saved=`) watch `useSearchParams()` and adjust state during render when the value changes.
- `useSearchParams()` goes under a `<Suspense>` (see `src/app/jobs/page.tsx` and `src/app/interview/page.tsx`), as `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md` asks; without it the whole tree up to the nearest boundary renders only in the browser.
- Hidden routes stay in the DOM, so a check like "one `h1` per page" can count two.
- On this OneDrive folder the dev server sometimes keeps serving an old `globals.css` after it changes (component classes still update). If a CSS change does not show, stop `next dev` (the `node` process, not only its terminal) and start it again.

### Data: what is generated, and how to rebuild it

Everything under `backend/data/` except `jobs_usa_full_backup_cleaned.json` is ignored by git (`*.json`, `*.sqlite`, `*.npy`). A fresh clone needs the steps in "Python backend" above. In order:

| Step | Writes | Cost and time |
| --- | --- | --- |
| `company_inclusion.py`, `select_qualified_companies.py` | `data/processed/*.sqlite` (inclusion scores; which companies qualify) | Free; reads the 9.9M-row Glassdoor CSV in chunks |
| `pretokenize_openai.py` | Job and barrier embeddings | OpenAI embeddings, cents |
| `company_sizes.py --web 200` | `data/reference/company_data/company_sizes.json` | About 15 cheap model calls plus 25 web searches, 3 minutes. Model answers are cached; re-run after new jobs |
| `collect_internships.py` | `ats_boards.json` (cached boards of inclusion-verified companies; delete it or pass `--rediscover` to look again, about 10 minutes) and `data/raw/jobs/internships.json` | Free; about 2 minutes. Then embed it with the `pretokenize_openai.py --jobs ... --emb ... --ids ...` line above |

Runtime OpenAI use: one embedding per search; "Look up" on a saved job makes two `gpt-5-mini` calls (job page, web search), about 10 to 15 seconds.

### Things that are true about the data (measured, November 2026)

- `modality` is empty in 6,102 of 6,450 jobs. Work mode comes from `work_mode()` in the filter: fields, then title and location, then narrow text phrases (perks like "remote work days" and "hybrid cloud" do not count). About half the jobs get a mode.
- Only 8 jobs have salary fields; about 940 write a pay range in the text, read by `collect_bulk.pay_from_text()`. "$" without a code means the posting gave no currency. Half the posted ranges start at $100,000 or more, which is why the pay filter uses bands by the middle of the range.
- Company size sources, best first: B Corp CSV, Y Combinator `team_size`, the posting's own words, web search, model estimate. Together they cover about 90% of jobs.
- Internship boards are accepted only when the board carries the company's own name (Greenhouse API name, Lever and Ashby page titles), because slugs collide (`capital` is capital.com, not CO Capital). Generic names like "Lumen" or "Foundry" may still be namesakes; check `ats_boards.json` by hand.

### Checking your work

- `npx tsc --noEmit`, `npm run lint`, `npm test` (Vitest) and `cd backend; ..\.venv\Scripts\python.exe -m unittest discover -p "test_*.py"`. Keep them all passing.
- Vitest runs in the `node` environment: stub `localStorage` and `window` with `vi.stubGlobal` (see [saved-jobs.test.ts](src/lib/saved-jobs.test.ts)). A `beforeEach(() => mock.mockReset())` arrow returns the mock, which Vitest then calls as cleanup: use braces.
- No browser tests are committed. Changes were checked in headless Chrome over the DevTools protocol against the running dev server, with real APIs. Check UI changes at 390 px and 1280 px wide.
- On Windows: `with sqlite3.connect(...)` does not close the file (use `contextlib.closing`), PowerShell adds a BOM when piping to Python (the worker protocol strips it), and JSON for `curl.exe` is easiest sent from a file with `--data-binary @file`.

### This computer

- Laptop with an RTX 5070 (8 GB). Ollama runs `llama3.1:8b` on it; if `ollama ps` shows CPU, quit and reopen Ollama (see above). Whisper uses CUDA; Kokoro uses the CPU on purpose.
- Models in use: `llama3.1:8b` (Interview, local), `text-embedding-3-small` (search), `gpt-5-mini` (company research, job page reading, company sizes), `openai/gpt-oss-20b` on Groq (Break it down), Whisper `small.en`, Kokoro `af_heart`.

### Open work

- The specs ([SPEC-plan.md](SPEC-plan.md), [SPEC-path.md](SPEC-path.md), [SPEC-profile.md](SPEC-profile.md), [SPEC-jobs.md](SPEC-jobs.md)) predate most of the above: they mention only neurodivergent users and not internships, saved jobs, filters or the company research. The code and this README are the source of truth until they are updated.
- Discussed with the user, not built: a CV analyzer (the parser does not read education or certifications yet), a finder for proven certifications and their courses, internship steps in My plan, and a country filter for internships.
- Not done on purpose: re-collecting the main job file (would recover pay cut off at 4,000 characters, but needs new embeddings for about 6,500 jobs), web size search for the last 316 companies (`company_sizes.py --web 400`), keeping filters when going Back.

## Team Astralis

Luis · Regina · Juan · Zahid · Evy
