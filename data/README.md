# Undergraduate EE curriculum data

`ee_curriculum.json` is the single authoritative runtime database for the Undergraduate Electrical Engineering portal.

It contains course identity and metadata; required/elective classification; year, level, and credit hours; descriptions; prerequisites and corequisites; objectives; textbooks and references; course topics and contact hours; CLOs and NQF domains; CLO-to-SO and CLO-to-PI mappings; Teaching Strategies and Assessment Methods; course-level PI Introduced/Practiced/Mastered mappings; and the canonical ABET Student Outcome and Performance Indicator definitions and guidance.

Portal pages and curriculum-processing scripts must read this canonical file directly. Specialized audit, catalogue, workbook-extraction, and provenance files remain supporting artifacts and are not competing runtime curriculum databases.
