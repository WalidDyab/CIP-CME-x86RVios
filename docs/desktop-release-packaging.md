# Local desktop release packaging

Run from the repository root with Python 3.10 or newer (standard library only):

```powershell
python -B -m unittest discover -s scripts -p test_package_desktop_release.py
node scripts/update-csp-hashes.mjs --check
python -B scripts/package_desktop_release.py
git diff --check
```

The builder reads `packaging/desktop-release-id.txt`; it never increments it.
The initial identity is `r000000000001`. Future release preparation must explicitly
advance the identity. It is not derived from a date, Git SHA, or ZIP filename.

`packaging/desktop-runtime-files.json` lists exact repository-relative files.
There are no directory globs. Missing files, links/reparse points, unsafe paths,
duplicates and case collisions fail the build. Review new runtime dependencies
and explicitly add them to this list; never copy the entire source repository.
The list includes runtime audit/baseline JSON, three Word templates, and NQF PDFs.
It excludes development scripts, source documents, unused images, caches and output.
Unicode names and file bytes are preserved without normalization.

Output is ignored by Git:

```text
dist/desktop-release/r000000000001/
  release.json
  site/
  cip-release-r000000000001.zip
```

The ZIP contains `release.json` followed by `site/<runtime path>` regular files;
directories are implicit ZIP prefixes. No enclosing release directory is archived.
The desktop mounts the contents of `site/` at `https://cip.localhost/`.
Existing directory links such as `msc-ee/` require directory-index resolution
to `msc-ee/index.html`; verify this in the desktop integration milestone.

Manifest contract: `schema_version` is integer 1; `release_id` is `r` plus 12 ASCII
digits (all-zero rejected); `entrypoint` is `index.html`. `files` contains each
site file exactly once, with `path` relative to site, integer `bytes`, and lowercase
SHA-256 `sha256`. Records use ordinal path order. JSON is UTF-8 with LF and a final
newline. Archive entries use Stored compression, fixed 1980 timestamps and regular
0644 Unix permissions. No build time or machine-specific metadata is included.
Identical source bytes, allowlist and identity produce identical archive bytes.
Git checkout line-ending conversions can change source bytes across machines.

The builder stages in a fresh temporary directory within the ignored output root,
reopens the ZIP, independently recomputes its inventory/hashes/sizes, then publishes
the completed directory. Existing release output is never overwritten. To repeat
a local build, preserve or remove the prior generated directory explicitly first;
do not reuse an installed identity for changed content.

`verify_archive(path, expected_paths, expected_id)` in the builder can also verify
an existing ZIP. Build output prints file count, site bytes, ZIP bytes and ZIP hash.
These checks are local packaging checks, not proof of desktop ingestion.

## Compatibility milestone remains separate

This package preserves the current frontend, including hash-authorized inline
scripts, inline styles, CDN jsPDF/AutoTable and Google Fonts. Offline operation and
the desktop's restrictive CSP are not certified by packaging success. External
links, Blob/PDF downloads, printing and the JSZip fallback also need desktop tests.
No frontend rewriting, dependency downloading, network publishing or importer
execution is performed by this builder.

Next approved integration: pass the printed absolute ZIP path to the existing
desktop native ingest command, confirm `Installed(...)` for the manifest identity,
then use its existing prepare/restart flow. Check root/nested navigation, JSON,
templates, reports, downloads and console/CSP diagnostics at cip.localhost.
Use the desktop project's documented commands; this repository does not invent
or invoke a CLI contract for that separate project.
