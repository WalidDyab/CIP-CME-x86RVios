# Handoff: NCAAA Course Specification export for the EE portal

Branch task spec. Prepared from a working prototype that has been validated
end-to-end against the existing mail-merge output.

---

## 1. Objective

Add a **Print Course Specification** feature to the portal: generate NCAAA
course spec `.docx` files from `ee_curriculum.json`, preserving the official
ETEC template formatting exactly.

Replaces a Word mail merge driven by a flattened 92-column Excel sheet.

---

## 2. Scope

| Output | Count | Template | Status |
|---|---|---|---|
| Course Specification (CS) | 31 courses | `EE_CS_NCAAA_Template.docx` | prototype working |
| Field Experience Spec (FES) | 1 (EE 492, Co-Op) | FES template | **template not yet supplied** |

EE 492 is Cooperative Training. It does **not** use the CS form. Exclude it
from CS generation and route it to FES. Do not compute lecture/tutorial/lab
hours for it — that split does not apply to a co-op placement.

---

## 3. Architecture — keep the engine pure

The department tracks **both ABET and NCAAA**. The CS document is one of
several NCAAA forms; an ABET report is a separate consumer of the same data.

Therefore:

```
engine/            pure: (curriculum, course_code, template, rules) -> .docx
  fields.py        MERGEFIELD flatten + sentinel substitution
  rows.py          <w:tr> cloning for variable-length sections
  render.py        orchestration
templates/
  ncaaa_cs/        template.docx + fieldmap + rules
  ncaaa_fes/       (to add)
  abet_report/     (future)
portal/            thin caller only
```

**Constraints**

- The engine must not import portal code, hit the DB, or make network calls.
- Templates are **versioned binary assets**, never inlined into source. When
  ETEC revises the form, the file is swapped and rules adjusted.
- Adding a document type = new registry entry, not a refactor of the engine.

---

## 4. Fill mechanics (validated — do not redesign)

The template's 87 `MERGEFIELD` codes are the destination map. Read them from
the XML; do not hand-maintain a parallel mapping.

1. **Flatten** each MERGEFIELD complex field into a single run carrying a
   sentinel, inheriting `rPr` from the cached-result run so formatting is
   identical.
2. **Clone rows** for variable-length sections. Deep-copy the template's model
   `<w:tr>`, fill it, then delete the model. Cloned rows inherit borders,
   shading, row height and cell margins automatically.
3. **Substitute** sentinels with values. Missing data renders **blank**.

### Gotchas that cost time in the prototype

- Merge-field runs sit inside `<w:sdt>` / `<w:sdtContent>` content controls,
  **not** as direct `<w:p>` children. Walk from each field's actual parent.
- Do **not** run `merge_runs.py` on this template. It collapses
  `begin` + `instrText` + `separate` into one run and breaks naive field
  scanners. Parse child-by-child within each run instead.
- `w:rFonts w:hint="cs"` fails strict XSD validation in **3 places in the
  original template**. Pre-existing, Word-tolerated. Not a regression.

---

## 5. Derived rules

### 5.1 Contact hours

```
Total = 45 (lectures) + tutorial + lab

Capstone / COOP / Elective  -> lab 0,  tut 0   -> 45
credit_hours == 4           -> lab 30, tut 15  -> 90
otherwise (3-cr required)   -> lab 0,  tut 15  -> 60
```

Validated against **29 of 30** historical Excel rows. The single deviation is
EE 492, which is out of CS scope.

`Lectures 45` is **static text** in the template's activity table, not a merge
field. It is correct for every current course but will fail silently if that
ever changes. Add an assertion.

### 5.2 Tick boxes (currently hard-coded — must be derived)

Row A and row B glyphs are static in the template, reading ☒ Program and
☒ Required for every course. 16 of 31 courses are Elective, so as-is half the
set misstates its own status.

```
Row A from `type`:  College -> College   Program -> Program
                    Capstone -> Program  COOP -> Program
Row B from `required_or_elective`
```

Set `☒` / `☐` glyphs only. Do not restructure the table.

### 5.3 Assessment table variant

The template ships **both** variants and mail merge kept both in every
document. Select one and delete the other:

- **Lab variant (7 rows, includes Laboratory 15%)** — the 7 four-credit
  courses: EE 101, 201, 211, 221, 322, 351, 305
- **Standard variant (6 rows)** — all others

### 5.4 CLO table

