# Undergraduate EE curriculum data

`program_identity` in `ee_curriculum.json` stores the exact Program Mission supplied by the user and the three PEO statements transcribed from `EE Program Design Full ABET.xlsx`, sheet `PEOs`, cells C2:E2. Program Overview renders these fields and the existing `abet.student_outcomes[*].statement` values directly; it does not maintain separate copies of the approved statements. Existing outcome IDs and mappings are unchanged.

`ee_curriculum.json` is the single authoritative runtime database for the Undergraduate Electrical Engineering portal.

It contains course identity and metadata; required/elective classification; year, level, and credit hours; descriptions; prerequisites and corequisites; objectives; textbooks and references; course topics and contact hours; CLOs and NQF domains; CLO-to-SO and CLO-to-PI mappings; Teaching Strategies and Assessment Methods; course-level PI Introduced/Practiced/Mastered mappings; and the canonical ABET Student Outcome and Performance Indicator definitions and guidance.

Undergraduate portal pages read this canonical file directly. The MSc portal uses `msc_ee_courses_full.json` as its separate single runtime database. The remaining audit JSON files and baseline workbook exist only to regenerate the Term 252 CLO Revision Report; they are not runtime curriculum databases.
