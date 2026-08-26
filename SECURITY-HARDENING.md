# Security Hardening — CIP-CME-x86RVios

- **Audit date:** 2026-08-24
- **Remediation date:** 2026-08-24
- **Branch:** `claude` (uncommitted working-tree changes only — see Git status below)
- **Baseline:** OWASP Top 10:2025 (primary), OWASP ASVS 5.0.0 Level 1 used as a verification checklist, not a compliance certification

This document records what changed as a direct result of the prior read-only audit. It does not claim the application is "100% secure," "OWASP certified," or "ASVS certified," and it is not a substitute for a formal penetration test.

## Architecture recap (unchanged since the audit)

Static, client-side-only site. No backend, no database, no authentication, no secrets, no user-upload functionality. All curriculum content comes from repository-controlled JSON files under `data/`. PDF export runs entirely in the visitor's browser via jsPDF; nothing is uploaded to a server.

## Changes implemented

### 1. PDF library upgrade (jsPDF + jsPDF-AutoTable)

| Library | Before | After |
|---|---|---|
| jsPDF | 3.0.3 | **4.2.1** |
| jsPDF-AutoTable | 3.8.4 | **5.0.8** |

Verified before changing anything:
- jsPDF 4.2.1 and jsPDF-AutoTable 5.0.8 are the current stable releases on npm.
- jsPDF-AutoTable 5.0.8's declared peer dependency is `jspdf: "^2 || ^3 || ^4"` — 4.2.1 is compatible.
- Both still publish a browser UMD bundle on cdnjs (`jspdf.umd.min.js`, `jspdf.plugin.autotable.min.js`) — the exact file names CIP already used, so no `<script>` loading pattern changed.
- jsPDF-AutoTable v5 release notes: the plugin remains auto-applied to `jsPDF` in browser (UMD/global-script) environments — only Node.js usage requires manual `applyPlugin()`. CIP's `doc.autoTable({...})` object-form calls and `doc.lastAutoTable.finalY` usage (both dashboards) were already on the API surface that survived the v3→v5 changes; the removed legacy positional call form (`doc.autoTable(columns, body, options)`) was never used in this codebase.
- Confirmed live in-browser after the upgrade: `window.jspdf.jsPDF` loads, `doc.autoTable` is present and callable, `doc.lastAutoTable.finalY` works, and both dashboards' "Generate PDF" buttons complete end-to-end without throwing (verified via the print-modal closing, which only happens after `generateCoursePDF()` returns successfully).

Files: [undergraduate-ee/course-dashboard.html](undergraduate-ee/course-dashboard.html), [msc-ee/course-dashboard.html](msc-ee/course-dashboard.html)

### 2. Subresource Integrity (SRI) on both CDN scripts

Both pinned jsPDF and jsPDF-AutoTable `<script>` tags now carry `integrity="sha512-..."` and `crossorigin="anonymous"` (plus `referrerpolicy="no-referrer"`). The hashes were **not** taken from any third-party summary — the exact pinned files were downloaded directly from cdnjs and hashed locally with `openssl dgst -sha512`, and the resulting jsPDF-AutoTable hash was independently cross-checked against cdnjs' own published SRI value (exact match). Both files' headers were also inspected to confirm they are genuine jsPDF 4.2.1 / AutoTable 5.0.8 builds, not error pages.

### 3. Content-Security-Policy (meta, per page)

**Inventory performed first** (repo-wide): inline `<script>` blocks, inline `<style>` blocks (present on most pages), inline `style=""` attributes (present on most pages, dozens of occurrences), inline event-handler attributes (found exactly one: a static `onclick="window.print()"`), external origins (`cdnjs.cloudflare.com` for the two PDF scripts, `fonts.googleapis.com`/`fonts.gstatic.com` for 3 pages), `fetch()` destinations (all same-origin relative JSON/HTML fragment paths), and image sources (all same-origin, no `data:` URIs, no favicon, no `<base>` tag).

