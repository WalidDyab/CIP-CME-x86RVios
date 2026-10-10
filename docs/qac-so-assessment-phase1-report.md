# SO Assessment Preparation Tool — Phase 1 Report

QAC rubric ingestion and Excel template integration. Branch `claude/so-assessment-qac-foundation` (baseline `1861291`). Scope is limited to the foundation: no UI, suggestion engine, AI, Word export or attainment logic was built, and no QAC template or rubric wording was modified, and the only curriculum/guidance changes are the owner-directed PI31 wording and its dependent evidence profile (decision D4 below).

## Owner decisions incorporated (after first review)

| ID | Decision | Where recorded | Status |
|---|---|---|---|
| D1 | At most **five assessment activities per course preparation session, in total (not per SO)**; one activity may cover several CLOs, SOs and PIs. | mapping `decisions.D1`, `preparation_limits`, `assessment_block.max_activities_per_session` | Requirement for later phases (not implemented) |
| D2 | Each QAC workbook is dedicated to one SO; the pre-filled Main row 6 (SO4, PI list, CLO text, `B6` lookup) is an error. The future exporter **clears the entire row 6** (contents and formulas) in every generated copy for all four templates, keeping merges, styles and everything else. `A6` is never populated and the `B6` lookup is not retained. | mapping `decisions.D2`, `cleared_rows` per template | Requirement for later phases (clearing is exercised by a test-only model) |
| D3 | Generated `Mapped PIs` contain only instructor-selected PIs that are validly mapped to the selected CLOs and the SO, merged across activities without duplicates, keeping assessment-to-PI traceability. Never all PIs of an SO. | mapping `decisions.D3`, `mapped_pis_*` fields | Requirement for later phases |
| D4 | PI31 takes the QAC visible-rubric wording, with a final period. | `data/ee_curriculum.json` -> `abet.performance_indicators.PI31.statement`; guidance in `data/ee_alignment_evidence.json` | **Applied** |

**D4 detail.** Original: `Communicate relevant, accurate, and sufficient engineering information.` Replacement: `Communicate engineering information using appropriate technical content.` (rubric label text plus the owner-specified final period). In `ee_curriculum.json` the statement existed in one place and the diff is one line; the PI id, `so`, `rubric`, illustration text and every CLO/course mapping are unchanged. Pages and exports read the statement from this file, so they follow automatically. The dependent guidance `ee_alignment_evidence.json` -> `pi_evidence_profiles.PI31` was revised to match (`demonstrates`, `relationship`, `rubric_criteria`, `attainment_methodology`; family, artifacts and strengthening untouched; previously phrased around "relevant, accurate and sufficient"): demonstrates = *the student communicates engineering information using appropriate technical content*; criteria now follow the QAC checklist (essential information with appropriate technical content; key concepts and results explained with sufficient detail and supporting evidence). No other file stored the old wording. Both files are in the desktop runtime allowlist, so the desktop release id must be bumped when this is next packaged (not done here).

## A. CIP data integration

**How CIP stores things today** (investigated, unchanged):

| Need | Location |
|---|---|
| Course info, instructor, CLO text, CLO→SO and CLO→PI mappings, approved assessment methods per CLO | `data/ee_curriculum.json` → `curriculum.courses[]` (`course_code` like `"EE 322"`, `clos[].clo_number / clo_text / mapped_sos / pi_codes / assessment_methods`) |
| SO and PI identifiers, statements | `data/ee_curriculum.json` → `abet.student_outcomes`, `abet.performance_indicators` (each PI has `so`) |
| Assessment cycle, active term, courses selected per SO | `data/ee-assessment.json` (`active_term` = `T261`, `so_course_selection`, `roadmap`) |

`ee_curriculum.json` stays the single source of truth. For EE 322 the plan selects SO1, SO2 and SO4 (not SO3).

**What was added** (all new files; the only edits to existing files are a README section, one `.gitattributes` rule, the one-line PI31 statement change and the PI31 evidence-profile text):

