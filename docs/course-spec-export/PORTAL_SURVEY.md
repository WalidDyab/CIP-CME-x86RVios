# Portal Survey — NCAAA Course Specification export

Reconnaissance for the feature described in `HANDOFF.md`. No feature code written; no
file modified except this one. `ee_curriculum.json` was read only.

- Branch: `claude-code-course-specs`, HEAD `94e00e4`
- Working tree at survey time: clean except untracked `docs/`
- Method: direct reading of the codebase. Claims are **confirmed** unless marked *(inferred)*.

---

## 0. The finding that governs everything else

**There is no server.** This repository is a static, client-side-only website. There is no
backend, no database, no application framework, no package manager, no build step, no CI, no
test framework, and no server-side runtime of any kind.

Confirmed by exhaustive check — none of the following exist anywhere in the repo:

```
package.json  package-lock.json  yarn.lock  pnpm-lock.yaml  node_modules
requirements.txt  pyproject.toml  Pipfile  poetry.lock  setup.py
Gemfile  go.mod  Cargo.toml  composer.json
Dockerfile  docker-compose.yml  Makefile
vite/webpack/next/tsconfig configs   .nvmrc  .python-version
.github/  .gitlab-ci.yml  .circleci/  .husky/
tests/  test/  spec/  __tests__/
server/  api/  backend/  src/  app/
netlify.toml  vercel.json  wrangler.toml  CNAME  .gitignore
```

The only `.py` file in the entire repository is the reference prototype itself,
`docs/course-spec-export/reference/gen_spec.py`.

Sections A.3, A.4, D.2, D.3, D.5, D.6, E.1, E.2, F.3 of the reconnaissance brief presuppose
server infrastructure that is not present. Rather than leave them blank I have answered what
the absence means for the feature.

---

## A. Stack and runtime

**A.1 — Language, framework, package manager, pinned versions.**
Hand-authored HTML5 + vanilla ES2020+ JavaScript + CSS. No framework, no transpiler, no
bundler, no package manager, no pinned runtime. 22 HTML pages, ~6 shared JS/CSS assets in
`assets/`, 5 JSON data files in `data/`, 4 Node ESM maintenance scripts in `scripts/`.

The only third-party runtime code is two CDN libraries, loaded on three pages:
jsPDF `4.2.1` and jsPDF-AutoTable `5.0.8`, both pinned with SRI
(`undergraduate-ee/course-dashboard.html:3-4`, `msc-ee/course-dashboard.html:3-4`,
`undergraduate-ee/so-leader-dashboard.html:14-15`).

Developer-side Node is v24.13.0 (measured locally, not pinned by the repo). The `scripts/*.mjs`
files import only `node:fs` / `node:path` / `node:crypto` — **the repo has zero npm
dependencies and no lockfile.**

**A.2 — Build, dev, deploy.**
No build. Pages are served as-is. Development is a static file server; several pages say so in
their own error text, e.g. `msc-ee/program-dashboard.html:3` — *"Run: python -m http.server
8000"*. Deployment is static file hosting; the exact host is **not determinable from the
repository** — there is no `CNAME`, no deploy workflow, and no host config. `_headers` (root)
is in Cloudflare Pages / Netlify format, which is a *hope* about the host rather than proof
*(inferred)*. `SECURITY-HARDENING.md:92-104` already records this as unresolved and flags that
on plain GitHub Pages the file is inert.

**A.3 — Background job runner / task queue.**
None, and no place for one. The premise behind the question — *"document generation for 31
courses is too slow for a request/response cycle"* — does not apply, because there is no
request/response cycle. Nothing in this portal executes on a server. See §2 for what replaces
this concern (browser memory and UI blocking, not request timeout).

**A.4 — Does any server-side process shell out to another runtime?**
No server-side process exists. The only `subprocess` use in the materials is inside the
reference prototype, which shells out to `unzip` and `zip`
(`reference/gen_spec.py:318,330`) — that is the prototype's own harness, not portal code.

---

## B. Data layer

**B.1 — Where `ee_curriculum.json` lives; who may write it.**
A committed file at `data/ee_curriculum.json` (6,021 lines), fetched over HTTP at runtime by
the browser. Not a database, not an external API.

