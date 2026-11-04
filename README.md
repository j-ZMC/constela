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
| Profile | Four parts, in order, that open where you left off: **What is hard** ("What is hard for you?": optional picks with a live preview of the screen settings each one turns on, and the adaptations they set; shortcuts by type; `src/lib/help-picks.ts`), **Job conditions** (workplace conditions to flag, plus your own words as tags), **CV** (PDF read on this computer) and optional **Contact details** | `/profile` | Luis |
| My plan | Today's one step, and an **interactive constellation map** with the person in the middle and eight branches you can work on in any order: Set up your profile, Find jobs, Applications and follow-up, Interview prep, Documents and references, Learn and prepare, Experience and portfolio, and Your own steps. "All branches" shows each one's progress and lets you choose which to work on next. Saving a job, sending an application and practicing an interview light their stars by themselves. Plans saved before the branches keep their stars (their stages map to branches). The page is one sky: the map as big as the screen allows (taller on phones), with today's step beside it (under it on phones). **Hey Constela** is spoken: press it (or turn on "Listen for Hey Constela" and say the name) and ask; the local AI (Ollama, activity `plan` in `src/lib/interview.ts`) answers out loud in Kokoro's voice (the browser's voice if Kokoro is not ready), sentence by sentence, with a caption. The map is its face: the "You" star glows with your voice and pulses while it talks (`data-voice` and `--level`, `.voice-halo` in `globals.css`), and the branches the answer names light up in gold (`branchesIn` in `path-map.ts`). A question ends after a 1.5 s pause, with "Done talking", or by saying "stop" (for loud rooms: Whisper checks what was said so far every 2.5 s). After the first "Hey Constela", "Constela" alone is enough until the person leaves My plan. "Type instead" is the fallback. Whisper hears the voice on this computer (`src/lib/listen.ts`). It cannot change the plan. Also "Break it down for me" and a quiet "Need an easier step today?" | `/plan` | Luis |
| Jobs | **Jobs**: a search box over "Jobs for you" (picked from your CV); each search can go **Back** to the one before. **Internships**: only from companies with inclusion data; all of them, closest to your words first. Results have filters for work mode (also read from the location and text), pay bands (by the middle of the range, as a full-time year), company size and inclusion data; each choice shows how many jobs it leaves. Pay shows on a job when the posting gives a range, even only in its text. Every job has **Save**; the **Saved** tab keeps them on the device, with "Get to know the company" (inclusion scores, size, what the company pays, the experience the job's page asks for, and a web search about it with sources) and "I sent my application". Saving and applying move My plan forward. Jobs that match a condition or one of your words are shown apart to review, never hidden | `/jobs` | Zahid & Juan |
| Job filter backend | Cleaned US jobs dataset, barrier detection with embeddings, your own words as exact matches, and a company inclusion score ([backend/README.md](backend/README.md)) | `backend/` | Zahid |
| Learn | Courses, certificates, programs, free guides on GitHub and forums in the United States, hand-picked and checked (`src/lib/learn-resources.ts`). **Picked for your saved jobs**: what your saved jobs ask for that your CV does not show, and what teaches it (on this device). **Search company courses**: a web search limited to the official course sites of Anthropic, AWS, Google, Microsoft, NVIDIA and others. Filters by area, type, cost, format and "only for college students". Any resource can be added to My plan. The first, Mexico-only list is kept as `MEXICO_RESOURCES_LEGACY`, not shown | `/learn` | |
| Preparation (was Interview; the route is still `/interview`) | A local AI with eight activities in four boxes (`GROUPS` in `interview-chat.tsx`): **Practice an interview** (with "What to expect"), **Common questions** (with "Learn how to answer"), **Messages and letters** (translate a recruiter's message, write an email, a cover letter or a follow-up with `[blanks]` instead of made-up facts, and "Check my writing", kind proofreading), and **Write or improve your CV** (write it from zero, get tips on yours, or fix one part; it never makes up facts and leaves blanks like `[start year]`). Choosing a box shows all its choices at once as boxes with pictograms, with defaults, and Start. Cover letters, follow-ups and CV help can use a typed or saved job (`USES_JOB` in `interview.ts`). In Write modes, **Dictate** writes what you say into the box without sending it; while the AI talks, the sentence it is saying shows as a caption. **Video call** is spoken, like a meeting app: the interviewer fills the screen with captions, you are a small tile in the corner, and a control bar has Start speaking, I need a moment, Camera, Hide me and Leave; "Type instead" is the only fallback. The camera is opt-in in More options, with a check before the call (a light tip and where to put the camera); you can hide yourself or turn the camera off, and a camera that goes off gets one calm note ([camera-view.tsx](src/components/interview/camera-view.tsx), light in [camera.ts](src/lib/camera.ts)). Nothing is recorded. In Talk mode, "I need a moment" stops the microphone and the voice until you are ready. Before a video call, **MediaPipe** (`@mediapipe/tasks-vision`, face detector model in `public/models/`, its WASM from jsDelivr pinned to the installed version) says if the face is in the middle (`framingTip` in `camera.ts`). **For a real meeting** ([meeting-helper.tsx](src/components/interview/meeting-helper.tsx)): reminders the person picks, one at a time, with no sound; live captions of a shared meeting tab, written by Whisper on this computer; both can float on top of the meeting in a Document Picture-in-Picture window (Chrome and Edge). Three interview types (General, Video call, Experience questions). Write, talk, or write and listen. Can practice for a saved job, using its posting and what a web search found about the company | `/interview` | Evy |
| Personalization | Colors, text, cursor, icons, amount of information and motion, saved on the device. Also **Soft light** (a warmer, dimmer page that keeps every contrast check), **Calm mode** (no movement, no glow, Hey Constela answers in text) and **Slower AI voice** ([PERSONALIZATION.md](PERSONALIZATION.md)) | Settings (in the menu; the code still calls it Personalize). Also "Delete my data", which deletes everything and opens the first form | Regina |
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
| Preparation chat (interview and CV help) | **Ollama, on this computer** | Your choices, job title, the chat (including any part of a CV you paste), and (if allowed) the CV and plan summary |
| Talk mode, your voice | **Whisper, on this computer** | The recording, deleted right after it is written down |
| The AI's voice (Talk, Write and listen) | **Kokoro, on this computer** (the browser's voice if Kokoro is not ready) | The reply text, one sentence at a time |
| CV reading | Constela's server (`backend/resume_parser.py`) | The PDF, which is not saved |
| Job search, Internships | **Ollama, on this computer** (`qwen3-embedding:0.6b`) | The search words; nothing leaves the computer |
| Jobs for you | **Ollama, on this computer** (`qwen3-embedding:0.6b`) | Skills, sectors, experience and projects from the CV, plus your work preference |
| Learn, picks for you | **This browser** | Your saved jobs and your CV's skills; nothing is sent |
| Learn, "Search company courses" | **This browser and Constela's server**: the hand-checked list (`learn-resources.ts`) filtered to those companies' official sites | Nothing is sent anywhere |
| "Look up" on a saved job | Wikipedia's public API (no key) for the company; **Ollama on this computer** sums it up and reads the job's own page | To Wikipedia: the company name only. The page text stays on the computer |
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

You need Node.js 20 or newer, Python 3.10 or newer (3.12 recommended) and [Ollama](https://ollama.com/download).

```bash
npm install
cp .env.example .env.local   # optional: GROQ_API_KEY for "Break it down for me"
npm run dev                  # the first time, it sets everything up first (about 2 GB, once)
```

Open http://localhost:3000. The first time, `npm run dev` runs `backend/setup_local.py`: the Python environment, the
voice and speech models (Kokoro, Whisper, voice tone) and the Ollama models, so the first voice reply already uses
Kokoro. Afterwards it only checks a marker file (`.venv/.constela-setup-done`). `npm run setup` runs it again by hand.
The first time the app opens, "What is hard for you?" comes first and cannot be skipped: at least one choice starts the app.
The job data and the search vectors (computed locally with Qwen3-Embedding) come with the repository.

### Environment variables

Set these in `.env.local`. Only the keys for the features you use are needed.

| Variable | Used by | Notes |
| --- | --- | --- |
| `GROQ_API_KEY` | Break it down for me | Free key at https://console.groq.com/keys |
| `GROQ_MODEL` | Break it down for me | Optional; defaults to `openai/gpt-oss-20b` |
| `OPENAI_API_KEY` | `backend/company_sizes.py` only (run by hand) | The app itself no longer uses OpenAI |
| `PYTHON_EXECUTABLE` | Jobs, CV, Talk mode | Optional; defaults to `.venv` at the project root |
| `OLLAMA_URL` | Interview | Optional; defaults to `http://127.0.0.1:11434` |
| `OLLAMA_MODEL` | Interview | Optional; defaults to `llama3.1:8b` |
| `WHISPER_MODEL` | Talk mode | Optional; defaults to `small.en` |
| `KOKORO_VOICE` | The AI's voice | Optional; defaults to `af_heart`. Others: `af_bella`, `af_nicole`, `am_michael`, `am_adam`, `bf_emma`, `bm_george` |
| `KOKORO_SPEED` | The AI's voice | Optional; defaults to `0.95`, a little slower than normal speech |

### Python backend

The Next.js server runs the Python scripts itself; there is no separate backend server. It uses the virtual environment at `.venv` in the project root, which `npm run setup` creates. To do it by hand, in PowerShell from the repository root:

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
..\.venv\Scripts\python.exe pretokenize_openai.py --jobs data/raw/jobs/internships.json --emb data/processed/embeddings/internships_qwen3_embeddings.npy --ids data/processed/embeddings/internships_qwen3_ids.json
cd ..
```

### Interview: Ollama, Whisper and Kokoro

```powershell
ollama pull llama3.1:8b
ollama pull qwen3-embedding:0.6b   # job search
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

## Developer notes

Read [DESIGN.md](DESIGN.md) before building a screen, [PERSONALIZATION.md](PERSONALIZATION.md) for Settings, and [backend/README.md](backend/README.md) for the Python side. The UI and the code are in English. Product decisions (two audiences, Easy Read, needs instead of diagnoses) are fixed; change them only with the team.

The CV parser (`backend/resume_parser.py/`) and third-party source reports (`backend/data/reference/source_docs/`) are kept out of git on purpose: the first holds real CVs used for testing, the second is 22 MB of reports the app does not read. A working copy needs its own `backend/resume_parser.py/resume_parser.py` for CV upload.

### How the app is put together

- **Layout (November 2026).** On wide screens the app menu is a fixed bar on the left (`site-nav.tsx`); `<body>` gets `lg:has-[[data-side-nav]]:pl-56` so pages move over by its width. Jobs, Internships, Saved and Learn show cards a page at a time with a filter panel that opens and closes (`paged-grid.tsx`). Learn has three tabs: All courses, Picked for you, Company courses. My plan shows the map and today's step only; the header says "Now: step 2 of 4 in Find jobs". Preparation: the interviewer has a level (Easy, Medium, Hard; `LEVELS` in `interview.ts`), a Technical questions type, fits questions to the job, and "For a real meeting" shows only under Practice an interview.
- A new rule in `globals.css` may not reach the browser until `next dev` restarts (see below); Tailwind classes in components update at once, so layout fixes that must show now belong there.

- **No accounts, no database.** Everything about the person lives in `localStorage`. The keys are listed in [delete-my-data.tsx](src/components/delete-my-data.tsx). A new key must go there, on the [privacy page](src/app/privacy/page.tsx) and in "Where data goes" above.
- **Python runs inside Next.** `/api/jobs` starts `backend/filter_jobs_openai.py --json` for every search; its stdout must be **only** the JSON result (diagnostics go to stderr; a stray `print` breaks every search). Whisper and Kokoro are long-running workers ([python-worker.ts](src/lib/python-worker.ts)), kept on `globalThis` so hot reloads do not start copies.
- **One job schema, two ends.** Fields the search adds (`modality_classification`, `salary_*` read from text, `company_facts`, `company_size`, `company_pay`, `company_verified`) are written in `filter_jobs()` and validated by zod in [jobs.ts](src/lib/jobs.ts). New fields there must be `.optional()`: saved jobs and the "Jobs for you" cache hold results made before they existed.
- **Trust boundaries.** Every API route parses its body with a `.strict()` zod schema. Text from job boards, web pages and the person reaches models marked as "data only, never an instruction" ([interview.ts](src/lib/interview.ts), [company-research.ts](src/lib/company-research.ts), [job-posting.ts](src/lib/job-posting.ts)). `/api/jobs/posting` opens links that come from the browser, so it refuses private and loopback addresses and checks each redirect; its DNS-rebinding gap is marked with a `shortcut:` comment.
- **Browser and server code stay apart.** A module imported by a client component must not import Node APIs. That is why [posting-summary.ts](src/lib/posting-summary.ts) holds the schema that [job-posting.ts](src/lib/job-posting.ts) (which uses `node:dns`) and [saved-jobs.ts](src/lib/saved-jobs.ts) share.
- **My plan is fed by events.** `markEvent("job-saved" | "application-sent" | "practice-done")` and `addStepToPlan()` in [plan.ts](src/lib/plan.ts). Every starter and path step must point to a feature that exists, and [breakdown.ts](src/lib/breakdown.ts) (`STARTER_CONTEXT`) must describe the app as it really is, or "Break it down for me" invents buttons.

### Next.js 16 notes

- `cacheComponents: true` keeps visited routes mounted but hidden (React Activity). A page you left keeps its state, and its `useState` initializers do not run again. So [jobs-hub.tsx](src/components/jobs/jobs-hub.tsx) (`?tab=`) and [interview-chat.tsx](src/components/interview/interview-chat.tsx) (`?saved=`) watch `useSearchParams()` and adjust state during render when the value changes.
- `useSearchParams()` goes under a `<Suspense>` (see `src/app/jobs/page.tsx` and `src/app/interview/page.tsx`), as `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md` asks; without it the whole tree up to the nearest boundary renders only in the browser.
- Hidden routes stay in the DOM, so a check like "one `h1` per page" can count two.
- In a synced folder (OneDrive) the dev server sometimes keeps serving an old `globals.css` after it changes (component classes still update). If a CSS change does not show, stop `next dev` (the `node` process, not only its terminal) and start it again.

### Data: what is generated, and how to rebuild it

Everything under `backend/data/` except `jobs_usa_full_backup_cleaned.json` is ignored by git (`*.json`, `*.sqlite`, `*.npy`). A fresh clone needs the steps in "Python backend" above. In order:

| Step | Writes | Cost and time |
| --- | --- | --- |
| `company_inclusion.py`, `select_qualified_companies.py` | `data/processed/*.sqlite` (inclusion scores; which companies qualify) | Free; reads the 9.9M-row Glassdoor CSV in chunks |
| `pretokenize_openai.py` (old name kept) | Job and barrier embeddings with `qwen3-embedding:0.6b` on Ollama (`ollama pull qwen3-embedding:0.6b` first) | Free; a few minutes on the GPU |
| `company_sizes.py --web 200` | `data/reference/company_data/company_sizes.json` | About 15 cheap model calls plus 25 web searches, 3 minutes. Model answers are cached; re-run after new jobs |
| `collect_internships.py` | `ats_boards.json` (cached boards of inclusion-verified companies; delete it or pass `--rediscover` to look again, about 10 minutes) and `data/raw/jobs/internships.json` | Free; about 2 minutes. Then embed it with the `pretokenize_openai.py --jobs ... --emb ... --ids ...` line above |

At run time nothing uses OpenAI. Each search embeds its words with Qwen on Ollama. "Look up" on a saved job makes two Ollama web searches and two answers from `llama3.1:8b`; "Search company courses" makes one web search per company (13 when none is chosen).

### Things that are true about the data (measured, November 2026)

- `modality` is empty in 6,102 of 6,450 jobs. Work mode comes from `work_mode()` in the filter: fields, then title and location, then narrow text phrases (perks like "remote work days" and "hybrid cloud" do not count). About half the jobs get a mode.
- Only 8 jobs have salary fields; about 940 write a pay range in the text, read by `collect_bulk.pay_from_text()`. "$" without a code means the posting gave no currency. Half the posted ranges start at $100,000 or more, which is why the pay filter uses bands by the middle of the range.
- Company size sources, best first: B Corp CSV, Y Combinator `team_size`, the posting's own words, web search, model estimate. Together they cover about 90% of jobs.
- Internship boards are accepted only when the board carries the company's own name (Greenhouse API name, Lever and Ashby page titles), because slugs collide (`capital` is capital.com, not CO Capital). Generic names like "Lumen" or "Foundry" may still be namesakes; check `ats_boards.json` by hand.

### Checking your work

- `npx tsc --noEmit`, `npm run lint`, `npm test` (Vitest) and `cd backend; ..\.venv\Scripts\python.exe -m unittest discover -p "test_*.py"`. Keep them all passing.
- Vitest runs in the `node` environment: stub `localStorage` and `window` with `vi.stubGlobal` (see [saved-jobs.test.ts](src/lib/saved-jobs.test.ts)). A `beforeEach(() => mock.mockReset())` arrow returns the mock, which Vitest then calls as cleanup: use braces.
- No browser tests are committed. Changes were checked in headless Chrome over the DevTools protocol against the running dev server, with real APIs. Check UI changes at 390 px and 1280 px wide, and at 150% text (Personalize). For voice and camera, start Chrome with `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream --use-file-for-fake-audio-capture=<file.wav>`: a WAV made with Kokoro (`/api/interview/speak`) works as the microphone, and the fake camera is a green circle (MediaPipe may or may not see a "face" in it). In headless Chrome on this computer (November 2026) the fake camera ends by itself about 190 ms after it opens, with no frames, on any page: camera features cannot be tested end to end there. Test the MediaPipe models instead on MediaPipe's own photos (`https://storage.googleapis.com/mediapipe-assets/portrait.jpg`, `thumb_up.jpg`, `fist.jpg`, `victory.jpg`) in VIDEO mode, the way `camera-view.tsx` calls them. Chrome's noise suppression removes white noise, so test loud rooms with other voices, not static. Sharing a tab with audio (live captions) and opening the floating window need a real click; they were not tested end to end.
- On Windows: `with sqlite3.connect(...)` does not close the file (use `contextlib.closing`), PowerShell adds a BOM when piping to Python (the worker protocol strips it), and JSON for `curl.exe` is easiest sent from a file with `--data-binary @file`.

### Open work

- Not built yet: a finder for proven certifications and their courses, and a country filter for internships. The CV helper exists as a chat in Preparation; the parser still does not read education or certifications, and the helper cannot tailor a CV to a saved job yet.
- After the move from OpenAI to Ollama (3 to 4 November 2026) everything runs on the local computer except "Break it down for me" (Groq) and the Wikipedia call in "Look up". "Company courses" now searches only the hand-checked list (1 or 2 courses per company), so it is short. The conditions filter (`BLOCKED_THRESHOLD = 0.35`) sets apart about 3.6% of condition-and-job pairs, and every condition flags at least 10 jobs; check it with real people. `company_sizes.py` still uses OpenAI. The old `*_openai_*` caches in `data/processed/embeddings/` can be deleted.
- Open question: a fresh job JSON with company size and salary, as two files (US jobs, and companies). The open question is whether to re-collect (fresh, recovers pay, 60 to 90 minutes plus new embeddings) or enrich the current file.
- Not done on purpose: re-collecting the main job file (would recover pay cut off at 4,000 characters, but needs new embeddings for about 6,500 jobs), web size search for the last 316 companies (`company_sizes.py --web 400`), keeping filters when going Back.
- Known gaps in the newest work:
  - Live captions miss the words said while Whisper writes down the part before (`shortcut:` comment in `meeting-helper.tsx`).
  - MediaPipe logs an INFO line with `console.error`, so the Next dev overlay shows "1 Issue"; production is not affected.
  - The camera choice and the meeting reminders are not remembered between visits.
  - "Constela" alone (after the first "Hey Constela") can be woken by "constellation" in normal talk.
  - In a loud room, background voices end up in the question.

### Roadmap: help for neurodivergent people

Built phase by phase, each part verified before the next.

**Rules that are not negotiable.**
- The person chooses the help, never a diagnosis: never ask for, store or infer a condition. One exception (November 2026): "Shortcuts by type (optional)" in "What is hard for you?" names the ten types (`NEURO_TYPES` in `src/lib/help-picks.ts`). Choosing one only turns on screen settings; which one was chosen is never stored or sent. A second exception: "Adjust the practice to how it is going" in Preparation (off by default) reads the voice's tone (wav2vec2, `onnx-community/wav2vec2-base-superb-er-ONNX`, Apache 2.0, in `transcribe_server.py`) and face tension (MediaPipe Face Landmarker blendshapes) on this computer. They are weak evidence (a calm Kokoro sentence scored 66% "angry"), so `src/lib/practice-signals.ts` counts them only as a change from the same person's earlier answers, never alone, and only to make the next question easier. Nothing is shown, kept or sent. Raising an open hand for 1.5 s (MediaPipe Gesture Recognizer) is "I need a moment".
- Everything is optional and off by default.
- No scores and no judging.
- No sound or flashing, and only one notice on screen at a time.
- Camera, audio and transcripts stay on this computer and are never saved.
- Say "I could not read it" instead of guessing.
- Never judge appearance ("well groomed") or "concentration" from the eyes. Eye contact and posture may only ever be an opt-in, the person's own goal, shown as plain data ("you looked at the camera 40% of the time"), with the note that many people do well in interviews without eye contact.

**The ten conditions used as a design guide** (shown only as the optional shortcuts above, to be validated with people who live them): ADHD, autism, dyslexia, dyscalculia, dysgraphia, dyspraxia, Tourette, OCD, sensory processing, auditory processing. The ideas for the last five need checking with people who live them.

**Done:**
- Interview start in boxes (now Preparation: four boxes that show all their choices when picked, then Start; one-tap start was dropped).
- CV helper in Preparation: write from zero, tips, or fix one part.
- Video call as a spoken meeting (Zoom-like, captions of the interviewer, a control bar, "Type instead").
- Camera with a light tip and MediaPipe framing.
- "I need a moment".
- "For a real meeting": reminders, a tab-return nudge, a floating window and live captions.
- Pictograms on sections, and progress in words instead of numbers.
- Hey Constela by voice, with the "stop" command and the name-only wake word.
- "Soft light" and "Calm mode" in Personalize.
- Drafts of emails, cover letters and follow-ups, and "Check my writing" (Messages and letters in Preparation).
- "What is hard for you?" at the start of the Profile, with "Decide later".
- Dictate in Preparation, captions while the AI talks, and "Slower AI voice" (Kokoro speed 0.8).

**Next:**
1. Later: a summary after practice, meeting notes, documents with OpenCV and OCR in the Python backend (a photo of a CV or a letter turned into text and then "Translate a message"; read aloud). Also:
   - A step timer and a "yesterday" summary.
   - Support after a rejection.
   - Pay in words, and workplace noise or layout info in Jobs.
   - Bigger buttons and no drag and drop.
   - "This step is finished".
   - Optional gaze and posture data.
   - Hand gestures, which must never trigger on involuntary movements (Tourette, OCD).

**Open questions:**
- Is the list of ten conditions right?
- Should meetings outside the browser (desktop Zoom or Teams) be covered? That needs a browser extension.

## Team Astralis

Luis · Regina · Juan · Zahid · Evy