| Path | Purpose |
|---|---|
| `data/ee-qac-rubrics.json` | Verbatim QAC rubrics for SO1–SO4, scoring rules, indexes |
| `data/ee-qac-templates.json` | Template manifest: version labels, SHA-256, sheet roles, external links |
| `data/ee-qac-main-sheet-mapping.json` | Main-sheet field map per workbook |
| `data/ee-qac-review-issues.json` | 21 items for QAC (nothing corrected); 4 resolved by decision (QAC-10, 11, 20, 21), 2 partially resolved (QAC-13, 15) |
| `templates/qac-so-assessment/<template-id>/<original file name>.xlsx` | Four byte-identical workbooks (`so1-ver01`, `so2-ver02-group`, `so3-ver01`, `so4-ver02`) |
| `scripts/qac_xlsx.py`, `generate_qac_rubrics.py`, `qac_mapping_data.py` | Standard-library extractor/generator (`--check` detects stale output) |
| `scripts/test_qac_rubrics.py` | 44 automated checks |

Naming follows the existing `data/ee-*.json` files; workbooks sit in `templates/` beside the other export templates. `.gitattributes` marks the folder `-text -diff` so Git never normalises line endings inside the workbooks. The files are **not** in `packaging/desktop-runtime-files.json`, so portal behaviour and the desktop package are unchanged. No new dependency (openpyxl is used by the tests only if present, as an independent second reader).

## B. Rubric inventory

Scale in every workbook: Above Expectation (3), Meet Expectation (2), Developing Expectation (1), Below Expectation (0). **No weights exist** in any workbook (`weights: null`); Results sheets average scores equally.

| SO | Template (version) | Rubric sheet(s) | PIs | Criteria | Checklists |
|---|---|---|---|---|---|
| SO1 | `PI-SO1 … ver01` | `Rubric` | PI11, PI12, PI13 | 1 per PI (3) | Project (team + individual), Exam/Written |
| SO2 | `PI-SO2 … ver02 - Group` (Main also declares version 2) | `SO2-PI21 Rubric`; `SO2-PI22,PI23&PI24 Rubric` | PI21 (8 criteria: problem/needs, design, alternatives, application of science, analysis/integration, evaluation, risks/trade-offs, iteration); PI22, PI23, PI24 (1 each) | 11 | One checklist (team + individual) |
| SO3 | `PI-SO3 … ver01` | `Rubric` | PI31, PI32, PI33 | 3 | Project (team + individual) |
| SO4 | `PI-SO4 … ver02 (1) (1)` | ` Rubric` (leading space) | PI41, PI42 | 2 | Project (team + individual), Exam |

Total: 19 criteria, 76 descriptors, 24 checklist cells. Team vs Individual: every checklist cell is split into `team_evidence` / `individual_verification` segments (verbatim substrings); exam columns are `exam_written`. Retrieval indexes: `by_so`, `by_pi`, `by_criterion`, `by_checklist_context`; criterion IDs look like `PI21.C3`.

Scoring rules recorded verbatim from the Results sheets (formulas and notes): student PI average → BE <1, DE <2, ME <3, AE otherwise; PI result = share of students scoring ≥2; SO result = share of students with ME/AE. SO2 (Group file) alone has separate Group and Individual score columns.

**Not extracted (hidden legacy sheets):** `SO4 Rubric`, `SO4 Assessment Results`, `Student work Description`, `SO4`, `SO5`, `SO6`, `SO7`, `SO8`, `Lookup Tables` — present in all workbooks, inconsistent with the visible rubrics (see D).

## C. Main-sheet mapping

Main-sheet layouts are the same in all four files except headings and the SO2 version block; every cell was confirmed individually. All fields are in `ee-qac-main-sheet-mapping.json` with `target.range`, `entry_mode`, `requirement`, `editable`, `current_content`, `cip_source` and issue flags.

