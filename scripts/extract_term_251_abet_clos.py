"""Extract the Term 251 EE CLO baseline directly from the ABET syllabus PDF."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import pdfplumber


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "EE All syllabi 243.pdf"
OUTPUT = ROOT / "data" / "clo_baseline_term_251_abet.json"

COURSE_PAGES = {
    "EE 101": 22, "EE 201": 24, "EE 211": 26, "EE 221": 28,
    "EE 231": 30, "EE 202": 32, "EE 312": 34, "EE 322": 36,
    "EE 341": 38, "EE 332": 40, "EE 351": 42, "EE 305": 44,
    "EE 304": 46, "EE 403": 48, "EE 490": 50, "EE 492": 52,
}
EXPECTED_COUNTS = {
    "EE 101": 4, "EE 201": 5, "EE 211": 4, "EE 221": 7,
    "EE 231": 6, "EE 202": 5, "EE 312": 4, "EE 322": 5,
    "EE 341": 4, "EE 332": 6, "EE 351": 6, "EE 305": 6,
    "EE 304": 5, "EE 403": 5, "EE 490": 7, "EE 492": 6,
}
EXCLUDED_SOURCE_COURSES = [
    "MATH 111", "MATH 113", "MATH 215", "MATH 225", "MATH 223",
    "PHY 105", "PHY 205", "CHM 101", "STAT 101", "ENG 301",
]


def clean(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def extract_course(page, course_code: str, page_number: int) -> dict:
    text = page.extract_text() or ""
    title_match = re.search(rf"Course number and name:\s*{re.escape(course_code)}\s+(.+)", text)
    if not title_match:
        raise ValueError(f"Course title not found for {course_code} on page {page_number}")
    title = clean(title_match.group(1))
    tables = page.extract_tables()
    if not tables:
        raise ValueError(f"CLO table not found for {course_code} on page {page_number}")

    rows = tables[0][1:]
    outcomes: list[dict] = []
    current_domain = ""
    for source_row, row in enumerate(rows, start=2):
        cells = list(row) + [None] * (7 - len(row))
        domain = clean(cells[0])
        wording = clean(cells[2])
        so = clean(" ".join(clean(cell) for cell in cells[4:] if clean(cell)))
        if domain:
            current_domain = domain
        if not wording:
            continue

        # Rows without an SO are wrapped text, except for the visibly separate
        # EE 332 design CLO whose source table leaves the SO cell blank.
        continuation = bool(outcomes and not so and not (
            course_code == "EE 332" and wording.startswith("Design a stable control system")
        ))
        if continuation:
            outcomes[-1]["clo_text"] = clean(f"{outcomes[-1]['clo_text']} {wording}")
            continue

        outcomes.append({
            "nqf_domain": current_domain,
            "clo_text": wording,
            "source_so": so or None,
            "source_table_row": source_row,
        })

    domain_counts: dict[str, int] = {}
    for outcome in outcomes:
        domain = outcome["nqf_domain"]
        prefix = "1" if domain.startswith("Knowledge") else "2" if domain.startswith("Skills") else "3"
        domain_counts[prefix] = domain_counts.get(prefix, 0) + 1
        outcome["baseline_clo_ref"] = f"{prefix}.{domain_counts[prefix]}"
        outcome["source_page"] = page_number
        outcome["identifier_basis"] = "Derived from printed NQF-domain sequence; identifier is not printed in the PDF"

    expected = EXPECTED_COUNTS[course_code]
    if len(outcomes) != expected:
        raise AssertionError(f"{course_code}: extracted {len(outcomes)} CLOs; expected {expected}")
    return {"course_code": course_code, "course_title": title, "source_page": page_number, "clos": outcomes}


def main() -> None:
    source_bytes = SOURCE.read_bytes()
    with pdfplumber.open(SOURCE) as pdf:
        courses = [extract_course(pdf.pages[page - 1], code, page) for code, page in COURSE_PAGES.items()]
        page_count = len(pdf.pages)
    total = sum(len(course["clos"]) for course in courses)
    if total != 85:
        raise AssertionError(f"Extracted {total} baseline CLOs; expected 85")
    payload = {
        "schema_version": "1.0",
        "baseline_term": "251",
        "source_pdf": "data/EE All syllabi 243.pdf",
        "source_pdf_sha256": hashlib.sha256(source_bytes).hexdigest(),
        "source_pdf_pages": page_count,
        "identifier_note": "The PDF does not print CLO identifiers. References are derived from NQF-domain order within each course.",
        "included_courses": list(COURSE_PAGES),
        "excluded_source_courses": EXCLUDED_SOURCE_COURSES,
        "baseline_clo_count": total,
        "courses": courses,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT.relative_to(ROOT)), "courses": len(courses), "clos": total}, indent=2))


if __name__ == "__main__":
    main()
