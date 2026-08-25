// CSP inline-script hash maintenance utility.
//
// The site's HTML pages carry a per-page <meta> Content-Security-Policy whose
// script-src allow-lists each page's inline <script> block(s) by SHA-256 hash
// instead of 'unsafe-inline'. Editing an inline script changes its hash, which
// silently breaks that script under CSP until the hash is regenerated here.
//
// Usage:
//   node scripts/update-csp-hashes.mjs --check   Report drift, change nothing. Exits 1 on any issue.
//   node scripts/update-csp-hashes.mjs --write    Rewrite only the stale/missing/orphaned hash
//                                                  tokens in script-src. Leaves every other CSP
//                                                  directive, origin, and file byte untouched.
//
// Only Node.js built-ins (fs, path, crypto, url) are used — no dependencies, no build step.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const mode = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : null;
if (!mode) {
  console.error('Usage: node scripts/update-csp-hashes.mjs --check | --write');
  process.exit(2);
}

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------

function findHtmlFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findHtmlFiles(full, out);
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

const htmlFiles = findHtmlFiles(REPO_ROOT).sort();

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

const CSP_META_RE = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)">/i;
const SCRIPT_TAG_RE = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;
const SRC_ATTR_RE = /\bsrc\s*=/i;
const TYPE_ATTR_RE = /\btype\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const HASH_TOKEN_RE = /^'sha256-[A-Za-z0-9+/]+=*'$/;

// A <script> block only executes as JavaScript if it has no type attribute,
// or the type is empty, a recognized JS MIME type, or "module". Anything else
// (application/json, application/ld+json, text/x-template, ...) is inert data
// and must not be hashed into script-src.
const JS_TYPES = new Set(['', 'text/javascript', 'application/javascript', 'application/ecmascript', 'text/ecmascript', 'module']);

function isExecutableScript(attrs) {
  if (SRC_ATTR_RE.test(attrs)) return false; // external script, not inline
  const m = attrs.match(TYPE_ATTR_RE);
  if (!m) return true; // no type attribute -> classic executable script
  const type = (m[1] ?? m[2] ?? '').trim().toLowerCase();
  return JS_TYPES.has(type);
}