| Field | Cells (merged range) | Mode / requirement | CIP source |
|---|---|---|---|
| Course name | `C1` (C1:E1) | CIP-derived, mandatory | `courses[].course_title` |
| Course code | `C2` (C2:E2) | CIP-derived, mandatory | `courses[].course_code` (format question, QAC-18) |
| Semester | `H1` (H1:J1) | CIP-derived, mandatory | `ee-assessment.json` `active_term` as default |
| Instructor | `H2` (H2:J2) | CIP-derived, mandatory | `courses[].instructor` |
| SO (row 5 only) | `A5` | pre-selected = workbook SO, mandatory | the workbook's own SO; one SO per workbook |
| SO statement | `B5:E5` | workbook VLOOKUP — do not write | reference only |
| Mapped PIs | `F5:I5` | CIP-derived, mandatory | instructor-selected PIs validly mapped to the selected CLOs and the SO, deduplicated (D3; QAC-11) |
| Mapped CLOs | `J5` | CIP-derived, mandatory | selected `clos[]` with the SO in `mapped_sos` |
| **Row 6** | `A6`, `B6`, `F6`, `J6` (whole row `A6:J6`) | **cleared in generated copies** | none (D2) |
| Assessment instruments (team/individual stated in text) | `A10:B10` | instructor entry, mandatory | constrained by approved `assessment_methods` |
| Context field | `C10:E10` | instructor entry, mandatory | none. Heading is SO-specific: SO1 complex-problem characteristics, SO2 design factors, SO3 audience, SO4 relevant considerations |
| PI justification | `F10:J10` | instructor entry, mandatory | none |
| SO2 only: version / date of update | `C11`, `C12` | QAC metadata, not an input | — |

**Multiple assessments:** Main has one assessment row (row 10, fixed 409.5 pt), so all activities for an SO share the three free-text cells; with D1 that is at most five activities per session in total, and an activity covering several SOs appears in each of those SOs' workbooks. Individual/Group has no field of its own; it is expressed inside the text. How activities are delimited and whether five fit the row remain open (QAC-13 partially resolved, QAC-08 open).

**Generated-workbook behaviour (requirements for later phases):** Mapped PIs follow D3 (selected + validly mapped, deduplicated, traceability kept in the preparation record). Row 6 follows D2: each template's `cleared_rows` entry lists the cells to verify and clear (`A6` SO4, `B6` VLOOKUP, `F6` PI list, `J6` CLO text, each with a content hash), requires the structure to be verified first, and lists what to preserve. In the packages only the Main sheet part (and a `calcChain.xml` entry for row 6, if one exists) changes. This resolves QAC-20: no `#N/A` cell remains. A generated workbook carries information only for its own SO.

## D. Ambiguities and limitations

Full text, evidence cells and questions: `data/ee-qac-review-issues.json`. Items needing academic decisions:

1. **Rubric authority (QAC-01, 02):** assumed the visible rubric sheets are authoritative. A hidden `SO4 Rubric` in all four workbooks has different PI41/PI42 wording from the SO4 file's visible rubric.
2. **Individual vs Group (QAC-08):** only the SO2 file is a "Group" variant with separate Group/Individual scoring; SO1/SO3/SO4 are not. Should they have Group variants?
3. **Assessment delimiting/capacity (QAC-13, partially resolved by D1) and row 7 / `B3:E3` on Main (QAC-12):** row 7 is merged yet has a drop-down. Row 6 (QAC-10, QAC-20) and the mapped-PI cell (QAC-11) are settled by D2/D3.
4. **Wording differences vs CIP (QAC-15, partially resolved by D4):** PI31 is aligned (QAC-21, the evidence profile, is resolved); PI23/PI24 still use verb forms and others differ in punctuation only.
6. **Template defects (QAC-04…07, 14, 16):** SO2 student-average formula spans derived columns and omits PI24 individual (`Y6`); dummy student data in SO2 Results `B6:C6`; SO2 date-of-update is in 2028; SO3 SO-result range stops at row 14; typos/copy-over text (e.g. the SO1 file refers to "SO2"); broken external link to `C:\21752_Rachid.xlsx`.
7. **Naming (QAC-18):** no confirmed convention for generated files (`EE322` vs `EE 322`, `T261`, suffixes).
8. **Tooling (QAC-17):** openpyxl would drop the x14 drop-down validations in three Main sheets; the future export must patch Main cell XML in place.