**Nothing in the repository writes it.** Confirmed by grepping every `writeFile` call in
`scripts/`: `generate_clo_revision_audit.mjs:88` writes `clo_revision_audit.json`,
`generate_term_252_clo_report.mjs:189-190` writes an audit JSON and an HTML report, and
`update-csp-hashes.mjs:260` writes HTML files. `reconcile_final_curriculum.mjs` **reads only**
and throws on violation. The only writer is a human editing the file and committing it.

Consumers: `assets/program-identity.js`, `undergraduate-ee/{index, course-dashboard,
program-overview, so-leader-dashboard, clo-methods-review}.html`.

**B.2 — Existing schema validation.**
No schema library, no JSON Schema file. There *is* a validation precedent, and it is a good
one: `scripts/reconcile_final_curriculum.mjs` is a read-only assertion guard that loads the
curriculum and `throw`s on any violated invariant (`:12,:13,:18,:22,:30`). It is run manually
via `node`; nothing enforces it automatically. This is the closest existing analogue to the
validator the handoff §6 asks for, and the new validator should follow its shape.

**B.3 — Loading and caching.**
`assets/portal.js:2`:

```js
async function loadJSON(path){const r=await fetch(path,{cache:'no-cache'}); if(!r.ok) throw new Error(path+': '+r.status); return await r.json();}
```

Caching is **explicitly disabled** (`cache:'no-cache'`). There is no memoisation, no shared
store, no service worker (confirmed: no `serviceWorker` / `caches.` references anywhere). Every
page independently refetches the full ~6,000-line file on load. Data shape is
`data.curriculum.courses[]` plus a sibling `data.abet` block.

---

## C. Existing export features

**C.1 — Does the portal already generate documents?**
Yes — **PDF only, entirely client-side, via jsPDF.** No Word, no Excel, no server rendering.
Four distinct PDF generators exist:

| Generator | Location |
|---|---|
| Undergraduate course report | `undergraduate-ee/course-dashboard.html:595` |
| MSc course report | `msc-ee/course-dashboard.html:567` |
| CLO Review report | `assets/clo-review.js:210` |
| SO Mapping Review report | `assets/so-mapping-review.js:105` |

Plus one non-jsPDF export: a canvas-rasterised **PNG** of the PI/SO heatmaps,
`undergraduate-ee/program-overview.html:231-234`.

**C.2 — File download pattern.**
There is no download *endpoint*, because there is no server. The established pattern is
**generate in the browser, hand the bytes to the user directly**:

- jsPDF path — `doc.save(filename)`, which internally creates a Blob and triggers the download.
- Canvas path — `undergraduate-ee/program-overview.html:231-234`:
  ```js
  const link = document.createElement('a');
  link.download = filename;
  link.href = exportCanvas.toDataURL('image/png');
  link.click();
  ```

**No temp files exist and none need cleaning up** — nothing touches a filesystem. Filenames are
built in-page (see D.4).

**C.3 — Binary assets in the repo.**
Yes, extensively, and served as ordinary static files: PNG/SVG/JPG logos in `assets/`, PDFs and
PNGs in `curriculum-vision/references/` and `curriculum-vision/major-revision/data/`, a `.pptx`
and a `.xlsx` (`data/EE Program Design Full ABET.xlsx`). So a versioned binary `.docx` template
has clear precedent.