**Page count note:** the repository contains 20 `.html` files in total. **18 of them are full documents** and received the CSP + Referrer-Policy `<meta>` tags described below — of those 18, twelve have exactly one inline `<script>` block and six have none. **The other 2** — `assets/header.html` and `assets/footer.html` — are markup *fragments*, not full documents: they have no `<head>` of their own and are fetched by `assets/portal.js` and spliced into each page's `#header-placeholder`/`#footer-placeholder` via `outerHTML`. A `<meta>` CSP tag only has an effect inside the `<head>` of the document the browser actually navigated to; injecting one into a fragment destined for someone else's `<body>` would be silently ignored, so these two files were correctly left alone — they inherit whatever policy the host page already declares. (An earlier progress note during this work said "20 files updated," which was this same total-file-count figure quoted in the wrong context; the two fragment files were never modified. The final count of pages carrying CSP has always been 18, confirmed here again via `git diff --name-only` and a fresh repository scan — see § Maintaining the CSP.)

**Policy chosen, per page**, via `<meta http-equiv="Content-Security-Policy">`:

```
default-src 'self';
script-src 'self' [ 'sha256-<page's exact inline script>' ] [ https://cdnjs.cloudflare.com ];
style-src 'self' 'unsafe-inline' [ https://fonts.googleapis.com ];
img-src 'self';
font-src 'self' [ https://fonts.gstatic.com ];
connect-src 'self';
object-src 'none';
base-uri 'self';
form-action 'self';
```

- **`script-src` has no `'unsafe-inline'`, no `'unsafe-eval'`, and no wildcard origins.** Each page's single inline `<script>` block is allow-listed by its own SHA-256 hash rather than a blanket `'unsafe-inline'`. The one static `onclick="window.print()"` attribute (in the Term 252 CLO report) was converted to `id="printReportBtn"` + a one-line `addEventListener` call, specifically so `script-src` could stay hash-only with no inline-attribute exception needed anywhere in the site. This was a two-line, behavior-preserving change, not a refactor.
- **`style-src` uses `'unsafe-inline'` deliberately, as a documented, accepted trade-off** — not left in "to make errors disappear." Every one of the 18 full-document pages has a `<style>` block and/or scattered `style=""` attributes; converting all of that to hashed/external CSS across 18 hand-authored files would be a large, high-risk refactor for a security gain that doesn't match the risk class of inline CSS (CSS injection cannot execute arbitrary script; the realistic threats are visual spoofing and some historical CSS-exfiltration tricks, both far lower severity than script injection). `script-src`, the directive that actually stops XSS, is fully strict with no such exception. If a future pass wants a strict `style-src` too, that is exactly the kind of "separate refactoring phase" the hardening instructions called for rather than doing automatically here.
- **`frame-ancestors` is intentionally absent from the meta CSP** — the CSP spec has browsers ignore `frame-ancestors` (and `sandbox`, `report-uri`) when delivered via `<meta>`, so including it there would be a no-op that looks like protection but isn't. It's implemented instead in `_headers` (see §7) for hosts that honor it, since a directive that does nothing should never be left in the source implying otherwise.

**A hash-computation subtlety worth recording for future maintainers:** the HTML parser normalizes newlines (`\r\n` → `\n`, lone `\r` → `\n`) before a browser ever computes a CSP hash on inline script text — so the hash must be computed on that normalized text, not on raw file bytes. This repository's files have pre-existing mixed CRLF/LF line endings (unrelated to this change), which initially produced hashes that didn't match what Chrome computed; this was caught during the mandatory browser-console CSP-violation check (§ Regression testing below) and fixed before finalizing.

**Known maintenance implication:** because `script-src` is hash-pinned, editing any page's inline `<script>` block in the future will change its content and invalidate that page's hash, silently breaking that page's own scripts under CSP (the browser will block it, not error loudly in the UI). See § Maintaining the CSP below for the tool that handles this.

## Maintaining the CSP

