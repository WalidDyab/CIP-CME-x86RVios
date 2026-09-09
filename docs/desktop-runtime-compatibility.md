# Desktop runtime compatibility review

Validated 2026-09-08 in D:\WSCodex\CIP-CME-x86RVios.
Branch: `codex-feature/desktop-runtime-compatibility`.
Starting/current HEAD and local main: `473b258006886f10b75c605925b1aff4c178ee23`.
The working tree was clean before implementation. Remote freshness was not independently verified.

## 1. Audit findings

Audited all 22 full portal pages, both shared HTML fragments, and allowlisted CSS/JS, local assets, export libraries, JSON/template paths, and report-generation templates.

- 15 executable inline scripts, including Undergraduate/MSc course initialization and NQF initialization.
- 17 inline style blocks; 41 fixed style attributes (including generated markup), plus four dynamically generated style attributes for track colors/PLO bars.
- Zero HTML event-handler attributes. Six existing JavaScript event-property registrations are function assignments and remain CSP-safe.
- Four pages depended on CDN jsPDF 4.2.1 and AutoTable 5.0.8: Undergraduate course dashboard, program overview, SO leader dashboard, and MSc course dashboard.
- Three MSc views depended on Google Fonts (Inter).
- Existing JSZip and both DOCX generators already used local assets/templates.
- The prerequisite layout and credit distribution used numeric CSSOM property writes; DOCX `options.style` and XML namespace URLs are document data, not browser inline CSS/network requests.
- External ABET, Google Forms/Slides and simulator links are user navigation, not initialization dependencies, and remain unchanged.

## 2. Exact existing files changed

```text
about.html
assets/footer.html
assets/program-prerequisites.css
assets/program-prerequisites.js
assets/program-structure.js
curriculum-vision/clo-revision-report-term-251-to-261.html
curriculum-vision/clo-revision-report-term-252.html
curriculum-vision/index.html
curriculum-vision/major-revision/benchmarking/index.html
curriculum-vision/major-revision/index.html
curriculum-vision/nqf-2026-transition.html
index.html
msc-ee/concentration-dashboard.html
msc-ee/concentration-view.html
msc-ee/course-dashboard.html
msc-ee/course-view-v4.html
msc-ee/index.html
msc-ee/program-dashboard.html
msc-ee/unified-advising-view.html
online-teaching-support/index.html
packaging/desktop-runtime-files.json
scripts/generate_clo_revision_report_term_251_to_261.mjs
scripts/generate_term_252_clo_report.mjs
scripts/update-csp-hashes.mjs
undergraduate-ee/clo-methods-review.html
undergraduate-ee/course-dashboard.html
undergraduate-ee/index.html
undergraduate-ee/program-overview.html
undergraduate-ee/so-leader-dashboard.html
undergraduate-ee/teaching-assessment-methods.html
```

## 3. Exact new files

```text
assets/pages/about.css
assets/pages/curriculum-vision-clo-revision-report-term-251-to-261.css
assets/pages/curriculum-vision-clo-revision-report-term-251-to-261.js
assets/pages/curriculum-vision-clo-revision-report-term-252.css
assets/pages/curriculum-vision-clo-revision-report-term-252.js
assets/pages/curriculum-vision-index.css
assets/pages/curriculum-vision-nqf-2026-transition.css
assets/pages/curriculum-vision-nqf-2026-transition.js
assets/pages/index.css
assets/pages/msc-ee-concentration-dashboard.js
assets/pages/msc-ee-concentration-view.css
assets/pages/msc-ee-concentration-view.js
assets/pages/msc-ee-course-dashboard.css
assets/pages/msc-ee-course-dashboard.js
assets/pages/msc-ee-course-view-v4.css
assets/pages/msc-ee-course-view-v4.js
assets/pages/msc-ee-index.js
assets/pages/msc-ee-program-dashboard.js
assets/pages/msc-ee-unified-advising-view.css
assets/pages/msc-ee-unified-advising-view.js
assets/pages/online-teaching-support-index.css
assets/pages/undergraduate-ee-clo-methods-review.css
assets/pages/undergraduate-ee-clo-methods-review.js
assets/pages/undergraduate-ee-course-dashboard.css
assets/pages/undergraduate-ee-course-dashboard.js
assets/pages/undergraduate-ee-index.css
assets/pages/undergraduate-ee-program-overview.css
assets/pages/undergraduate-ee-program-overview.js
assets/pages/undergraduate-ee-so-leader-dashboard.css
assets/pages/undergraduate-ee-so-leader-dashboard.js
assets/pages/undergraduate-ee-teaching-assessment-methods.css
assets/pages/undergraduate-ee-teaching-assessment-methods.js
assets/runtime-utilities.css
assets/vendor/jspdf.plugin.autotable.min.js
assets/vendor/jspdf.umd.min.js
assets/vendor/pdf-licenses.json
docs/desktop-runtime-compatibility.md
scripts/smoke_runtime_compatibility.py
scripts/test_runtime_compatibility.py
```

