# Capability Map: CV profile and recommendations

| Module id | Responsibility | Depends on |
|---|---|---|
| `resume-parsing` | Validate uploaded PDFs, extract text with the vendored parser folder, and return the agreed CV JSON | — |
| `profile-hub` | Add local Account, Questionnaire, and CV sections under `/profile`; persist profile data on-device | `resume-parsing` |
| `cv-recommendations` | Combine CV fields with questionnaire preferences and call the existing jobs API/index for recommendations | `resume-parsing`, `profile-hub`, existing jobs API |
| `recommended-navigation` | Add the fifth bottom navigation tab and responsive Recommended screen | `cv-recommendations` |

Build order: `resume-parsing` → `profile-hub` → `cv-recommendations` → `recommended-navigation`.

The existing `tasks/plan.md` and `tasks/todo.md` belong to earlier work and remain untouched.