Inline JavaScript on every page is authorized in `script-src` by a SHA-256 hash of its exact content, instead of `'unsafe-inline'`. **Editing an inline `<script>` block changes its hash and invalidates the CSP entry for it** — the script will then be silently blocked by the browser (a CSP console warning, not a visible page error) until the hash is regenerated.

A maintenance utility handles this: [`scripts/update-csp-hashes.mjs`](scripts/update-csp-hashes.mjs). Pure Node.js built-ins only (`fs`, `path`, `crypto`) — no dependencies, no build step, same runtime as the repo's other `.mjs` scripts.

```bash
# After changing any inline <script> block, verify first:
node scripts/update-csp-hashes.mjs --check

# If it reports stale/missing/orphaned hashes, regenerate and re-verify:
node scripts/update-csp-hashes.mjs --write
node scripts/update-csp-hashes.mjs --check
```

- `--check` scans every HTML file, computes the hash each page's inline scripts actually require, compares it against what's currently in that page's `script-src`, and reports mismatches — it makes no file changes and exits non-zero if anything is stale, missing, orphaned, or duplicated. It also flags CSP-incompatible constructs (inline `onclick=`-style event-handler attributes, `javascript:` URLs) that no hash can fix — those must be refactored by hand, the same way the original `onclick="window.print()"` was converted to `addEventListener` during the initial hardening pass.
- `--write` performs the same scan and rewrites **only** the stale hash token(s) inside `script-src` on the pages that need it — every other directive, origin, and byte of the file is left untouched. Running it twice in a row produces no further changes.
- `--check` should be run before committing any change that touches HTML `<script>` content, and again after `--write` to confirm the fix.
- **Do not solve a `--check` failure by adding `'unsafe-inline'`** to `script-src` — regenerate the hash instead. Inline event-handler attributes (`onclick=`, etc.) should continue to be avoided in favor of `addEventListener` in the page's own inline script, exactly as done for the print button.

### 4. Referrer-Policy

Added `<meta name="referrer" content="strict-origin-when-cross-origin">` to all 18 full-document pages (see the page-count note in § 3 for why 18, not 20). This matches modern browsers' own default, so it is a no-op hardening step for current Chrome/Edge/Firefox but makes the intent explicit and covers older/non-default configurations. Verified it did not affect navigation, the `?course=` query-parameter flow, or any same-origin fetch.

### 5. External fonts — retained (Option A)

Three pages (`msc-ee/concentration-view.html`, `msc-ee/course-view-v4.html`, `msc-ee/unified-advising-view.html`) load the "Inter" family from Google Fonts. Kept as-is: self-hosting would add a font-file maintenance burden with no security benefit (Google Fonts CSP-scoped to `fonts.googleapis.com`/`fonts.gstatic.com` only, no script execution risk). **Documented privacy trade-off:** loading these resources reveals visitor IP addresses to Google on these three pages; this was true before this change and remains true — CSP now formally scopes exactly which two Google origins are trusted (`style-src`/`font-src`), instead of the previous unscoped `<link>` tag.

### 6. Hosting/security headers — `_headers` file added

A new file, [`_headers`](_headers), was added at the repo root. This is the standard format recognized by Cloudflare Pages and Netlify (a "no-op" file that plain GitHub Pages simply ignores, since GitHub Pages has no mechanism to read it — **the actual hosting mechanism for this repository is not visible from repo contents alone**, so this file activates only if/when the site is served from a host that supports it). It sets only what a `<meta>` CSP cannot express, and deliberately does **not** repeat the CSP directives already in each page's `<meta>` tag, to avoid two divergent policies drifting apart over time:

```
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), camera=(), microphone=(), payment=()
X-Frame-Options: DENY
Content-Security-Policy: frame-ancestors 'none'
Strict-Transport-Security: max-age=31536000
```

### 7. Clickjacking protection

Modern `frame-ancestors 'none'` is the primary control (in `_headers`, § above), with `X-Frame-Options: DENY` alongside it as a legacy fallback for the small set of clients that only understand the older header — not used *instead of* `frame-ancestors`. Neither can be expressed in HTML `<meta>`, so both are deployment-layer (see § Remaining deployment actions).