## 4–6. Inline script, event and style status

No executable inline scripts, HTML event-handler attributes, style blocks, static style attributes, generated style attributes, or style-text setters remain in the runtime HTML/application JS.

Page scripts remain at their original parser positions; existing deferred shared scripts and DOMContentLoaded registrations retain their ordering. No new globals were introduced to emulate HTML event handlers. Stylesheets remain at the original style-block positions. Shared utility classes retain fixed inline declaration precedence; the three Inter views use a system UI font stack.

Fixed MSc track colors and integer PLO bar percentages use predefined classes. Prerequisite connector visibility and fixed year/semester header rows use existing stylesheet ownership and classes.

Six intentional numeric CSSOM assignment sites remain:

- `assets/program-prerequisites.js`: grid column count; course grid column/row; year column/span; semester column (five sites).
- `assets/program-structure.js`: exact credit-share width (one site).

These use individual CSSOM properties from numeric data, not setAttribute/style text or cssText. They preserve data-dependent placement without hard-coding course counts. Edge applied them under the supplied CSP with zero violations. The populated program overview has 62 elements whose CSSOM values serialize into style attributes; these are the only observed runtime style attributes. No CSP relaxation is needed.

## 7, 9–10. Dependencies and offline operation

jsPDF 4.2.1 and AutoTable 5.0.8 are local under `assets/vendor/`. Their bytes match the previous SHA-512 integrity values, which remain on the script elements. Upstream notices are intact; complete MIT license texts and provenance are packaged in `assets/vendor/pdf-licenses.json`.

No runtime CDN scripts/styles, Google Fonts requests, or remote rendering/data dependencies remain. License/provenance URLs are inert metadata. No fonts were downloaded. JSZip remains unchanged. Page CSP metadata no longer allows inline styles, obsolete script hashes, or CDN/font origins; desktop CSP was not edited or weakened.

The exercised PDF paths use jsPDF text/AutoTable APIs. Optional vendor HTML-rendering APIs are not used by these workflows.

## 8. Initialization and functional results

- Undergraduate course selector populated all 32 courses; changing the selection rendered the requested course.
- MSc course dashboard and V4 view populated all 32 courses; search, selection and URL query updates worked. Program/concentration/advising views populated, including four concentration tracks.
- NQF descriptors and ABET matrix rows matched the JSON counts.
- Assessment course rows, CLO-method review, SO evidence, program structure and prerequisite nodes populated.
- Course CLO/reference review overlays opened and closed.
- Native print events and printable PDF output worked for both report pages in headless Edge.
- Downloads were captured and checked for PDF/PNG signatures or DOCX ZIP document contents:
  - MSc course PDF (`EE_511_Report.pdf`).
  - Undergraduate course PDF (`EE_351_Report.pdf`).
  - Textbook/reference-list PDF.
  - SO1 mapping-review PDF.
  - NCAAA course-specification DOCX (EE351).
  - NCAAA field-experience DOCX (EE492).
  - Full Term 251-to-261 CLO revision DOCX.
  - PI and SO heatmap PNGs.

All JSON/data paths, academic content, page URLs and template binaries remain unchanged.

## 11. Packaging

Allowlist grew from 67 to 103 files: 15 page scripts, 17 page stylesheets, one shared utility stylesheet, two vendor scripts and one license JSON (36 additions). No entries were removed. Every new runtime file is allowlisted; documentation and test scripts are not runtime inputs.

