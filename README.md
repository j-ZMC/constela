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
| Profile | Four parts, in order, that open where you left off: **Adaptability** ("What would help you adapt?": optional picks with a live preview of the screen settings each one turns on, and the adaptations they set; shortcuts by type; `src/lib/help-picks.ts`), **Job conditions** (workplace conditions to flag, grouped by kind of situation such as noise or time pressure, never by condition name; plus your own words as tags), **CV** (PDF read on this computer) and optional **Contact details** | `/profile` | Luis |
| My plan | Today's one step, and an **interactive constellation map** with the person in the middle and eight branches you can work on in any order: Set up your profile, Find jobs, Applications and follow-up, Interview prep, Documents and references, Learn and prepare, Experience and portfolio, and Your own steps. "All branches" shows each one's progress and lets you choose which to work on next. Saving a job, sending an application and practicing an interview light their stars by themselves. Plans saved before the branches keep their stars (their stages map to branches). The page is one sky: the map as big as the screen allows (taller on phones), with today's step beside it (under it on phones). **Hey Constela** is spoken: press it (or turn on "Listen for Hey Constela" and say the name) and ask; the local AI (Ollama, activity `plan` in `src/lib/interview.ts`) answers out loud in Kokoro's voice (the browser's voice if Kokoro is not ready), sentence by sentence, with a caption. The map is its face: the "You" star glows with your voice and pulses while it talks (`data-voice` and `--level`, `.voice-halo` in `globals.css`), and the branches the answer names light up in gold (`branchesIn` in `path-map.ts`). A question ends after a 1.5 s pause, with "Done talking", or by saying "stop" (for loud rooms: Whisper checks what was said so far every 2.5 s). After the first "Hey Constela", "Constela" alone is enough until the person leaves My plan. "Type instead" is the fallback. Whisper hears the voice on this computer (`src/lib/listen.ts`). It cannot change the plan. Also "Break it down for me" and a quiet "Need an easier step today?" | `/plan` | Luis |
| Jobs | **Jobs**: a search box over "Jobs for you" (picked from your CV); each search can go **Back** to the one before. **Internships**: only from companies with inclusion data; all of them, closest to your words first. Results have filters for work mode (also read from the location and text), pay bands (by the middle of the range, as a full-time year), company size and inclusion data; each choice shows how many jobs it leaves. Pay shows on a job when the posting gives a range, even only in its text. Every job has **Save**; the **Saved** tab keeps them on the device, with "Get to know the company" (inclusion scores, size, what the company pays, the experience the job's page asks for, and a web search about it with sources) and "I sent my application". Saving and applying move My plan forward. Jobs that match a condition or one of your words are shown apart to review, never hidden | `/jobs` | Zahid & Juan |
| Job filter backend | Cleaned US jobs dataset, barrier detection with embeddings, your own words as exact matches, and a company inclusion score ([backend/README.md](backend/README.md)) | `backend/` | Zahid |
| Learn | Courses, certificates, programs, free guides on GitHub and forums in the United States, hand-picked and checked (`src/lib/learn-resources.ts`). **Picked for your saved jobs**: what your saved jobs ask for that your CV does not show, and what teaches it (on this device). **Search company courses**: a web search limited to the official course sites of Anthropic, AWS, Google, Microsoft, NVIDIA and others. Filters by area, type, cost, format and "only for college students". Any resource can be added to My plan. The first, Mexico-only list is kept as `MEXICO_RESOURCES_LEGACY`, not shown | `/learn` | |
| Preparation (was Interview; the route is still `/interview`) | A local AI with eight activities in four boxes (`GROUPS` in `interview-chat.tsx`): **Practice an interview** (with "What to expect"), **Common questions** (with "Learn how to answer"), **Messages and letters** (translate a recruiter's message, write an email, a cover letter or a follow-up with `[blanks]` instead of made-up facts, and "Check my writing", kind proofreading), and **Write or improve your CV** (write it from zero, get tips on yours, or fix one part; it never makes up facts and leaves blanks like `[start year]`). Choosing a box shows all its choices at once as boxes with pictograms, with defaults, and Start. Cover letters, follow-ups and CV help can use a typed or saved job (`USES_JOB` in `interview.ts`). In Write modes, **Dictate** writes what you say into the box without sending it; while the AI talks, the sentence it is saying shows as a caption. **Video call** is spoken, like a meeting app: the interviewer fills the screen with captions, you are a small tile in the corner, and a control bar has Start speaking, I need a moment, Camera, Hide me and Leave; "Type instead" is the only fallback. The camera is opt-in in More options, with a check before the call (a light tip and where to put the camera); you can hide yourself or turn the camera off, and a camera that goes off gets one calm note ([camera-view.tsx](src/components/interview/camera-view.tsx), light in [camera.ts](src/lib/camera.ts)). Nothing is recorded. In Talk mode, "I need a moment" stops the microphone and the voice until you are ready. Before a video call, **MediaPipe** (`@mediapipe/tasks-vision`, face detector model in `public/models/`, its WASM from jsDelivr pinned to the installed version) says if the face is in the middle (`framingTip` in `camera.ts`). **For a real meeting** ([meeting-helper.tsx](src/components/interview/meeting-helper.tsx)): reminders the person picks, one at a time, with no sound; live captions of a shared meeting tab, written by Whisper on this computer; both can float on top of the meeting in a Document Picture-in-Picture window (Chrome and Edge). Three interview types (General, Video call, Experience questions). Write, talk, or write and listen. Can practice for a saved job, using its posting and what a web search found about the company | `/interview` | Evy |
| Personalization | Colors, text, cursor, icons, amount of information and motion, saved on the device. Also **Soft light** (a warmer, dimmer page that keeps every contrast check), **Calm mode** (no movement, no glow, Hey Constela answers in text) and **Slower AI voice** ([PERSONALIZATION.md](PERSONALIZATION.md)) | Settings (in the menu; the code still calls it Personalize). Also "Delete my data", which deletes everything and opens the first form | Regina |
| Constela for Employers | The side for companies, with its own menu and no "What would help you adapt?" window. **Jobs**: write a job post in parts, with autosave, or paste one; a clarity check points out vague phrases and missing facts (pay, the hiring steps, when they will answer), with a line on what 6,450 real job posts leave out. The AI (Groq) can read a pasted post, rewrite one vague line without adding facts, and draft interview questions. **People**: demo candidates ranked by the skills the job asks for, with "What would change the order"; needs are never read. **Seal**: Bronze, Silver or Gold, from what the job posts say and how fast the employer answers, signed so anyone can check it. **Guide**: structured interviews. Published job posts show in Jobs, and candidates answer invitations at `/invitations`. A public API for the LinkedIn extension: `/api/public/vacancies/[id]` and `/api/public/seal` (its key at `/api/public/seal/keys`, its history at `/api/public/seal/log`) | `/employers`, `/invitations`, `/seal-check` | Juan |
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
| CV reading | Constela's server (`backend/resume_parser/`) | The PDF, which is not saved |
| Job search, Internships | **Ollama, on this computer** (`qwen3-embedding:0.6b`) | The search words; nothing leaves the computer |
| Jobs for you | **Ollama, on this computer** (`qwen3-embedding:0.6b`) | Skills, sectors, experience and projects from the CV, plus your work preference |
| Learn, picks for you | **This browser** | Your saved jobs and your CV's skills; nothing is sent |
| Learn, "Search company courses" | **This browser and Constela's server**: the hand-checked list (`learn-resources.ts`) filtered to those companies' official sites | Nothing is sent anywhere |
| "Look up" on a saved job | Wikipedia's public API (no key) for the company; **Ollama on this computer** sums it up and reads the job's own page | To Wikipedia: the company name only. The page text stays on the computer |
| Interview for a saved job | **Ollama, on this computer** | The start of the posting, what it asks for, and what the web search found |
| Break it down for me | **Ollama, on this computer** (`llama3.1:8b`) | The task text and three settings that shape the answer; nothing leaves the computer |
| Constela for Employers: "Read it for me", "Write it for me", "Draft with AI" | Groq | The job post text only; no candidate's details |
| Constela for Employers: published job posts and the seal | Constela's server (`.data/`), public | Published job posts, and the dates of the employer's answers (never who they were for). When a seal starts, changes or ends, the company name, level and time go into a public history, which "Delete my data" does not remove |

Saved jobs, what "Look up" found, and "I sent my application" stay in the browser too (`saved-jobs` in localStorage). Pay, work mode and company size on a job are read from Constela's own data; nothing about the person is used for them.

The [privacy page](src/app/privacy/page.tsx) says the same in Easy Read. Keep the two in step when this changes.

## Design principles

- Adapt by needs, not by diagnosis. Nothing asks how the person feels.
- One clear next step on every screen; everything else waits behind it.
- Calm by default: mint background, navy text, star gold only for achievements, no alarm red. Motion only on the intro and when a star lights up.
- [Atkinson Hyperlegible](https://www.brailleinstitute.org/freefont/) as the main font; OpenDyslexic as an option.
- WCAG AA contrast on every text color, 44 px targets, keyboard and screen-reader use.
- Respect the system "reduce motion" setting.

## How it was validated

- **With a partner organization:** the team researched the needs of neurodivergent job seekers with Kairos Inclusión,
  the challenge's partner organization (socio formador).
- **With people with ADHD:** people the team knows who have ADHD tried the app.
- **With real CVs, with permission:** the CV parser was tested with CVs from people who agreed to it. Those CVs are not
  in this repository (`backend/resume_parser/resumes/` is ignored by git); the tests use made-up data.
- **Measured, on the employer side:** the employer AI against the real model ([evals/REPORT.md](evals/REPORT.md):
  29 of 32 vague lines got a clear rewrite, and none of them added a fact); 6,450 real job posts from this
  repository's data ([evals/POSTINGS.md](evals/POSTINGS.md): of the 2,729 with their whole text, 3 in 10 use a vague
  phrase, and none says when they will answer); and the ranking's promises on 9,000 synthetic people ([evals/FAIRNESS.md](evals/FAIRNESS.md): 142,889
  checks, none broken). The seal's signature reproduces the published RFC 8037 test vector.

Still to validate: the other conditions in "Shortcuts by type" (only ADHD was tested with people who have it).

### Choices about people and data

- **"Shortcuts by type" names conditions on purpose.** Choosing help one need at a time is hard if you do not know
  which needs apply to you; the shortcuts let a person find the help that fits their condition faster. They are
  optional, they only turn on screen settings, and which one was chosen is never stored or sent.
- **"Inclusive company" uses Glassdoor on purpose.** Kairos Inclusión told the team that a workplace is really good
  for neurodivergent people only when people there feel included and get accommodations. Glassdoor's Diversity &
  Inclusion rating comes from employees' own reviews, so it is the closest public signal to that; B Corp and DEI lists
  add to it. It is a review-based signal, not a verified measure of accessibility, and companies with no data are
  shown as unknown, never as bad.
- **The camera does not read facial expressions.** "Adjust the practice" used to read face tension (MediaPipe Face
  Landmarker). It was removed in November 2026: reading expressions can misread autistic people and others whose
  expression differs, and it could not be validated with them in time. The camera still says whether the face is in
  the middle of the picture, and an open hand held up still means "I need a moment".
- **Only job sources that allow it.** LinkedIn and Indeed were left out of the job data because their terms do not
  allow collecting their postings. The jobs in this repository come from public job APIs and feeds: Dice, Y Combinator,
  Greenhouse, Ashby, RemoteOK, Lever and Remotive (6,450 jobs and 158 internships, none from LinkedIn or Indeed).

## Tech stack

[Next.js 16](https://nextjs.org) · [shadcn/ui](https://ui.shadcn.com) on [Base UI](https://base-ui.com) · Tailwind CSS · TypeScript · Python (job filter, CV parser, Whisper, Kokoro) · [Ollama](https://ollama.com) · [faster-whisper](https://github.com/SYSTRAN/faster-whisper) · [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx)

## How to set up

Constela runs on your own computer. All its AI runs locally, except the AI in Constela for Employers, which uses
Groq.

### 1. Install the tools

| Tool | Version | Get it |
| --- | --- | --- |
| Node.js | 20 or newer | https://nodejs.org |
| Python | 3.10 or newer (3.12 recommended) | https://www.python.org/downloads (on Windows, tick "Add python.exe to PATH") |
| Ollama | latest | https://ollama.com/download (open it once so it keeps running) |
| Git | any | https://git-scm.com/downloads |

An NVIDIA GPU makes the interview faster, but it is not required.

### 2. Get the code

```bash
git clone https://github.com/j-ZMC/constela.git
cd constela
npm install
```

The job data, the search vectors and the Kokoro voice model come with the repository.

### 3. Change settings (optional)

Only Constela for Employers needs a key (below). To change the Ollama address or model, the Whisper model or the Kokoro voice, copy the example
file and edit it:

```bash
cp .env.example .env.local    # PowerShell: Copy-Item .env.example .env.local
```

Only the AI in Constela for Employers needs a key: put a free Groq key in `GROQ_API_KEY`
(https://console.groq.com/keys). Everything else works without one. See [Environment variables](#environment-variables)
for each setting.

### 4. Start it

```bash
npm run dev
```

The first time, this sets everything up before starting (about 2 GB, once; 5 to 15 minutes): it runs
`backend/setup_local.py`, which creates the Python environment in `.venv`, downloads Whisper, and pulls the Ollama models (`llama3.1:8b`, `qwen3-embedding:0.6b`). Later starts only check a marker file
(`.venv/.constela-setup-done`) and begin at once.

### 5. Open the app

Go to http://localhost:3000. The first time (and after "Delete my data"), the home page says "Welcome to Constela".
"Start" leads through the Profile: Adaptability, Job conditions, CV (it can be skipped) and Contact details. Then a
tour shows My plan, goes on to Jobs, and ends in Preparation. "How this works" in My plan shows its tour again.

### If something does not work

| What you see | What to do |
| --- | --- |
| "Setup did not finish" when starting | Run `npm run setup` and read the step that failed. Delete `.venv` to start the setup over. |
| Jobs says the service is not set up | The Python environment is missing: run `npm run setup`. |
| The interview does not answer | Open Ollama, then run `ollama pull llama3.1:8b`. |
| The interview is slow | Run `ollama ps`: it should say `100% GPU`. If not, quit Ollama and open it again (see [below](#interview-ollama-whisper-and-kokoro)). |
| The AI speaks with the browser's voice | Kokoro is still loading the first time; wait a few seconds. Check that `backend/models/kokoro/` has both files. |

### Environment variables

Set these in `.env.local`. Only the keys for the features you use are needed.

| Variable | Used by | Notes |
| --- | --- | --- |
| `GROQ_API_KEY` | Constela for Employers | Free key at https://console.groq.com/keys |
| `GROQ_MODEL` | Constela for Employers | Optional; defaults to `openai/gpt-oss-20b` |
| `PUBLIC_API_WRITES` | Constela for Employers | Optional; `on` lets `npm start` receive published job posts for the public API (`npm run dev` always can). Leave it off on a public server: there are no accounts yet, so nothing proves who is writing |
| `SEAL_SIGNING_KEY` | The seal | Optional; an Ed25519 private key (PKCS#8 PEM). Without it, Constela makes one in `.data/seal-signing-key.pem`. Set it on a server, so seals stay checkable after a new deploy |
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

The job data comes with the repository. To rebuild it (see the [backend README](backend/README.md)):

```powershell
cd backend
..\.venv\Scripts\python.exe company_inclusion.py
..\.venv\Scripts\python.exe select_qualified_companies.py
..\.venv\Scripts\python.exe embed_jobs.py
# Company size filter: B Corp, Y Combinator, the posting itself, an AI estimate; --web searches the rest
# (re-run after collecting new jobs; --web 200 took 3 minutes and found 91 of 200)
..\.venv\Scripts\python.exe company_sizes.py --web 200
# Internships tab: collect them, then embed them (run weekly: internships are seasonal)
..\.venv\Scripts\python.exe collect_internships.py
..\.venv\Scripts\python.exe embed_jobs.py --jobs data/raw/jobs/internships.json --emb data/processed/embeddings/internships_qwen3_embeddings.npy --ids data/processed/embeddings/internships_qwen3_ids.json
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

The AI's voice is Kokoro-82M through `kokoro-onnx`, which runs the model without PyTorch. It runs on the CPU, which is fast enough for a model this small (a 5-second sentence takes about half a second) and leaves the GPU to Ollama and Whisper. The model comes with the repository in `backend/models/kokoro/`: the int8 model (88 MB, under GitHub's 100 MB file limit and as fast as the full one) and the voices (27 MB). If they are missing, `backend/speak_server.py` downloads them there. Choosing Talk or Write and listen starts loading it.

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
| `npm run eval:ai` | Measure the employer AI against the real model; writes [evals/REPORT.md](evals/REPORT.md). Needs `GROQ_API_KEY`, about 15 minutes |
| `npm run eval:replay` | Run the answers `eval:ai` recorded through the current guards, offline |
| `npm run eval:postings` | Read 6,450 real job posts and write [evals/POSTINGS.md](evals/POSTINGS.md), in seconds |
| `npm run eval:fairness` | Check the ranking's promises on 9,000 synthetic people and write [evals/FAIRNESS.md](evals/FAIRNESS.md) |
| `cd backend; ..\.venv\Scripts\python.exe -m unittest` | Run the Python tests |

## Project map

| Folder | What is there |
| --- | --- |
| `src/app/` | Pages (`/`, `/profile`, `/plan`, `/jobs`, `/learn`, `/interview`, `/privacy`; `/recommended` redirects to `/jobs`; the employer side under `/employers`, plus `/invitations` and `/seal-check`) and API routes (`/api/jobs`, `/api/jobs/posting`, `/api/company/research`, `/api/learn/search`, `/api/resume/parse`, `/api/breakdown`, `/api/interview`, `/api/interview/warm`, `/api/interview/transcribe`, `/api/interview/speak`, `/api/employer-ai`, `/api/employer-sync`, `/api/public/...`) |
| `src/components/` | Screens by module (`profile/`, `plan/`, `jobs/`, `interview/`, `employers/`) and shared UI in `ui/` |
| `src/lib/` | Logic without screens, with tests next to it: the plan and path, the constellation map, jobs (schema, filters, saved jobs, company facts, web research, job page reading), the interview prompt and context, the Python workers for Whisper and Kokoro, and the employer side (job posts and their clarity check, the employer AI and its guards, the ranking, the seal, its signature and public history) |
| `evals/` | Measurements of the employer side, with their reports: the employer AI against the real model (`REPORT.md`), 6,450 real job posts (`POSTINGS.md`) and the ranking on 9,000 synthetic people (`FAIRNESS.md`) |
| `.data/` | Made while the app runs, never in git: published job posts, the seal history and the seal's signing key |
| `backend/` | Python: collectors (`collect_bulk.py`, `collect_internships.py`), company data (`company_inclusion.py`, `select_qualified_companies.py`, `company_sizes.py`), embeddings and the job filter (`embed_jobs.py`, `filter_jobs.py`), CV parser, `transcribe_server.py` (Whisper) and `speak_server.py` (Kokoro) on the shared `worker_protocol.py`, data and tests |

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

The CV parser is in `backend/resume_parser/`. Its hand-test mode saves CVs in `backend/resume_parser/resumes/`, which git ignores: test CVs are real people's data and never go in the repository. Third-party source reports (`backend/data/reference/source_docs/`, 22 MB) are kept out of git too; the app does not read them.

### How the app is put together

- **Layout (November 2026).** On wide screens the app menu is a fixed bar on the left (`site-nav.tsx`); `<body>` gets `lg:has-[[data-side-nav]]:pl-56` so pages move over by its width. Jobs, Internships, Saved and Learn show cards a page at a time with a filter panel that opens and closes (`paged-grid.tsx`). Learn has three tabs: All courses, Picked for you, Company courses. My plan shows the map and today's step only; the header says "Now: step 2 of 4 in Find jobs". Preparation: the interviewer has a level (Easy, Medium, Hard; `LEVELS` in `interview.ts`), a Technical questions type, fits questions to the job, and "For a real meeting" shows only under Practice an interview.
- A new rule in `globals.css` may not reach the browser until `next dev` restarts (see below); Tailwind classes in components update at once, so layout fixes that must show now belong there.

- **No accounts, no database.** Everything about the person lives in `localStorage`. The keys are listed in [delete-my-data.tsx](src/components/delete-my-data.tsx). A new key must go there, on the [privacy page](src/app/privacy/page.tsx) and in "Where data goes" above.
- **Python runs inside Next.** `/api/jobs` starts `backend/filter_jobs.py --json` for every search; its stdout must be **only** the JSON result (diagnostics go to stderr; a stray `print` breaks every search). Whisper and Kokoro are long-running workers ([python-worker.ts](src/lib/python-worker.ts)), kept on `globalThis` so hot reloads do not start copies.
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

The files the app reads (the job lists, the company databases and the Qwen3 search vectors) are in the repository, so a fresh clone needs none of these steps. Run them only to rebuild the data, in order:

| Step | Writes | Cost and time |
| --- | --- | --- |
| `company_inclusion.py`, `select_qualified_companies.py` | `data/processed/*.sqlite` (inclusion scores; which companies qualify) | Free; reads the 9.9M-row Glassdoor CSV in chunks |
| `embed_jobs.py` | Job and barrier embeddings with `qwen3-embedding:0.6b` on Ollama (`ollama pull qwen3-embedding:0.6b` first) | Free; a few minutes on the GPU |
| `company_sizes.py --web 200` | `data/reference/company_data/company_sizes.json` | About 15 cheap model calls plus 25 web searches, 3 minutes. Model answers are cached; re-run after new jobs |
| `collect_internships.py` | `ats_boards.json` (cached boards of inclusion-verified companies; delete it or pass `--rediscover` to look again, about 10 minutes) and `data/raw/jobs/internships.json` | Free; about 2 minutes. Then embed it with the `embed_jobs.py --jobs ... --emb ... --ids ...` line above |

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

- Constela for Employers, brought into this version on 4 November 2026:
  - Its AI still runs on Groq, not on the local Ollama. Moving it means running `npm run eval:ai` again on the new model.
  - People with the same score should show as tied: in 65% of the synthetic pools, the order by id decided who made the
    top 5 ([evals/FAIRNESS.md](evals/FAIRNESS.md)). The same audit shows that the weight of a checked skill passes on any
    gap in who gets their skills checked.
  - The seal history keeps company names after "Delete my data", or it would prove nothing.
  - The public API has no accounts, so its writes stay off on a public server (`PUBLIC_API_WRITES`). The LinkedIn
    extension should accept the new `token` field of `/api/public/seal` and pin the key id (`kid`).
- Not built yet: a finder for proven certifications and their courses, and a country filter for internships. The CV helper exists as a chat in Preparation; the parser still does not read education or certifications, and the helper cannot tailor a CV to a saved job yet.
- After the move from OpenAI to Ollama (3 to 4 November 2026) everything runs on the local computer except the Wikipedia call in "Look up" and the AI in Constela for Employers (Groq). "Break it down for me" moved from Groq to Ollama on 5 November. "Company courses" now searches only the hand-checked list (1 or 2 courses per company), so it is short. The conditions filter (`BLOCKED_THRESHOLD = 0.35`) sets apart about 3.6% of condition-and-job pairs, and every condition flags at least 10 jobs; check it with real people. `company_sizes.py` still uses OpenAI. The old `*_openai_*` caches in `data/processed/embeddings/` can be deleted.
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
- The person chooses the help, never a diagnosis: never ask for, store or infer a condition. One exception (November 2026): "Shortcuts by type (optional)" in "What would help you adapt?" names the ten types (`NEURO_TYPES` in `src/lib/help-picks.ts`). Choosing one only turns on screen settings; which one was chosen is never stored or sent. A second exception: "Adjust the practice to how it is going" in Preparation (off by default) measures pauses and pace in the voice (no model, in `transcribe_server.py`; it does not guess feelings) on this computer. It never reads the face. It is weak evidence (people pause and speak at very different paces), so `src/lib/practice-signals.ts` counts it only as a change from the same person's earlier answers, never alone, and only to make the next question easier. Nothing is shown, kept or sent. Raising an open hand for 1.5 s (MediaPipe Gesture Recognizer) is "I need a moment".
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
- "What would help you adapt?" at the start of the Profile, with "Decide later".
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

## AI assistance and licenses

### AI tools used to build Constela

The team used AI coding assistants while building this project. The team is responsible for all the code in this
repository. Changes made with AI were checked with the project's tests (Vitest and Python `unittest`), the type check,
lint, and in the running app (see [Checking your work](#checking-your-work)).

| Model | Used for |
| --- | --- |
| Claude Opus 5.5, Claude Sonnet 5.5 and Claude Haiku 5.5 (Anthropic) | Writing code, design and UX (screens, accessibility, design critiques), debugging and tests, documentation and repository setup |
| Luna 5.6 and Luna 6.0 (OpenAI) | Writing code |
| Muse Spark 1.3 (Meta) | Writing code, research and writing |

### AI models that run in the app

Everything below runs on the person's own computer, except the last row.

| Model | What it does in Constela | License |
| --- | --- | --- |
| [Llama 3.1 8B](https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct) (Meta), through Ollama | Preparation chat, "Look up" summaries, "Break it down for me" | [Llama 3.1 Community License](https://www.llama.com/llama3_1/license/). Built with Llama. |
| [Qwen3-Embedding-0.6B](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B) (Qwen, Alibaba), through Ollama | Job search vectors (the files in `backend/data/processed/embeddings/` were made with it) | Apache 2.0 |
| [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (hexgrad), int8 ONNX files from [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) | The AI's voice. The files are in `backend/models/kokoro/` | Apache 2.0 |
| [Whisper small.en](https://huggingface.co/Systran/faster-whisper-small.en) (OpenAI), CTranslate2 version by SYSTRAN | Speech to text in Talk mode | MIT |
| MediaPipe BlazeFace (short range) and Gesture Recognizer (Google) | Camera framing (is the face in the middle) and the open-palm gesture. The files are in `public/models/` | Apache 2.0 |
| [gpt-oss-20b](https://huggingface.co/openai/gpt-oss-20b) (OpenAI), **on Groq's servers** | In Constela for Employers: reading a pasted job post, rewriting a vague line, drafting interview questions | Apache 2.0 |

### Code from other projects

The CV parser's first version was based on [Vbhargav370/resume_parser.py](https://github.com/Vbhargav370/resume_parser.py)
(pdfplumber and Tkinter). That project has no license, so the parts that came from it (reading the PDF, and finding the
name, email, phone and projects) were rewritten in November 2026. The taxonomy, skills, sectors, experience, validation
and the mode the app uses are the team's own.

### Software the models run on

The software that runs them: [Ollama](https://github.com/ollama/ollama) (MIT),
[ONNX Runtime](https://github.com/microsoft/onnxruntime) (MIT), [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) (MIT),
[faster-whisper](https://github.com/SYSTRAN/faster-whisper) (MIT) and
[MediaPipe Tasks Vision](https://www.npmjs.com/package/@mediapipe/tasks-vision) (Apache 2.0).

"Adjust the practice" measures pauses and pace in the voice directly (`backend/transcribe_server.py`), without a model.

Data preparation: part of the company sizes in `backend/data/reference/company_data/company_sizes.json` were estimated
by `gpt-5-mini` (OpenAI) through `backend/company_sizes.py`, which the team ran by hand. The app itself never calls it.

## Team Astralis

Luis · Regina · Juan · Zahid · Evy

### How the work was split

The git history (26 October to 4 November 2026) shows who built what:

- **Luis** (LuisACastellanosA): the app's base and design system (`DESIGN.md`), navigation, the night sky, the "How
  this works" tours, the Interview module (built from Evy's coach prototype), and merging the team's branches.
- **Juan** (Juan Juarez): Constela for Employers, the side of the app for companies: vacancies written in clear
  language, talent search, structured interviews and invitations, and an inclusion seal. He built it on its own branch
  (30 October to 2 November), and Luis merged it into the team repository on 2 November (`65203a0`); his commits are
  in this history. It was brought into this version on 4 November 2026, with Luis's later styling, a public API for
  the LinkedIn extension, a signed seal anyone can check, and three measurements in `evals/`.
- **Zahid** (j-ZMC): the Python backend (job collectors, company inclusion data, the job search and its vectors), the
  CV profile and job recommendations, the move to local AI, and the preparation of the final version.
- **Regina**: the UX design of the web app. She sent drawings of the screens, and the team built them in code, so
  the look of the app and the presentation both follow her design. Her work is in the Settings (Personalization)
  screen and the optional "less chaotic" LinkedIn extension in the feature list. She has no commits of her own, because
  the drawings were not made in the repository.
- **Evy**: the first version of the interview coach, a single HTML page (`entrenador1.html`) made for this challenge
  and shared with the team on WhatsApp on 1 November 2026. Evy is in her first semester and had not used GitHub yet, so
  her work has no commits of its own. Luis built the Interview module from it the same day (`ff735e8`): practice with
  feedback ("what went well" and "one thing to try", never a score), AI questions with four standard questions as a
  fallback, follow-up questions, "How to answer" steps, and options for shorter and gentler feedback. The module later
  grew into Preparation, which keeps those ideas.

Two of Zahid's commits are large (about 10,000 lines each) because they were the preparation of the final version,
not new work added at once:

- `7ab3a76` (3 November) merges the team branch and brings together work done in parallel: the branched My plan, the
  "Hey Constela" voice, Learn, and the Interview and Jobs updates.
- `52af141` (4 November) moves the app to local AI (Ollama, Whisper, Kokoro) for the final version. About 70% of its
  lines are job data (JSON).