### 8. XSS-protection design — unchanged

The audit found dynamic content is consistently passed through `assets/portal.js`'s `esc()` HTML-escaping helper before insertion into the DOM. Nothing about that design was touched. The two new dynamic-content points added by this hardening pass (the `printReportBtn` click wiring) insert no data at all — they're static function calls, not string-built HTML — so no new escaping need arose.

## Findings resolved

| Audit finding | Resolution |
|---|---|
| F1 — CDN scripts without SRI | **Remediated** — `integrity` + `crossorigin` added to both |
| F2 — Outdated jsPDF w/ CVEs (not reachable via this app's usage) | **Remediated** — upgraded to 4.2.1 / 5.0.8, current stable |
| F3 — No CSP anywhere | **Remediated (script-src strict; style-src accepts documented `'unsafe-inline'` trade-off)** |
| F4 — No clickjacking protection | **Partially remediated** — implemented in `_headers`; **takes effect only if hosting supports `_headers`** (deployment action required either way) |
| F5 — No `X-Content-Type-Options`/`Referrer-Policy`/`Permissions-Policy` | Referrer-Policy: **Remediated** (both meta and `_headers`). `X-Content-Type-Options`/`Permissions-Policy`: **Partially remediated**, same `_headers`-support caveat as F4 |
| F6 — `noindex,nofollow` is not access control | **Accepted / not applicable** — no protected functionality exists to secure; documented as a design note for any future faculty-editing feature |
| F7 — Dev-only `.mjs` scripts, unclear how to re-run | **Not applicable to this hardening pass** — out of scope (process/documentation item, not a security control) |
| F8 — Google Fonts privacy note | **Accepted (Option A retained)**, documented above |

## Findings NOT applicable (unchanged from audit)

A04 Cryptographic Failures, A07 Authentication Failures, A09 Security Logging & Alerting Failures — no crypto operations, no authentication, and no server exist in this application, so these categories have nothing to remediate. Not adding any of these mechanisms was itself a deliberate part of this pass, per the explicit "do not invent authentication" instruction.

## Deployment-layer controls still required (cannot be finished from this repository alone)

1. **Confirm the actual hosting provider.** Nothing in the repo (no `CNAME`, no build workflow) reveals it. If the current host is plain GitHub Pages, the new `_headers` file does nothing there — `frame-ancestors`, `X-Frame-Options`, `X-Content-Type-Options`, `Permissions-Policy`, and HSTS will **not** be active until the site is served from (or fronted by) something that honors `_headers` (e.g., Cloudflare Pages, Netlify) or those headers are configured directly at whatever reverse proxy/CDN sits in front of it.
2. **Confirm HTTPS is enforced** (redirect HTTP→HTTPS) at the hosting layer; this repo cannot enforce transport security on its own.
3. Reassess whether `Strict-Transport-Security: max-age=31536000` in `_headers` is appropriate once the real domain/subdomain layout is known (deliberately did **not** add `includeSubDomains` or `preload`, since incorrect use of either can affect subdomains outside this repository's control).

## Manual verification recommended

- Re-run the full regression pass (below) against the actual production deployment once these changes are live, not just the local static-server test used here.
- If the hosting layer is confirmed to support `_headers`, verify with browser devtools that the response actually carries those headers (some platforms require the file at a specific path or a build step to pick it up).
- Any future edit to an inline `<script>` block on any of these 18 pages must recompute that page's CSP hash — run `node scripts/update-csp-hashes.mjs --check` (and `--write` if it reports drift) — or the page's own script will silently stop running under CSP. See § Maintaining the CSP.
- Confirm with whoever manages the domain whether `includeSubDomains`/`preload` should be added to HSTS.

## Limitations of this assessment

This was a source-code-level hardening pass verified against a local static file server, not the live production deployment, and not a penetration test. It does not scan for vulnerabilities introduced by the hosting platform itself, does not include dynamic/fuzz testing, and does not constitute a certification of any kind.