```text
assets/pages/about.css
assets/pages/curriculum-vision-clo-revision-report-term-251-to-261.css
assets/pages/curriculum-vision-clo-revision-report-term-251-to-261.js
assets/pages/curriculum-vision-clo-revision-report-term-252.css
assets/pages/curriculum-vision-clo-revision-report-term-252.js
assets/pages/curriculum-vision-index.css
assets/pages/curriculum-vision-nqf-2026-transition.css
assets/pages/curriculum-vision-nqf-2026-transition.js
assets/pages/index.css
assets/pages/msc-ee-concentration-dashboard.js
assets/pages/msc-ee-concentration-view.css
assets/pages/msc-ee-concentration-view.js
assets/pages/msc-ee-course-dashboard.css
assets/pages/msc-ee-course-dashboard.js
assets/pages/msc-ee-course-view-v4.css
assets/pages/msc-ee-course-view-v4.js
assets/pages/msc-ee-index.js
assets/pages/msc-ee-program-dashboard.js
assets/pages/msc-ee-unified-advising-view.css
assets/pages/msc-ee-unified-advising-view.js
assets/pages/online-teaching-support-index.css
assets/pages/undergraduate-ee-clo-methods-review.css
assets/pages/undergraduate-ee-clo-methods-review.js
assets/pages/undergraduate-ee-course-dashboard.css
assets/pages/undergraduate-ee-course-dashboard.js
assets/pages/undergraduate-ee-index.css
assets/pages/undergraduate-ee-program-overview.css
assets/pages/undergraduate-ee-program-overview.js
assets/pages/undergraduate-ee-so-leader-dashboard.css
assets/pages/undergraduate-ee-so-leader-dashboard.js
assets/pages/undergraduate-ee-teaching-assessment-methods.css
assets/pages/undergraduate-ee-teaching-assessment-methods.js
assets/runtime-utilities.css
assets/vendor/jspdf.plugin.autotable.min.js
assets/vendor/jspdf.umd.min.js
assets/vendor/pdf-licenses.json
```

An actual release built and verified from a temporary copy of all 103 runtime files, with each manifest hash checked against the source. The `release.json` / `site/` contract is unchanged. Release ID was not bumped. No existing generated release was replaced. Existing desktop-release Git ignore behavior passed its test.

## 12. Validation

- `python scripts/test_runtime_compatibility.py`: 6 tests passed (runtime policy, local asset resolution/inclusion, SRI, CSS/generated markup, real temporary release, report templates and temporary Term 252 regeneration).
- `python scripts/test_package_desktop_release.py`: 7 tests passed. Its duplicate ZIP member warning is from an intentional negative test.
- `node scripts/test-reference-management.js`: passed.
- `node scripts/test-ncaaa-cs-generator.js`: passed.
- `node scripts/test-clo-revision-docx-generator.js`: passed.
- `python scripts/test_generate_ncaaa_cs.py`: 8 tests passed.
- `node --check`: all 28 runtime JS files and both changed report-generator scripts passed.
- `node scripts/update-csp-hashes.mjs --check`: all 24 runtime HTML files clean. The checker now uses the runtime allowlist instead of recursively scanning protected generated releases and development files.
- `python scripts/smoke_runtime_compatibility.py`: all 22 full pages passed; targeted follow-up checks covered all export variants and the final prerequisite styling.
- Browser tests used installed Microsoft Edge through optional Python Playwright, an allowlist-only HTTP server, and the exact supplied desktop CSP as a response header. External runtime requests were rejected and would fail the test. There were zero page errors, failed runtime HTTP responses, external runtime requests or CSP violations in the exercised pages/workflows.
- Six before/after viewport screenshots were byte-identical at 1440×1000: root index, about, Undergraduate course dashboard, NQF, teaching/assessment methods, and online teaching support. The program overview was also visually reviewed; its final computed-style comparison matched across 2,132 sampled elements. Final computed-style comparisons matched on all seven sampled pages. The three font-switched MSc views are intentionally not claimed pixel-identical.
- Local asset references and packaging references passed static checks. Data and release-ID diffs are empty.
- `git diff --check`: passed.

Repeat static/package tests with `python -B` to avoid refreshing the repository's pre-existing tracked Python bytecode. Browser tests are optional developer tooling; no application package manager, framework, bundler or build step was added. The browser test requires Playwright and installed Edge. Temporary installed test dependencies/downloads were removed after validation.

## 13. Limits and pre-existing failure

No unresolved CSP incompatibility was observed in the exercised runtime. Six numeric CSSOM sites are intentional and validated, as described above.

The offline `scripts/generate_clo_revision_report_term_251_to_261.mjs` generator cannot currently complete against the existing academic inputs: `Missing editorial comment for EE 221|1.1->1.1`. The identical failure was reproduced from the unmodified starting commit in a temporary directory. Its HTML template now uses external assets, but the editorial validation/data was not changed. The existing packaged report and its browser DOCX export pass. The Term 252 offline generator passed in a temporary directory.