Limitations: criterion-to-Results-column matching for SO2's 1.1–1.8 is by order only (QAC-03); workbook versions rely on file names (`ver01/02`) because only SO2 declares one inside the file; formulas are stored without the leading `=`.

## E. Validation results

`python -B -m unittest discover -s scripts -p test_qac_rubrics.py` -> **44 tests, all pass.**

| Check | Result |
|---|---|
| Stored templates SHA-256, size and zip integrity match manifest; folder has exactly the four files | pass |
| Stored templates byte-identical to the supplied originals (Downloads folder) | pass |
| Sheet names/order/visibility match manifest; only visible sheets are authoritative | pass |
| Every extracted text equals its source cell (stdlib reader) and an independent openpyxl read | pass (2,962 non-empty cells cross-read by both readers during development: 0 differences) |
| Extracted cell set equals the rubric sheet's non-empty cell set (nothing omitted or added) | pass |
| 19 criteria × 4 levels (scores 3,2,1,0) non-empty; checklists present; segments rejoin to source text | pass |
| SO/PI correct against `ee_curriculum.json`; rubric PIs equal each SO's CIP PIs and the Main-sheet PI list; no CIP statement copied | pass |
| Indexes agree with a brute-force scan; retrieval by SO, PI, criterion, context | pass |
| Scoring formulas/notes equal the workbook; thresholds consistent with formula | pass |
| Main mapping: valid cells/ranges, anchors, merged ranges, labels, content hashes, drop-downs and comments, every non-empty Main cell accounted for | pass |
| Review-issue evidence cells contain the cited text | pass |
| Generated files equal a fresh regeneration | pass |
| No existing tracked file changed except `.gitattributes`, `data/README.md`, `data/ee_curriculum.json` and `data/ee_alignment_evidence.json`; all other baseline `data/` files unchanged; QAC assets absent from the runtime allowlist | pass |
| `ee_curriculum.json` equals the baseline in every respect except the PI31 statement (full-document comparison: mappings, CLO wording, other PI definitions and assessment methods unchanged) | pass |
| PI31 CIP statement equals the visible QAC rubric label text plus the final period; SO3-PI31 and every PI31 CLO mapping intact | pass |
| Decisions D1-D4 and revised issue statuses present in mapping/issues JSON; row 6 of the unmodified templates still holds the example (so the clearing rule is verifiable) | pass |
| Generated-copy model (test only): for each template, row 6 is cleared (values and formulas, including `B6`); merges, validation, comments, every other Main cell and every other sheet are identical; only the Main sheet part (and `calcChain.xml`) differ at byte level; the stored template hash is unchanged | pass |
| `ee_alignment_evidence.json` differs from the baseline only in the PI31 profile text; PI31 profile no longer contains the old wording | pass |
| Mutation checks: altered descriptor, altered template byte and altered curriculum file each fail the suite | pass |
| Existing packaging, runtime-compatibility and NCAAA generator suites; the four Node suites (CLO revision, NCAAA, references, textbook order) | pass (browser-driven suites not run) |

## F. Next-phase readiness

**Ready for Phase 2 (CLO Semantic Profiles)** with the following carried forward as open: the rubric JSON and CIP identifiers align one-to-one (SO1–SO4, 12 PIs), CLO/PI/assessment-method data were not touched, and the Main-sheet mapping gives Phase 2+ a defined set of CIP sources. Items that still block later population rather than Phase 2 are QAC-08, 13 (delimiting/fit) and 18; recommend resolving them with QAC before the export phase. SO5–SO7 have no QAC workbook, so no rubrics exist for them yet.

Phase 1 is committed on `claude/so-assessment-qac-foundation`; nothing was merged and Phase 2 has not been started.
