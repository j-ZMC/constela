# Spec: Resume parsing

## Objective

Expose The existing parser in `backend/resume_parser/` as a safe local web capability for the profile CV section. A user uploads a PDF, the server validates it, extracts text with `pdfplumber`, and returns the agreed JSON shape:

```json
{
  "name": "",
  "email": "",
  "phone": "",
  "skills_found": [],
  "projects": [],
  "experience": [],
  "sectors": []
}
```

The parser must not send the CV, extracted text, or personal fields to OpenAI. The JSON will be stored in the browser by the later `profile-hub` module.

## Assumptions

1. This is a local/demo web flow with no account system or remote profile database.
2. The new folder is `backend/resume_parser.py/`; its `resume_parser.py` and `resume_taxonomy.json` are the source of truth for extraction.
3. The existing Python environment is the local execution environment; `pdfplumber` must be available there or be added to the backend dependency manifest.
4. The upload is a PDF only, with a bounded size and no persistence outside the backend's controlled temporary path unless the user explicitly saves it later.
5. Parsed fields are user data; the UI must show the returned JSON and allow retry on errors.

## Contract

The web API accepts `multipart/form-data` with one field named `file` and returns:

```ts
POST /api/resume/parse
{ "profile": ResumeProfile }
```

Errors use the existing generic API style with machine-readable codes such as `invalid_input`, `unsupported_file`, `file_too_large`, `parse_failed`, and `not_configured` only when the parser environment is unavailable. The route must not expose tracebacks or raw uploaded text in error responses.

The route validates the declared MIME type and file extension, caps the upload size, writes it to a generated temporary path, invokes the parser without a shell, validates the parser JSON against the agreed schema, and removes the temporary file in all outcomes. User-provided filenames must never become execution paths.

## Tech Stack

Next.js 16 App Router route handler, React 19, TypeScript, existing Python parser, Python `pdfplumber`, and the existing Vitest/unittest setup. No new frontend dependency is required.

## Commands

```text
Dev:   npm run dev
Build: npm run build
Lint:  npm run lint
Types: npx tsc --noEmit
Test:  npm test
Python: .venv\Scripts\python.exe -m unittest discover -s backend -p "test_*.py"
```

## Project Structure

```text
backend/resume_parser/resume_parser.py       → vendored extraction logic
backend/resume_parser/resume_taxonomy.json   → extraction taxonomy
backend/resume_parser/README.md              → parser documentation
backend/test_resume_parser.py                   → parser and schema tests
backend/resume_api.py                            → JSON/stdin adapter if needed
src/app/api/resume/parse/route.ts                → upload boundary
src/lib/resume.ts                                → shared ResumeProfile schema/types
src/lib/resume.test.ts                           → schema and normalization tests
src/app/api/resume/parse/route.test.ts           → route boundary tests
```

## Code Style

Validate at the HTTP boundary, use framework multipart parsing, keep subprocess arguments separate, and validate parser output before returning it:

```ts
const parsed = resumeProfileSchema.safeParse(workerResult);
if (!parsed.success) return failure("parse_failed");
return Response.json({ profile: parsed.data });
```

Python code keeps extraction behavior in the existing parser and adds only the smallest adapter/test surface needed for the route.

## Testing Strategy

- Unit-test the agreed JSON shape, missing fields, parser taxonomy loading, and representative text extraction.
- Test the route for missing file, non-PDF input, oversized input, malformed parser output, parser failure, cleanup, and successful JSON response without a live AI call.
- Run Vitest, lint, TypeScript, Python unit tests, and a production build.
- Manually upload a real local PDF in the profile flow after `profile-hub` connects the route.

## Boundaries

- **Always:** keep the upload local to the request, cap file size, validate PDF input and parser output, remove temporary files, preserve user privacy, and return accessible error states.
- **Ask first:** adding authentication, storing uploaded PDFs remotely, adding OCR for scanned PDFs, or sending CV content to an external AI service.
- **Never:** commit personal CV files, commit secrets, execute uploaded content, interpolate filenames into shell commands, expose raw tracebacks, or store the full CV in localStorage unless the user explicitly saves the parsed JSON.

## Success Criteria

- [ ] A valid PDF returns the agreed `ResumeProfile` JSON.
- [ ] Invalid, oversized, and malformed uploads fail with stable generic errors.
- [ ] The parser runs locally and does not call OpenAI.
- [ ] Temporary uploaded files are removed after success and failure.
- [ ] Personal fields are not included in recommendation payloads by this module.
- [ ] Backend and frontend automated checks pass.

## Open Questions

1. Should scanned/image-only PDFs be rejected with a clear message, or should OCR be added later? Default: reject with a parser error; OCR is out of scope.
2. Suggested upload cap: 5 MB. Change only if the product needs larger CVs.