Testing used browser HTTP with the supplied CSP, not the separately maintained native CIP Desktop executable at `https://cip.localhost/`. Native navigation/download/print-dialog integration and OS-specific font rendering remain for desktop release review. No native runtime changes were attempted.

## 14. Git status

All changes remain unstaged and uncommitted on `codex-feature/desktop-runtime-compatibility`. Exact modified/new inventories appear above. No deletions, staged changes or changes to data/release ID. HEAD remains `473b258`.

```text
 M about.html
 M assets/footer.html
 M assets/program-prerequisites.css
 M assets/program-prerequisites.js
 M assets/program-structure.js
 M curriculum-vision/clo-revision-report-term-251-to-261.html
 M curriculum-vision/clo-revision-report-term-252.html
 M curriculum-vision/index.html
 M curriculum-vision/major-revision/benchmarking/index.html
 M curriculum-vision/major-revision/index.html
 M curriculum-vision/nqf-2026-transition.html
 M index.html
 M msc-ee/concentration-dashboard.html
 M msc-ee/concentration-view.html
 M msc-ee/course-dashboard.html
 M msc-ee/course-view-v4.html
 M msc-ee/index.html
 M msc-ee/program-dashboard.html
 M msc-ee/unified-advising-view.html
 M online-teaching-support/index.html
 M packaging/desktop-runtime-files.json
 M scripts/generate_clo_revision_report_term_251_to_261.mjs
 M scripts/generate_term_252_clo_report.mjs
 M scripts/update-csp-hashes.mjs
 M undergraduate-ee/clo-methods-review.html
 M undergraduate-ee/course-dashboard.html
 M undergraduate-ee/index.html
 M undergraduate-ee/program-overview.html
 M undergraduate-ee/so-leader-dashboard.html
 M undergraduate-ee/teaching-assessment-methods.html
?? assets/pages/about.css
?? assets/pages/curriculum-vision-clo-revision-report-term-251-to-261.css
?? assets/pages/curriculum-vision-clo-revision-report-term-251-to-261.js
?? assets/pages/curriculum-vision-clo-revision-report-term-252.css
?? assets/pages/curriculum-vision-clo-revision-report-term-252.js
?? assets/pages/curriculum-vision-index.css
?? assets/pages/curriculum-vision-nqf-2026-transition.css
?? assets/pages/curriculum-vision-nqf-2026-transition.js
?? assets/pages/index.css
?? assets/pages/msc-ee-concentration-dashboard.js
?? assets/pages/msc-ee-concentration-view.css
?? assets/pages/msc-ee-concentration-view.js
?? assets/pages/msc-ee-course-dashboard.css
?? assets/pages/msc-ee-course-dashboard.js
?? assets/pages/msc-ee-course-view-v4.css
?? assets/pages/msc-ee-course-view-v4.js
?? assets/pages/msc-ee-index.js
?? assets/pages/msc-ee-program-dashboard.js
?? assets/pages/msc-ee-unified-advising-view.css
?? assets/pages/msc-ee-unified-advising-view.js
?? assets/pages/online-teaching-support-index.css
?? assets/pages/undergraduate-ee-clo-methods-review.css
?? assets/pages/undergraduate-ee-clo-methods-review.js
?? assets/pages/undergraduate-ee-course-dashboard.css
?? assets/pages/undergraduate-ee-course-dashboard.js
?? assets/pages/undergraduate-ee-index.css
?? assets/pages/undergraduate-ee-program-overview.css
?? assets/pages/undergraduate-ee-program-overview.js
?? assets/pages/undergraduate-ee-so-leader-dashboard.css
?? assets/pages/undergraduate-ee-so-leader-dashboard.js
?? assets/pages/undergraduate-ee-teaching-assessment-methods.css
?? assets/pages/undergraduate-ee-teaching-assessment-methods.js
?? assets/runtime-utilities.css
?? assets/vendor/jspdf.plugin.autotable.min.js
?? assets/vendor/jspdf.umd.min.js
?? assets/vendor/pdf-licenses.json
?? docs/desktop-runtime-compatibility.md
?? scripts/smoke_runtime_compatibility.py
?? scripts/test_runtime_compatibility.py
```

## 15. Safety confirmation

No commit, push, merge, publication, branch creation/switch, reset or history rewrite. No academic/curriculum data changes, CSP weakening, separate desktop site, build architecture changes, or modifications to cip-desktop. Only this repository was edited. Test-generated changes to the pre-existing tracked Python cache were restored to their original bytes.
