# Undergraduate EE curriculum data

`program_identity` in `ee_curriculum.json` stores the exact Program Mission supplied by the user and the three PEO statements transcribed from `EE Program Design Full ABET.xlsx`, sheet `PEOs`, cells C2:E2. Program Overview renders these fields and the existing `abet.student_outcomes[*].statement` values directly; it does not maintain separate copies of the approved statements. Existing outcome IDs and mappings are unchanged.

`ee_curriculum.json` is the single authoritative runtime database for the Undergraduate Electrical Engineering portal.

It contains course identity and metadata; required/elective classification; year, level, and credit hours; descriptions; prerequisites and corequisites; objectives; textbooks and references; course topics and contact hours; CLOs and NQF domains; CLO-to-SO and CLO-to-PI mappings; Teaching Strategies and Assessment Methods; course-level PI Introduced/Practiced/Mastered mappings; and the canonical ABET Student Outcome and Performance Indicator definitions and guidance.

Undergraduate portal pages read this canonical file directly. The MSc portal uses `msc_ee_courses_full.json` as its separate single runtime database. The remaining audit JSON files and baseline workbook exist only to regenerate the Term 252 CLO Revision Report; they are not runtime curriculum databases.

`ee_alignment_evidence.json` is the knowledge layer for the CLO–SO–PI Alignment & Evidence Analysis page. It holds only analysis rules and evidence guidance: the demonstration families used to read CLO wording, artifact and assessment-method profiles, per-Performance-Indicator evidence profiles, the supportive status model, the coverage thresholds, and the empty record schemas reserved for the future Measurement and Improvement layers. It duplicates no outcome definition and no approved mapping — those are read from `ee_curriculum.json`, and the assessment cycle is read from `ee-assessment.json`. Its `measurement_layer.records` and `improvement_layer.records` arrays are intentionally empty; no student performance or attainment value is stored anywhere in this module.