There is also a **provenance convention** for copied binaries worth following:
`assets/EAC-logo-source.txt` documents the source, transformations ("copied without artwork or
file-content changes"), placement and usage authority of `assets/EAC-RGB-W-L.png`.

---

## D. Security posture

**D.1 — The prior hardening work.**
Present on this branch and intact. Primary artefacts:

- `SECURITY-HARDENING.md` (root) — the record of the work.
- `_headers` (root) — deployment-layer headers.
- `scripts/update-csp-hashes.mjs` — the CSP maintenance tool.

Controls in place:

1. **Per-page `<meta>` CSP on all 18 full-document pages.** `script-src` is strict — no
   `'unsafe-inline'`, no `'unsafe-eval'`, no wildcards. Each page's inline `<script>` is
   allow-listed by SHA-256 hash. Current policy on the page this feature would touch,
   `undergraduate-ee/course-dashboard.html`:
   ```
   default-src 'self'; script-src 'self' 'sha256-aaVDkWGP+c+83Ep5UvFjxeHm8IKn0XBDF1gNMwHG00s=' https://cdnjs.cloudflare.com;
   style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self';
   object-src 'none'; base-uri 'self'; form-action 'self'
   ```
   `style-src 'unsafe-inline'` is a deliberate, documented trade-off
   (`SECURITY-HARDENING.md:57`), not an oversight.
2. **SRI on both CDN scripts**, with `crossorigin` and `referrerpolicy`.
3. **Pinned, current library versions** (jsPDF 4.2.1 / AutoTable 5.0.8).
4. **`Referrer-Policy: strict-origin-when-cross-origin`** via `<meta>` on every page.
5. **`_headers`**: `nosniff`, `Referrer-Policy`, `Permissions-Policy`,
   `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'`, HSTS.
6. **A hash-maintenance tool with a documented workflow** (`SECURITY-HARDENING.md:64-83`):
   `--check` (read-only, non-zero exit on drift) and `--write`. It also detects inline event
   handlers and `javascript:` URLs. **Verified green during this survey: all 22 HTML files
   clean, exit 0.**
7. **Output-escaping discipline** — all dynamic HTML goes through `portal.esc()`
   (`assets/portal.js:4`); `SECURITY-HARDENING.md:109-111` records this as deliberate and
   not to be weakened.

**D.2 — Authentication and authorization.**
**Neither exists.** No login, no session, no cookie, no token, no roles, no per-user state — and
no `localStorage`/`sessionStorage` use anywhere. Every page is fully public. There is therefore
no "representative authorization check" to show you; the honest answer is that the codebase
contains none, by design. `SECURITY-HARDENING.md:126-128` records A01/A07 as *not applicable*
for exactly this reason, and notes that `noindex, nofollow` (present on every page) is
indexing guidance, **not** an access control.

**D.3 — Input validation conventions.**
No validation library and no route layer to declare input against. The two inputs that exist
are both client-side:

- The `?course=` query parameter, read via `portal.getParam()` (`assets/portal.js:15`) and
  resolved by lookup against the curriculum with a fallback:
  `undergraduate-ee/course-dashboard.html:328` — `courses.find(...) || courses[0]`. This is
  the de-facto convention: **treat the parameter as a key to look up, never as data to render**,
  so an unknown value degrades to the first course rather than reaching the DOM.
- Form fields in the review tools, validated by hand — `assets/clo-review.js:137-173` is the
  representative example (per-field `setError()`, a `valid` accumulator, focus to first
  invalid field, and a hard `if (!validate()) return;` gate before PDF generation at
  `:177`).

**D.4 — Path and filename handling.**
No path handling exists (no filesystem). Filename handling has **two** existing helpers, and
they disagree slightly:

- `assets/clo-review.js:175` (also used by `so-mapping-review.js:105`):
  ```js
  function sanitize(value) { return value.trim().replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, ''); }
  ```
  Allow-list based; collapses any run of non-alphanumerics to `_` and trims leading/trailing
  `_`. This is the safer of the two and the one to reuse.
- `undergraduate-ee/course-dashboard.html:595` / `msc-ee/course-dashboard.html:567`:
  `c.code.replace(/\s+/g, '_')` — whitespace only.

On the specific concern raised: **`EE 101` is already handled today.** Both helpers turn it into
`EE_101`; the shipped filenames are `EE_305_Report.pdf` and
`EE_305_CLO_Review_<Reviewer>_2026-08-26.pdf`. Course codes in the data are consistently
`/^[A-Z]{2} \d{3}$/`, so the space is the only special character in practice.

**D.5 — Rate limiting, request size limits, timeouts.**
None exist, and none can exist in this repository — they are properties of a server. Nothing in
`_headers` addresses them. For a client-side generator the analogous limits are browser memory
and main-thread blocking; see the risk list, §4.

**D.6 — Error surfacing.**
Convention is a **generic, non-revealing message in the UI, with detail confined to the
console**. Every data-loading path is wrapped:

```js
} catch (e) {
  byId('detail').innerHTML = '<div class="alert">Could not load course information.</div>';
}
```
(`undergraduate-ee/course-dashboard.html:388`; same shape at `program-overview.html:265`,
`so-leader-dashboard.html`, `msc-ee/course-dashboard.html:288`, and
`assets/portal.js:28,37` which use `console.error` for the detail.)

Because there is no server, stack traces cannot reach a client from a server — but note two
places where an exception message *is* surfaced to the user:
`undergraduate-ee/program-overview.html:243` — `alert(\`PNG export failed: ${error.message}\`)`,
and `assets/clo-review.js:178` surfaces a dependency-missing message. These are browser-local
messages about browser-local failures, so the exposure is to the user's own console/alert, not
across a trust boundary.

---

## E. Testing and CI

**E.1 — Test framework and coverage.**
**None.** No test framework, no test directory, no test files, no assertions harness. Data-layer
coverage is therefore zero in the conventional sense.

What exists instead are two hand-rolled, runnable check scripts:
- `scripts/reconcile_final_curriculum.mjs` — read-only curriculum invariants, throws on failure.
- `scripts/update-csp-hashes.mjs --check` — security-invariant check with a proper non-zero
  exit code.

Both are executed manually. They are the de-facto testing convention here.

**E.2 — CI pipeline.**
**None.** No `.github/` directory exists at all; nothing runs on a pull request. There is no
existing step to "add a validation step to". Establishing CI would be new infrastructure.
`SECURITY-HARDENING.md:79` already instructs developers to run `--check` manually *before
committing* — that manual gate is the current substitute for CI.

**E.3 — Snapshot / golden-file testing.**
No framework. But a usable **golden fixture** is present: `reference/EE490_pilot.docx` (1.5 MB,
42 parts) with `EE490_pilot.pdf`. I verified it is a genuine validated output:

- `MERGEFIELD` occurrences remaining: **0**
- `«` / `»` chevrons remaining: **0**
- Sentinel characters (`U+241E`/`U+241F`) leaked: **0**
- CLO rows `3.1`, `3.2`, `3.3` all present — i.e. EE 490's three Values CLOs rendered, which
  is precisely the template-overflow regression case.

That is enough to support meaningful comparison testing today (see §5, item 6, for why the
handoff's *rasterised* comparison is not currently achievable).

---

## F. Frontend integration

**F.1 — Course detail view and how an action button is added.**
The view is `undergraduate-ee/course-dashboard.html`; the detail pane is rendered in one
template literal assigned to `byId('detail').innerHTML` at **line 371**, with a course
`<select>` above it and course info spliced in at line 373 via `insertAdjacentHTML`.

There is now a **repeated, two-instance convention** for adding an action — the CLO Review and
SO Mapping Review tools both follow it, which makes it a genuine pattern rather than a one-off:

1. Add a `<button>` inside `<div class="course-actions">` in the line-371 template.
   Current content: `printReportBtn` and `cloReviewOpen`.
2. Publish the data the tool needs on a global set during load —
   `undergraduate-ee/course-dashboard.html:346`:
   `window.cloReviewContext = { raw, normalized: c, abet: data.abet || {}, courses };`
3. Wire the button to a custom event rather than calling the tool directly —
   `:379`: `byId('cloReviewOpen').addEventListener('click', () => window.dispatchEvent(new CustomEvent('open-clo-review')));`
   (`so-leader-dashboard.html:80` does the same with an event `detail` payload.)
4. Implement the tool as a self-contained IIFE in `assets/<feature>.js` that listens for that
   event, renders into a modal overlay, and cleans up on close (`assets/clo-review.js:1,196`).
5. Add the modal overlay markup to the page.
6. Load the asset with `<script defer src="../assets/<feature>.js"></script>`.
7. **Regenerate the page's CSP hash** — editing the line-371 inline script invalidates it.

Styling: `assets/clo-review.css` exists; `so-mapping-review.js` ships **no** CSS of its own and
reuses those classes. So a third tool is expected to reuse `clo-review.css` rather than add a
stylesheet.

**F.2 — Bulk-action / multi-select pattern.**
There is **no** multi-select across entities (no "select N courses"). The only multi-select is
*within* a single document: the print modal's section checkboxes plus a "Select All" toggle —
`undergraduate-ee/course-dashboard.html:284-311` and `msc-ee/course-dashboard.html:228-252`,
with the select-all/indeterminate wiring at `undergraduate-ee/course-dashboard.html:399-406`.

That is a reusable *interaction* precedent (checkbox list + Select All + Cancel/Generate
actions), but a course-level bulk selector would be new UI.

**F.3 — Long-running operations.**
No polling, no websockets, no EventSource, no progress component, no spinner. Everything is
synchronous-feeling and fast because it is local JSON rendering.

The single precedent for a slow operation is the PNG heatmap export, which does the minimum:
disable the button, swap its label, restore in `finally`, and record status on
`dataset` — `undergraduate-ee/program-overview.html:243-250`. Anything needing real progress
reporting across 31 documents would be new.

---

## 2. Runtime recommendation

### Recommendation: port the engine to browser JavaScript. Do not stand up a service.

**Why not a service.** The single most valuable security property this portal has is that it
has no server. `SECURITY-HARDENING.md:126-128` records A01 (Broken Access Control), A07
(Authentication Failures) and A09 (Logging) as *not applicable* — not mitigated, **absent**.
Introducing a document-generation service would re-open all of them at once: it would need
authentication (none exists), authorization (none exists), rate limiting (none exists), request
size limits, timeouts, logging, monitoring, a deployment pipeline (none exists) and a host that
can run Python (the current one may be static-only, and we cannot even confirm which host it
is). That is a disproportionate amount of new attack surface and new operational burden for a
report that is regenerated when ETEC revises a form — rarely.

**Why the browser specifically, over a Node CLI.** Both avoid a server, and I considered the
Node CLI seriously because `scripts/generate_term_252_clo_report.mjs` is exact precedent for
"read `data/`, write a generated artefact". The deciding factor is dependency count:

| Capability | Browser | Node 24 |
|---|---|---|
| XML parse/serialise | **built in** (`DOMParser`, `XMLSerializer`) | **not available** — Node core has no XML parser |
| ZIP read/write | not built in | not built in (`node:zlib` gives raw deflate only) |
| **New dependencies needed** | **1 (ZIP)** | **2 (ZIP + XML)** |

The browser also delivers the feature that was actually asked for — a button on the course
detail view — and matches the strongest existing precedent in the codebase: jsPDF already
performs client-side binary document generation and hands the user a file, four times over.

The `lxml` calls the prototype relies on map cleanly onto the DOM: `getparent()` →
`parentNode`, `addnext`/`addprevious` → `after()`/`before()`, `copy.deepcopy` →
`cloneNode(true)`, `etree.SubElement` → `createElementNS`, `root.iter(tag)` →
`getElementsByTagNameNS`. The row-cloning step (`gen_spec.py:191-271`), which is where the real
work is, is ordinary tree manipulation with no `lxml`-specific behaviour.

**Keep the door open to Node.** Put every XML access behind a thin adapter so the engine is not
welded to `DOMParser`. That preserves the option of a `scripts/` driver later — which is the
only way the golden-file test in §8 of the handoff could ever run headlessly — without paying
for it now.

### What is lost by porting to the browser

- **XSD validation becomes impossible.** Handoff §9 asks that generation introduce "no new XSD
  errors beyond the 3 pre-existing". No browser can do this and no validator exists in this
  repo. That acceptance criterion becomes a manual, out-of-band step.
- **Serializer fidelity is no longer guaranteed byte-for-byte.** `lxml` round-trips namespace
  declarations predictably; `XMLSerializer` may relocate or re-declare `xmlns:` bindings and
  is less predictable about attribute order. Word is tolerant of this, and the prototype
  already sets `xml:space="preserve"` explicitly (`gen_spec.py:139,170`), but this needs
  explicit validation against the golden fixture rather than assumption. **This is the single
  biggest technical risk in the port** *(inferred — I have not executed a round-trip test)*.
- **The Python ecosystem** (`python-docx`, `lxml`'s XSD support, LibreOffice-driven
  rasterisation) is off the table.
- **Rasterised visual comparison** (handoff §8) cannot run in a browser.

### What would be lost by a service (for completeness)

The zero-backend posture, and with it the "not applicable" status of three OWASP categories;
plus the need to build auth, authz, rate limiting, timeouts, logging and deployment from
nothing. Also the `_headers` static-hosting model.

---

## 3. Proposed file locations

Following this repo's conventions — feature code in `assets/`, offline tooling in `scripts/`,
binary assets versioned in-tree with a sibling provenance `.txt` — rather than the handoff's
illustrative `engine/ templates/ portal/` tree, which assumes a server-side package layout that
does not exist here.

```
assets/course-spec/
  engine.js        orchestration: (templateBytes, course, program, rules) -> Blob
  fields.js        MERGEFIELD flatten + sentinel substitution   (gen_spec.py:68-146,174-187)
  rows.js          <w:tr> cloning for CLO and topic tables      (gen_spec.py:191-271)
  rules.js         contact hours, tick boxes, assessment variant, CLO grouping  (handoff §5)
  registry.js      document-type registry: ncaaa-cs now; ncaaa-fes, abet-report later
  xml.js           thin XML adapter (DOMParser/XMLSerializer today; keeps Node reuse possible)

assets/vendor/
  <zip-lib>.min.js        vendored, same-origin -> no new CSP origin, no SRI needed
  <zip-lib>-source.txt    provenance, following assets/EAC-logo-source.txt

assets/templates/ncaaa-cs/
  template.docx           the ETEC form, versioned binary
  template-source.txt     provenance + ETEC revision identifier

assets/course-spec-export.js    portal glue: listens for 'open-course-spec-export'
                                (reuses assets/clo-review.css, per so-mapping-review precedent)

scripts/
  validate-curriculum.mjs       handoff §6 validator: read-only, throws, non-zero exit
                                (shape it like reconcile_final_curriculum.mjs)
```

Notes on two placement choices:

- **Template under `assets/`, not `data/`.** `assets/` is what pages fetch at runtime; `data/`
  is described by `data/README.md` as the runtime *curriculum database*. The template is a
  fetched asset, not curriculum data. (`data/` does already hold a binary `.xlsx`, so `data/`
  is defensible — but it is documented there as a regeneration input, not a served asset.)
- **`docs/course-spec-export/` should not become the home for shipped code.** It is staging.
  `HANDOFF.md`, `FIELD_MAP.md` and this survey belong there permanently; `gen_spec.py` and the
  pilot files should stay as reference/fixture material, not be promoted.

---

## 4. Risk list — hardening controls this feature could weaken

| # | Risk | Required behaviour |
|---|---|---|
| 1 | **CSP hash invalidation.** Adding the button changes the inline script at `undergraduate-ee/course-dashboard.html:371`, silently breaking every script on that page under CSP. | Run `node scripts/update-csp-hashes.mjs --write` then `--check` as part of the change. **Never** "fix" a violation by adding `'unsafe-inline'` — explicitly forbidden by `SECURITY-HARDENING.md:82`. |
| 2 | **New CDN origin for the ZIP library** would widen `script-src` and add an SRI hash to maintain. | Vendor the library under `assets/vendor/` so it loads as `'self'`. CSP is then unchanged. Record provenance in a sibling `.txt`. |
| 3 | **First-ever npm dependency.** The repo has zero dependencies and no lockfile; the audit recorded supply-chain exposure as effectively nil. A `package.json` + `node_modules` would create that surface, and there is no CI to run `npm audit`. | Prefer one vendored, reviewed file over introducing a package manager. If npm is ever introduced, that is a separate decision with its own review. |
| 4 | **XML injection into `document.xml`** — a genuinely *new* risk class here. Course text containing `<`, `&`, or `</w:t>` concatenated into XML would corrupt or restructure the document. | Never build XML by string concatenation. Assign through the DOM (`textNode.textContent = value`), which escapes correctly. **Do not** use `portal.esc()` — it is an *HTML* entity escaper and would double-escape into Word's visible text. |
| 5 | **Filename safety** for `EE 101` and for ZIP entry names in a bulk download (`../` traversal in an archive path). | Reuse `sanitize()` from `assets/clo-review.js:175` for both the filename and every ZIP entry name; never interpolate a raw course code into an archive path. |
| 6 | **Client-side resource exhaustion** replaces the server-DoS concern. 31 documents × a ~1.5 MB template, each with a ~280 KB `document.xml`, generated on the main thread will block the UI and may exhaust memory. | Generate sequentially, release each Blob promptly, report progress (extend the disable/label/`finally` pattern at `program-overview.html:243-250`), and consider a Web Worker. Default to single-course export; make "all 31" explicit and interruptible. |
| 7 | **Template integrity.** The `.docx` is fetched at runtime and SRI does **not** apply to `fetch()` — only to `<script>`/`<link>`. | Same trust level as `portal.js` (repo review is the control). Optionally verify a known SHA-256 of the template inside the engine before use. |
| 8 | **`ee_curriculum.json` must stay read-only.** Handoff §6 is emphatic and the repo currently upholds it — nothing writes that file. | The browser cannot write it. The validator must read-and-throw only, like `reconcile_final_curriculum.mjs`. Any migration ships as a separate, reviewable diff. |
| 9 | **Error-message discipline.** The generator will fail in new ways (bad template, missing part, malformed XML). | Follow the existing convention: generic `<div class="alert">` to the user, detail to `console.error`. Avoid widening the `alert(error.message)` precedent at `program-overview.html:243`. |

Controls **not** affected: `_headers`, clickjacking (`frame-ancestors`), Referrer-Policy, the
existing SRI on jsPDF, and `style-src`. `connect-src 'self'` already permits fetching the
template from the same origin, so no CSP change is needed for that.

---

## 5. Where the handoff is wrong or infeasible

The handoff states it was prepared without access to this codebase; §10.1 flags the stack as an
open question. These are the corrections.

1. **§3's architecture assumes a server that does not exist.** `portal/` as a "thin caller", and
   the constraint that the engine must not "hit the DB", describe a backend application. There
   is no backend and no DB. The *spirit* of §3 — a pure engine, a registry, templates as
   versioned binaries — is sound and worth keeping; the layout is not.
   Related: the constraint "the engine must not make network calls" is unachievable in the
   browser if the engine loads its own template. Resolve it by having the **caller** fetch the
   template and pass bytes in — which makes the engine purer than the handoff proposed.

2. **§10.1 is a false dichotomy.** "Either port the engine or run it as a service" omits the two
   options that actually fit this repo: a browser-side port (recommended), and a `scripts/*.mjs`
   offline driver. Its supporting evidence is also stale: the `.mjs` migration script cited via
   `provenance` — `scripts/migrate_to_single_curriculum_json.mjs` — **no longer exists**; it was
   deleted in commit `a3c53c3` ("Clean obsolete curriculum data and scripts"), leaving a
   dangling reference in `data/ee_curriculum.json`. The Node convention is still real (four
   `.mjs` scripts remain), just not for that reason. That same commit also deleted
   `scripts/audit_program_mapping.py`, so Python has existed here before and was deliberately
   removed.

3. **The template is missing — this is a hard blocker.** `EE_CS_NCAAA_Template.docx` is *not*
   present. `docs/course-spec-export/` contains only `HANDOFF.md`, `FIELD_MAP.md`, and
   `reference/{gen_spec.py, EE490_pilot.docx, EE490_pilot.pdf}`. Because §4 correctly insists
   the 87 field names be read from the template's XML, and because the pilot output contains
   **0 remaining MERGEFIELDs** (verified), the template **cannot be reconstructed** from what is
   here. `FIELD_MAP.md` documents roughly 40 field names — fewer than half of 87. Nothing can be
   implemented until the file is supplied.

4. **§6's validator table is partly stale.** The Excel-artifact row claims `#REF!` "reached the
   published PDF via EE 101 topics". `#REF!`, `#N/A`, `#VALUE!` and `#DIV/0!` are all **absent**
   from the current `ee_curriculum.json`. Keep the check as a regression guard, but do not
   expect it to fail today.

5. **§6/§7's "year / level = 0" is true but type-trapped, and this will bite the validator.**
   Those fields are the **string `"0"`**, not the number `0`. In fact `year`, `level` and
   `credit_hours` are **all strings** across all 32 courses (`credit_hours` distinct values:
   `"4"`, `"3"`, `"10"`, `""`). A validator written the obvious way — `if (!course.year)` or
   `if (course.year === 0)` — **silently passes**, because `"0"` is truthy and is not `0`.
   Compare explicitly, e.g. `String(v).trim() === '0'`. Relatedly,
   `total_topic_contact_hours` is `null` for 18 of 32 courses, not `0` or absent.

6. **§8's golden-file test is not achievable in this repo as it stands.** "Render to PDF,
   rasterize, compare against approved images" needs LibreOffice (or equivalent), a test
   framework, and CI — none of which exist, and none of which can be added without also adding
   a package manager. Recommended substitute, which is achievable today and which I have already
   demonstrated has real signal: assert directly against the generated `word/document.xml` —
   zero `MERGEFIELD`, zero `«`/`»`, zero sentinels, CLO/topic row counts equal to the JSON array
   lengths, correct tick glyphs, exactly one assessment table. Those checks caught precisely the
   properties §9 lists. Defer rasterisation until there is somewhere to run it.

7. **§9's XSD criterion is unverifiable here.** No XSD validator exists in the repo and none is
   available in a browser. Either drop it or make it an explicit manual pre-release step.

8. **§7's counts need one clarification.** The split is **16 Required / 16 Elective**, not 15/16.
   EE 492 is `required_or_elective: "Required"` with `type: "COOP"`, so once it is excluded from
   CS scope the handoff's "15 complete, all Required" is correct — but the underlying field
   values are not what the table implies. Verified detail: of the 16 Required, 16 have
   objectives, 15 have textbooks, 14 have topics (EE 490 and EE 492 lack them), 16 have a
   description; of the 16 Electives, 0 have objectives/textbooks/topics and 13 have a
   description. These reconcile exactly with `FIELD_MAP.md`'s 16/32, 17/32 and 18/32 empty
   counts.

9. **§10.3's open question is already answered by the repo.** `portal.listText()`
   (`assets/portal.js:6`) joins with `'; '` and is already used for exactly these two fields in
   the existing PDF export (`undergraduate-ee/course-dashboard.html:529-530`). **Semicolon**
   has in-repo precedent; matching it keeps the `.docx` consistent with the PDF the portal
   already produces.

### Confirmed correct in the handoff

Worth stating, since much of it checks out precisely:

- §2's "31 CS courses" — 32 total minus EE 492. Correct.
- §5.1's contact-hours rule reproduces cleanly on live data: 7 courses at 90 h, 7 at 60 h,
  18 at 45 h (16 Electives + Capstone + COOP).
- §5.3's lab-variant list (EE 101, 201, 211, 221, 322, 351, 305) is **exactly** the set of
  4-credit courses in the JSON.
- §5.4's overflow claim — EE 490 is the **only** course exceeding the template's slots
  (1 Knowledge / 5 Skills / **3** Values against 3/5/2). Every `nqf_domain` value is one of
  Knowledge, Skills, Values.
- §6's `credit_hours` empty (EE 417, EE 454) and `course_description` empty (EE 417, EE 454,
  EE 499) — both confirmed.
- §4's gotchas are consistent with the prototype's structure, and the pilot demonstrates the
  approach produces a clean document.

---

## 6. Immediate blockers before implementation

1. **Supply `EE_CS_NCAAA_Template.docx`.** Nothing can proceed without it (§5.3 above).
2. **Confirm the hosting platform** so it is known whether `_headers` is live — already
   outstanding from the security work (`SECURITY-HARDENING.md:130-135`).
3. **Decide output mode** (handoff §10.4). This materially changes the memory profile in risk 6:
   31 separate downloads, or one ZIP-of-documents, are very different in the browser.
4. **FES template** remains unavailable, so EE 492 stays out of scope (handoff §10.2 — still
   accurate).