// HTML source-stream preprocessing normalizes newlines before the browser ever
// tokenizes the document (CRLF -> LF, lone CR -> LF). CSP hashes are computed
// on that normalized text, not on raw file bytes, and this repository has
// pre-existing mixed CRLF/LF line endings — so this step is not optional.
function normalizeNewlines(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function sha256CspToken(scriptText) {
  const digest = crypto.createHash('sha256').update(normalizeNewlines(scriptText), 'utf8').digest('base64');
  return `'sha256-${digest}'`;
}

function extractInlineScripts(html) {
  const scripts = [];
  let m;
  SCRIPT_TAG_RE.lastIndex = 0;
  while ((m = SCRIPT_TAG_RE.exec(html))) {
    const attrs = m[1] || '';
    const body = m[2];
    if (!isExecutableScript(attrs)) continue;
    if (body.trim().length === 0) continue; // empty <script></script>, nothing to execute
    scripts.push({ index: m.index, body });
  }
  return scripts;
}

// Strip inline <script> bodies before scanning for HTML-attribute constructs,
// so JS source text (e.g. `el.onclick = () => {...}`, or a string containing
// "javascript:") is never mistaken for markup. Length-preserving so reported
// line numbers stay accurate.
function blankScriptBodies(html) {
  return html.replace(SCRIPT_TAG_RE, (whole, attrs, body) => {
    const openTagLen = whole.length - body.length - '</script>'.length;
    return whole.slice(0, openTagLen) + ' '.repeat(body.length) + '</script>';
  });
}

function lineOf(html, index) {
  return html.slice(0, index).split('\n').length;
}

const EVENT_HANDLER_RE = /<[a-zA-Z][^>]*\son[a-zA-Z]+\s*=\s*(?:"[^"]*"|'[^']*')[^>]*>/g;
const JS_URL_RE = /\b(?:href|src|action|formaction)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi;

function findCspIncompatibleConstructs(rawHtml) {
  const scanText = blankScriptBodies(rawHtml);
  const issues = [];
  let m;
  EVENT_HANDLER_RE.lastIndex = 0;
  while ((m = EVENT_HANDLER_RE.exec(scanText))) {
    const attr = m[0].match(/\son([a-zA-Z]+)\s*=/)[1];
    issues.push({ type: 'event-handler', detail: `on${attr}`, line: lineOf(rawHtml, m.index) });
  }
  JS_URL_RE.lastIndex = 0;
  while ((m = JS_URL_RE.exec(scanText))) {
    issues.push({ type: 'js-url', detail: m[0].slice(0, 60), line: lineOf(rawHtml, m.index) });
  }
  return issues;
}

// ---------------------------------------------------------------------------
// script-src token reconciliation
// ---------------------------------------------------------------------------

function splitDirectives(cspContent) {
  return cspContent.split(';').map(d => d.trim()).filter(Boolean);
}

function findDirective(directives, name) {
  const idx = directives.findIndex(d => d === name || d.startsWith(name + ' '));
  return idx;
}

// Rebuilds a script-src directive string with exactly the hash tokens the
// page's current inline scripts require, preserving every non-hash token
// (origins, 'self', etc.) and their original order.
function reconcileScriptSrc(directiveText, requiredHashes) {
  const tokens = directiveText.split(/\s+/).filter(Boolean);
  const name = tokens.shift(); // "script-src"
  const otherTokens = tokens.filter(t => !HASH_TOKEN_RE.test(t));
  const currentHashTokens = tokens.filter(t => HASH_TOKEN_RE.test(t));

  const currentSet = new Set(currentHashTokens);
  const requiredSet = new Set(requiredHashes);
  const missing = requiredHashes.filter(h => !currentSet.has(h));
  const orphaned = currentHashTokens.filter(h => !requiredSet.has(h));
  const duplicated = currentHashTokens.filter((h, i) => currentHashTokens.indexOf(h) !== i);

  const selfIdx = otherTokens.indexOf("'self'");
  const insertAt = selfIdx >= 0 ? selfIdx + 1 : 0;
  const newTokens = [...otherTokens.slice(0, insertAt), ...requiredHashes, ...otherTokens.slice(insertAt)];
  const rebuilt = `${name} ${newTokens.join(' ')}`;

  return {
    rebuilt,
    changed: rebuilt !== directiveText,
    missing,
    orphaned,
    duplicated: [...new Set(duplicated)],
  };
}

// ---------------------------------------------------------------------------
// Per-file analysis
// ---------------------------------------------------------------------------

function analyzeFile(absPath) {
  const rel = path.relative(REPO_ROOT, absPath).replace(/\\/g, '/');
  const raw = fs.readFileSync(absPath, 'utf8');

  const cspMatch = raw.match(CSP_META_RE);
  const inlineScripts = extractInlineScripts(raw);
  const requiredHashes = inlineScripts.map(s => sha256CspToken(s.body));
  const constructs = findCspIncompatibleConstructs(raw);

  if (!cspMatch) {
    return {
      rel, raw, hasCsp: false, constructs,
      status: inlineScripts.length > 0 ? 'NO-CSP' : 'SKIP',
      inlineScriptCount: inlineScripts.length,
    };
  }

  const cspContent = cspMatch[1];
  const directives = splitDirectives(cspContent);
  const scriptSrcIdx = findDirective(directives, 'script-src');

  if (scriptSrcIdx === -1) {
    return {
      rel, raw, hasCsp: true, constructs,
      status: requiredHashes.length > 0 ? 'NO-SCRIPT-SRC' : 'SKIP',
      inlineScriptCount: inlineScripts.length,
    };
  }

  const result = reconcileScriptSrc(directives[scriptSrcIdx], requiredHashes);
  const ok = !result.changed && result.duplicated.length === 0;

  return {
    rel, raw, hasCsp: true, constructs,
    status: ok ? 'OK' : 'STALE',
    inlineScriptCount: inlineScripts.length,
    missing: result.missing,
    orphaned: result.orphaned,
    duplicated: result.duplicated,
    write: () => {
      const newDirectives = [...directives];
      newDirectives[scriptSrcIdx] = result.rebuilt;
      const newCspContent = newDirectives.join('; ');
      const newMetaTag = cspMatch[0].replace(cspContent, newCspContent);
      return raw.slice(0, cspMatch.index) + newMetaTag + raw.slice(cspMatch.index + cspMatch[0].length);
    },
  };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const results = htmlFiles.map(analyzeFile);
let problems = 0;
let filesWritten = 0;

console.log(`CSP hash ${mode === 'check' ? 'check' : 'write'} — ${htmlFiles.length} HTML file(s) scanned\n`);

for (const r of results) {
  const tag =
    r.status === 'OK' ? '[OK]      ' :
    r.status === 'SKIP' ? '[SKIP]    ' :
    r.status === 'STALE' ? '[STALE]   ' :
    r.status === 'NO-CSP' ? '[NO-CSP]  ' :
    '[NO-SRC]  ';

  if (r.status === 'SKIP') {
    console.log(`${tag}${r.rel} — no CSP, no inline scripts (expected for header/footer fragments etc.)`);
  } else if (r.status === 'OK') {
    console.log(`${tag}${r.rel} — ${r.inlineScriptCount} inline script(s), hash(es) match`);
  } else if (r.status === 'NO-CSP') {
    console.log(`${tag}${r.rel} — has ${r.inlineScriptCount} inline script(s) but NO Content-Security-Policy meta tag`);
    problems++;
  } else if (r.status === 'NO-SCRIPT-SRC') {
    console.log(`${tag}${r.rel} — has CSP but no script-src directive, and ${r.inlineScriptCount} inline script(s) need one`);
    problems++;
  } else if (r.status === 'STALE') {
    console.log(`${tag}${r.rel} — script-src hash mismatch`);
    for (const h of r.missing) console.log(`            missing (needs adding):   ${h}`);
    for (const h of r.orphaned) console.log(`            orphaned (no longer used): ${h}`);
    for (const h of r.duplicated) console.log(`            duplicated in policy:     ${h}`);
    problems++;
    if (mode === 'write') {
      fs.writeFileSync(path.join(REPO_ROOT, r.rel), r.write(), 'utf8');
      filesWritten++;
      console.log(`            -> rewritten`);
    }
  }

  for (const c of r.constructs) {
    const label = c.type === 'event-handler' ? 'EVENT-HANDLER' : 'JS-URL';
    console.log(`[${label}] ${r.rel}:${c.line} — ${c.detail}`);
    problems++;
  }
}

console.log('');
if (mode === 'write') {
  console.log(`Summary: ${filesWritten} file(s) updated, ${htmlFiles.length - filesWritten} unchanged.`);
  if (filesWritten > 0) {
    console.log('Run --check to verify, and re-run --write once more to confirm no further changes (idempotence).');
  }
  process.exit(0);
} else {
  const ok = htmlFiles.length - problems; // rough count for messaging only
  console.log(problems === 0
    ? `Summary: all ${htmlFiles.length} HTML file(s) clean. No stale hashes, no orphaned hashes, no inline event handlers, no javascript: URLs.`
    : `Summary: ${problems} issue(s) found across ${htmlFiles.length} HTML file(s). Run --write to regenerate stale/orphaned hashes; event-handler and javascript: URL issues must be fixed by hand.`);
  process.exit(problems === 0 ? 0 : 1);
}
