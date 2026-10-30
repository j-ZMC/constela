# Implementation Plan: CV profile and recommended jobs

## Overview

Add a local CV/profile hub and a fifth Recommended navigation surface. The flow uses the existing `backend/resume_parser.py/` parser for PDF extraction, stores the agreed parsed JSON locally, preserves the existing questionnaire, and sends only non-PII CV fields to the existing jobs API for recommendations.

## Architecture Decisions

- Keep the parser as a local Python boundary; do not send CV text or personal fields to OpenAI.
- Use one validated `ResumeProfile` schema shared by parser output, the upload API, local storage, and recommendation payload construction.
- Keep account data local and minimal; no authentication or database migration.
- Preserve `/jobs` as free search and add `/recommended` as a separate bottom-nav destination.
- Persist parsed JSON and questionnaire answers in versioned localStorage records; never persist the uploaded PDF by default.
- Reuse the existing job embeddings and modality/barrier filters through the existing jobs API rather than creating a second ranking pipeline.

## Task List

### Phase 1: Resume parsing boundary
- [ ] Task 1: Validate the existing parser and define the ResumeProfile contract
- [ ] Task 2: Add the PDF upload API and temporary-file cleanup

### Checkpoint: Parser boundary
- [ ] Python parser tests pass
- [ ] Upload route rejects non-PDF and oversized files
- [ ] Valid PDF returns schema-validated JSON without sending data to OpenAI

### Phase 2: Profile hub
- [ ] Task 3: Add local profile storage and the Account/Questionnaire/CV sections
- [ ] Task 4: Connect CV upload, parsed JSON preview, retry, and clear actions

### Checkpoint: Profile hub
- [ ] Profile sections work on mobile and desktop
- [ ] Questionnaire answers remain compatible with the existing flow
- [ ] CV JSON survives reload and personal fields stay local

### Phase 3: Recommendations
- [ ] Task 5: Add a recommendation payload builder from CV + questionnaire
- [ ] Task 6: Add the Recommended route and result states

### Phase 4: Navigation and finish
- [ ] Task 7: Add the fifth bottom navigation tab and desktop navigation entry
- [ ] Task 8: Run end-to-end verification and document the local setup

### Checkpoint: Complete
- [ ] Full frontend tests, Python tests, lint, TypeScript, and build pass
- [ ] Upload, parse, save, reload, recommend, and clear flows work in the browser
- [ ] No PII is included in recommendation requests
- [ ] Ready to commit and push to the appropriate repository branches

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `pdfplumber` is unavailable in the selected Python environment | High | Add/verify the dependency before route integration; return a generic setup error |
| User uploads a scanned/image-only PDF | Medium | Return a clear parse error; keep OCR out of this scope |
| Parser output differs from the agreed JSON | High | Validate and normalize output at the API boundary |
| Recommendation query becomes too long or exposes PII | High | Allowlist skills, sectors, experience, and projects; exclude name/email/phone; cap text |
| Fifth bottom tab is crowded on small screens | Medium | Use concise labels and verify at 320/375/768/1440 widths |
| Existing unfinished task plan is overwritten | High | Use namespaced `tasks/cv-profile-*` files only |

## Open Questions

- OCR for scanned PDFs is intentionally deferred.
- Account authentication is intentionally deferred.