Rows are grouped by NQF domain with hard-coded slots: 3 Knowledge, 5 Skills,
2 Values. Actual JSON ranges are 1–3, 1–5, **0–3**.

Clone per domain and renumber sequentially as `{group}.{i}`. EE 490 has three
Values CLOs and overflows the template — it is the regression case.

### 5.5 Field formatting

- `MPLO` column: bare numbers stripped from `SO1` -> `1`, comma-joined.
- Teaching strategies / assessment methods: **semicolon-joined**. JSON values
  contain internal commas, e.g. `"Written Reports (Proposal, Interim, and
  Final)"`. *(Confirm: old output used commas.)*
- Missing data -> blank.

### 5.6 Program constants

Not in the JSON, identical across all courses. Put in editable config:

```
Department        Communications and Networks Engineering
Version           1
Revision_Date     25-09-2024
COUNCIL_COMMITTEE Departmental Council
REFERENCE_NO      1
Date_of_Approval  25-09-2024
```

---

## 6. JSON hygiene — validator first, migration second

`ee_curriculum.json` is the source of truth. **Nothing may silently rewrite
it.** Build the validator first; run it in CI. Ship the migration separately as
a reviewable diff.

### Validator checks

| Check | Current state |
|---|---|
| `prerequisite_text` matches normalized `prerequisites` array | fails: `"PHYS 205, Math113"`, `"MATH225, EE 201"` |
| `total_topic_contact_hours` == sum of topic hours | passes where topics exist |
| `credit_hours` non-empty | fails: EE 417, EE 454 |
| `year` / `level` non-zero | fails: all 16 electives |
| `course_description` non-empty | fails: EE 417, EE 454, EE 499 |
| No Excel artifacts (`#REF!`, `#N/A`) | `#REF!` reached the published PDF via EE 101 topics |

### Migration (separate PR)

Regenerate `prerequisite_text` from the `prerequisites` array so spacing and
casing are consistent across all documents. Idempotent.

---

## 7. Content readiness — not a code problem

Only **15 of 31** courses have complete CS data. All 15 are Required. All 16
Electives carry CLOs and (mostly) a description, and nothing else.

| Field | Required (15) | Elective (16) |
|---|---|---|
| year / level | populated | all `0` |
| course_objectives | 3 each | 0 |
| textbooks | 1 each | 0 |
| course_topics | 6–10 | 0 |
| course_description | 15 | 13 |
| clos | complete | complete |

**Portal requirement:** show a per-course readiness indicator listing missing
fields, so a coordinator sees the gap before exporting rather than after.
Exporting an incomplete course is allowed, not blocked.

EE 417 (Communication Electronics) and EE 454 (Power System Planning) were
absent from the old Excel entirely and need full data entry.

---

## 8. Test fixtures

Four courses cover the cases that break naive implementations:

| Course | Why |
|---|---|
| **EE 101** | full lab course; every section populated; 4 cr -> lab table |
| **EE 490** | 3 Values CLOs, overflows the template's 2 slots |
| **EE 417** | stub record: no credit hours, no description, `0/0` |
| **EE 492** | out of CS scope -> must route to FES, not silently render |

Golden-file test: render to PDF, rasterize, compare against approved images.
Catches formatting regressions that XML diffs miss.

---

## 9. Acceptance criteria

- [ ] 31 CS documents generate without leftover `«MergeField»` markers
- [ ] CLO row count per domain == JSON array length, for every course
- [ ] Topic row count == JSON array length
- [ ] Tick boxes match `type` and `required_or_elective`
- [ ] Exactly one assessment table per document
- [ ] Contact hours match the §5.1 rule
- [ ] Rendered pages visually identical to template styling
- [ ] Validation introduces no new XSD errors beyond the 3 pre-existing
- [ ] EE 492 excluded from CS output
- [ ] Engine has no portal imports

---

## 10. Open items

1. **Portal stack.** Prototype is Python + `lxml`. If the portal is Node
   (`provenance` references a `.mjs` migration script), either port the engine
   or run it as a service. Decide before implementation, not during.
2. **FES template** not yet supplied. EE 492 blocked until it is.
3. **Separator confirmation:** semicolon (safe) vs comma (matches old output).
4. **Output mode:** one file per course, one combined document, or both.

---

## 11. Reference

`gen_spec.py` — working prototype. Produces a validated EE 490 spec with
correct row cloning. Treat as reference for mechanics, not as production
structure.
