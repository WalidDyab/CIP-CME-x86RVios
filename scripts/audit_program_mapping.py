import json
import re
import sys
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
CURRICULUM_JSON = ROOT / "data" / "ee_curriculum.json"
SO_PDF = ROOT / "data" / "Course-SO.pdf"
PI_PDF = ROOT / "data" / "Course-SO-PI.pdf"


def clean(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def title_key(value):
    return re.sub(r"[^a-z0-9]", "", clean(value).lower())


def extract_table(path):
    with pdfplumber.open(path) as pdf:
        tables = pdf.pages[0].extract_tables()
    if len(tables) != 1:
        raise RuntimeError(f"Expected one table in {path.name}; found {len(tables)}")
    return tables[0]


def code_key(value):
    match = re.search(r"EE\s*(\d{3})", clean(value), re.I)
    return f"EE {match.group(1)}" if match else clean(value)


def extract_so_rows():
    table = extract_table(SO_PDF)
    headers = [clean(value) for value in table[0]]
    rows = {}
    for row in table[1:]:
        code = clean(row[1] if len(row) > 1 else "")
        if not code.startswith("EE"):
            continue
        title = clean(row[0])
        levels = {headers[index]: clean(row[index]) for index in range(2, len(headers)) if clean(row[index])}
        rows[code_key(code)] = {"pdf_title": title, "pdf_code": code_key(code), "so_levels": levels}
    return rows


def extract_pi_rows():
    table = extract_table(PI_PDF)
    headers = [clean(value) for value in table[1]]
    rows = {}
    for row in table[2:]:
        code = clean(row[1] if len(row) > 1 else "")
        if not code.startswith("EE"):
            continue
        title = clean(row[0])
        levels = {headers[index]: clean(row[index]) for index in range(2, len(headers)) if clean(row[index])}
        rows[code_key(code)] = {"pdf_title": title, "pdf_code": code_key(code), "pi_levels": levels}
    return rows


curriculum = json.loads(CURRICULUM_JSON.read_text(encoding="utf-8"))
portal_courses = curriculum["curriculum"]["courses"]
so_rows = extract_so_rows()
pi_rows = extract_pi_rows()
pdf_code_for_portal = {"EE 433": "EE 430", "EE 435": "EE 440", "EE 454": "EE 452", "EE 456": "EE 454"}

results = []
for portal in portal_courses:
    key = pdf_code_for_portal.get(portal["course_code"], portal["course_code"])
    approved = {**so_rows.get(key, {}), **pi_rows.get(key, {})}
    if not approved:
        results.append({"course_code": portal["course_code"], "match": False, "reason": "No PDF course matched"})
        continue
    approved_so = approved.get("so_levels", {})
    approved_pi = approved.get("pi_levels", {})
    portal_so = set(
        so
        for clo in portal.get("clos", [])
        for so in clo.get("mapped_sos", [])
    )
    portal_pi = portal.get("pi_levels", {})
    results.append({
        "course_code": portal["course_code"],
        "course_title": portal["course_title"],
        "pdf_code": approved.get("pdf_code"),
        "approved_sos": approved_so,
        "portal_sos": sorted(portal_so),
        "approved_pis": approved_pi,
        "portal_pis": portal_pi,
        "so_match": set(approved_so) == portal_so,
        "pi_match": approved_pi == portal_pi,
        "match": set(approved_so) == portal_so and approved_pi == portal_pi,
    })

used_pdf_codes = {pdf_code_for_portal.get(course["course_code"], course["course_code"]) for course in portal_courses}
portal_unmatched = sorted(set(so_rows) - used_pdf_codes)
output = {
    "pdf_courses": len(results),
    "portal_courses": len(portal_courses),
    "matches": sum(result.get("match") is True for result in results),
    "discrepancies": [result for result in results if not result.get("match")],
    "portal_courses_not_in_pdf_by_title": portal_unmatched,
    "results": results if "--all" in sys.argv else None,
}
print(json.dumps(output, indent=2, ensure_ascii=False))
