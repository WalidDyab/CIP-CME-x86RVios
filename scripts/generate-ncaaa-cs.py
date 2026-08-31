#!/usr/bin/env python3
"""Generate official NCAAA Course Specifications from ee_curriculum.json.

The generator patches a copy of the official DOCX package directly. Only
word/document.xml is changed; all other template package parts remain intact.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import sys
import zipfile
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from lxml import etree


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "ee_curriculum.json"
TEMPLATE_PATH = ROOT / "templates" / "EE-CS-NCAAA-Template.docx"
DEFAULT_OUTPUT_DIR = ROOT / "generated" / "ncaaa-cs"

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
W14_NS = "http://schemas.microsoft.com/office/word/2010/wordml"
NS = {"w": W_NS, "w14": W14_NS}
W = f"{{{W_NS}}}"
W14 = f"{{{W14_NS}}}"

FIXED_VALUES = {
    "Program": "Electrical Engineering",
    "Department": "Communications and Networks Engineering",
    "Version": "2",
    "Revision_Date": "Aug-26",
    "COUNCIL_COMMITTEE": "Department Council",
    "REFERENCE_NO": "2",
    "Date_of_Approval": "August 2026",
}

CLO_SLOT_BY_CODE = {
    "1.1": 1,
    "1.2": 2,
    "1.3": 3,
    "2.1": 4,
    "2.2": 5,
    "2.3": 6,
    "2.4": 7,
    "2.5": 8,
    "3.1": 9,
    "3.2": 10,
    "3.3": 11,
}

REQUIRED_GENERAL_FIELDS = (
    "course_code",
    "course_title",
    "required_or_elective",
    "level",
    "year",
    "credit_hours",
    "course_description",
)


class ValidationError(Exception):
    """A course cannot be represented safely by the current template."""


class ExcludedCourse(Exception):
    """A course intentionally uses a different NCAAA template."""


@dataclass
class CourseResult:
    course_code: str
    status: str
    file: str | None = None
    warnings: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    reason: str | None = None

    def as_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {
            "course_code": self.course_code,
            "status": self.status,
            "warnings": self.warnings,
            "errors": self.errors,
        }
        if self.file:
            result["file"] = self.file
        if self.reason:
            result["reason"] = self.reason
        return result


def load_courses() -> list[dict[str, Any]]:
    data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    return data["curriculum"]["courses"]


def normalized_course_code(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", str(value).upper())


def filename_for_course(course_code: str) -> str:
    safe_code = normalized_course_code(course_code)
    return f"{safe_code}_NCAAA_Course_Specification.docx"


def clo_code(value: Any) -> str:
    try:
        number = Decimal(str(value))
    except InvalidOperation as exc:
        raise ValidationError(f"invalid CLO code {value!r}") from exc
    return f"{number:.1f}"


def clean_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if item is not None and str(item).strip()]


def optional_text(course: dict[str, Any], text_key: str, list_key: str) -> str:
    direct = course.get(text_key)
    if direct is not None and str(direct).strip():
        return str(direct)
    return "; ".join(clean_list(course.get(list_key)))


def is_coop(course: dict[str, Any]) -> bool:
    return str(course.get("type", "")).strip().upper() == "COOP"


def is_senior_design(course: dict[str, Any]) -> bool:
    return str(course.get("type", "")).strip().lower() == "capstone"


def contact_hours(course: dict[str, Any]) -> tuple[dict[str, str], str]:
    raw_credits = course.get("credit_hours")
    try:
        credits = Decimal(str(raw_credits))
    except (InvalidOperation, TypeError) as exc:
        raise ValidationError("credit_hours is missing or not numeric") from exc

    requirement = str(course.get("required_or_elective", "")).strip().lower()
    if requirement not in {"required", "elective"}:
        raise ValidationError(
            f"required_or_elective must be Required or Elective, got {course.get('required_or_elective')!r}"
        )

    if credits == 4:
        return {"LabHrs": "30", "TutHrs": "15", "TotalCH": "90"}, "4-credit laboratory rule"
    if credits == 3 and (requirement == "elective" or is_senior_design(course)):
        rule = "3-credit senior-design rule" if is_senior_design(course) else "3-credit elective rule"
        return {"LabHrs": "", "TutHrs": "", "TotalCH": "45"}, rule
    if credits == 3 and requirement == "required":
        return {"LabHrs": "", "TutHrs": "15", "TotalCH": "60"}, "3-credit core/tutorial rule"
    raise ValidationError(f"no approved contact-hour rule for {raw_credits!r} credits")


def validate_and_build_values(course: dict[str, Any]) -> tuple[dict[str, str], list[str], str]:
    code = str(course.get("course_code", "<unknown>"))
    if is_coop(course):
        raise ExcludedCourse("Co-Op/Field Experience uses a different NCAAA template")

    missing = [key for key in REQUIRED_GENERAL_FIELDS if not str(course.get(key) or "").strip()]
    if missing:
        raise ValidationError("missing required general field(s): " + ", ".join(missing))

    hours, hours_rule = contact_hours(course)
    warnings: list[str] = []
    values = dict(FIXED_VALUES)
    values.update(
        {
            "Course_Title": str(course["course_title"]),
            "Course_Code": code,
            "Credit_Hours": str(course["credit_hours"]),
            "Type": str(course["required_or_elective"]),
            "Level": str(course["level"]),
            "Year": str(course["year"]),
            "Course_Description": str(course["course_description"]),
            "Prereq": optional_text(course, "prerequisite_text", "prerequisites"),
            "Coreq": optional_text(course, "corequisite_text", "corequisites"),
            "Textbook": "; ".join(clean_list(course.get("textbooks"))[:1]),
        }
    )
    values.update(hours)

    objectives = clean_list(course.get("course_objectives"))
    if len(objectives) > 3:
        warnings.append(f"{code}: only the first 3 of {len(objectives)} objectives fit the template")
    for index in range(1, 4):
        values[f"O{index}"] = objectives[index - 1] if index <= len(objectives) else ""

    references = clean_list(course.get("references"))
    for index in range(1, 4):
        values[f"Ref_{index}"] = references[index - 1] if index <= len(references) else ""

    for index in range(1, 12):
        values[f"CLO_{index}"] = ""
        values[f"MPLO{index}"] = ""
        values[f"CLO_{index}_TS"] = ""
        values[f"CLO_{index}_AM"] = ""

    clos = course.get("clos") or []
    if len(clos) > 11:
        raise ValidationError(f"contains {len(clos)} CLOs; template capacity is 11")
    seen_codes: set[str] = set()
    for clo in clos:
        code_value = clo_code(clo.get("clo_number"))
        if code_value not in CLO_SLOT_BY_CODE:
            raise ValidationError(f"unsupported CLO code {code_value}; no matching NCAAA row")
        if code_value in seen_codes:
            raise ValidationError(f"duplicate CLO code {code_value}")
        seen_codes.add(code_value)
        slot = CLO_SLOT_BY_CODE[code_value]
        values[f"CLO_{slot}"] = str(clo.get("clo_text") or "")
        values[f"MPLO{slot}"] = ", ".join(clean_list(clo.get("mapped_sos")))
        values[f"CLO_{slot}_TS"] = "; ".join(clean_list(clo.get("teaching_strategy")))
        values[f"CLO_{slot}_AM"] = "; ".join(clean_list(clo.get("assessment_methods")))

    topics = course.get("course_topics") or []
    if len(topics) > 10:
        raise ValidationError(f"contains {len(topics)} topics; template capacity is 10")
    topic_sum = Decimal("0")
    for index in range(1, 11):
        values[f"Top{index}"] = ""
        values[f"Top{index}_CH"] = ""
    for index, topic in enumerate(topics, start=1):
        values[f"Top{index}"] = str(topic.get("topic_title") or "")
        raw_topic_hours = topic.get("contact_hours")
        if raw_topic_hours is None or str(raw_topic_hours).strip() == "":
            warnings.append(f"{code}: topic {index} has no contact_hours")
            values[f"Top{index}_CH"] = ""
            continue
        try:
            numeric_hours = Decimal(str(raw_topic_hours))
        except InvalidOperation as exc:
            raise ValidationError(f"topic {index} contact_hours is not numeric") from exc
        topic_sum += numeric_hours
        values[f"Top{index}_CH"] = str(raw_topic_hours)

    expected_total = Decimal(hours["TotalCH"])
    values["TopicHrs"] = hours["TotalCH"]
    if topic_sum != expected_total:
        warnings.append(
            f"{code}: stored topic hours total {topic_sum:g}, expected {expected_total:g} under the {hours_rule}"
        )
    declared_total = course.get("total_topic_contact_hours")
    if declared_total not in (None, ""):
        try:
            declared_numeric = Decimal(str(declared_total))
            if declared_numeric != topic_sum:
                warnings.append(
                    f"{code}: declared total_topic_contact_hours {declared_numeric:g} does not match stored topic sum {topic_sum:g}"
                )
        except InvalidOperation:
            warnings.append(f"{code}: total_topic_contact_hours is not numeric")

    return values, warnings, hours_rule


def field_name(instruction: str) -> str | None:
    match = re.search(r'\bMERGEFIELD\s+(?:"([^"]+)"|([^\s\\]+))', instruction, re.IGNORECASE)
    return (match.group(1) or match.group(2)) if match else None


def replacement_run(field_runs: list[etree._Element], value: str) -> etree._Element:
    result_run = None
    separated = False
    for run in field_runs:
        fld = run.find(f".//{W}fldChar")
        if fld is not None and fld.get(f"{W}fldCharType") == "separate":
            separated = True
            continue
        if separated and run.find(f".//{W}t") is not None:
            result_run = run
            break
    if result_run is None:
        result_run = field_runs[0]

    new_run = etree.Element(f"{W}r")
    run_properties = result_run.find(f"{W}rPr")
    if run_properties is not None:
        new_run.append(copy.deepcopy(run_properties))
    text_element = etree.SubElement(new_run, f"{W}t")
    if value.startswith(" ") or value.endswith(" "):
        text_element.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    text_element.text = value
    return new_run


def replace_merge_fields(root: etree._Element, values: dict[str, str]) -> set[str]:
    replaced: set[str] = set()
    # Most fields are direct paragraph children. Some cover-page fields are
    # wrapped in plain-text content controls, so process their sdtContent
    # containers as well without reconstructing the controls.
    containers = root.xpath(".//w:p | .//w:sdtContent", namespaces=NS)
    for container in containers:
        children = list(container)
        index = 0
        while index < len(children):
            child = children[index]
            begin = child.find(f".//{W}fldChar") if child.tag == f"{W}r" else None
            if begin is None or begin.get(f"{W}fldCharType") != "begin":
                index += 1
                continue
            end_index = index
            depth = 0
            instructions: list[str] = []
            while end_index < len(children):
                candidate = children[end_index]
                if candidate.tag == f"{W}r":
                    for fld in candidate.findall(f".//{W}fldChar"):
                        kind = fld.get(f"{W}fldCharType")
                        if kind == "begin":
                            depth += 1
                        elif kind == "end":
                            depth -= 1
                    instructions.extend(candidate.xpath(".//w:instrText/text()", namespaces=NS))
                if depth == 0:
                    break
                end_index += 1
            instruction = "".join(instructions).strip()
            name = field_name(instruction)
            if not name:
                index = end_index + 1
                continue
            if name not in values:
                raise ValidationError(f"template field {name!r} has no supplied value")
            field_runs = children[index : end_index + 1]
            new_run = replacement_run(field_runs, values[name])
            container.insert(index, new_run)
            for old in field_runs:
                container.remove(old)
            replaced.add(name)
            children = list(container)
            index += 1
    return replaced


def set_course_type_checkboxes(root: etree._Element, requirement: str) -> None:
    desired = {
        "University": False,
        "College": False,
        "Program": True,
        "Track": False,
        "Others": False,
        "Required": requirement.lower() == "required",
        "Elective": requirement.lower() == "elective",
    }
    found: set[str] = set()
    controls = root.xpath(".//w:sdt[w:sdtPr/w14:checkbox]", namespaces=NS)
    for control in controls:
        paragraph = control.getparent()
        paragraph_text = "".join(paragraph.xpath(".//w:t/text()", namespaces=NS))
        label = next((candidate for candidate in desired if candidate in paragraph_text), None)
        if not label:
            continue
        checked = desired[label]
        checked_element = control.find("w:sdtPr/w14:checkbox/w14:checked", namespaces=NS)
        if checked_element is None:
            raise ValidationError(f"checkbox {label} has no w14:checked state")
        checked_element.set(f"{W14}val", "1" if checked else "0")
        text_nodes = control.xpath(".//w:t", namespaces=NS)
        if not text_nodes:
            raise ValidationError(f"checkbox {label} has no visible glyph")
        text_nodes[0].text = "☒" if checked else "☐"
        found.add(label)
    missing = sorted(set(desired) - found)
    if missing:
        raise ValidationError("template checkbox controls not found: " + ", ".join(missing))


def keep_approval_rows_together(root: etree._Element) -> None:
    """Prevent Word from orphaning the final approval row on a new page."""
    for table in root.xpath(".//w:tbl", namespaces=NS):
        table_text = " ".join(table.xpath(".//w:t/text()", namespaces=NS)).upper()
        if "DEPARTMENT COUNCIL" not in table_text or "AUGUST 2026" not in table_text:
            continue
        rows = table.xpath("./w:tr", namespaces=NS)
        for row in rows[:-1]:
            row_properties = row.find(f"{W}trPr")
            if row_properties is None:
                row_properties = etree.Element(f"{W}trPr")
                row.insert(0, row_properties)
            if row_properties.find(f"{W}cantSplit") is None:
                row_properties.append(etree.Element(f"{W}cantSplit"))
            for paragraph in row.xpath(".//w:p", namespaces=NS):
                paragraph_properties = paragraph.find(f"{W}pPr")
                if paragraph_properties is None:
                    paragraph_properties = etree.Element(f"{W}pPr")
                    paragraph.insert(0, paragraph_properties)
                if paragraph_properties.find(f"{W}keepNext") is None:
                    paragraph_properties.append(etree.Element(f"{W}keepNext"))
        return
    raise ValidationError("specification approval table not found")


def patch_document_xml(xml_bytes: bytes, values: dict[str, str], requirement: str) -> bytes:
    parser = etree.XMLParser(remove_blank_text=False)
    root = etree.fromstring(xml_bytes, parser)
    replaced = replace_merge_fields(root, values)
    missing = sorted(set(values) - replaced)
    if missing:
        raise ValidationError("expected merge field(s) not found: " + ", ".join(missing))
    set_course_type_checkboxes(root, requirement)
    keep_approval_rows_together(root)
    output = etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)
    if b"MERGEFIELD" in output or "«".encode("utf-8") in output or "»".encode("utf-8") in output:
        raise ValidationError("unresolved merge-field content remains in word/document.xml")
    return output


def write_generated_docx(course: dict[str, Any], values: dict[str, str], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(TEMPLATE_PATH, "r") as source:
        document_xml = patch_document_xml(
            source.read("word/document.xml"), values, str(course["required_or_elective"])
        )
        with zipfile.ZipFile(output_path, "w") as destination:
            for info in source.infolist():
                payload = document_xml if info.filename == "word/document.xml" else source.read(info.filename)
                destination.writestr(info, payload)


def generate_course(course: dict[str, Any], output_dir: Path) -> CourseResult:
    code = str(course.get("course_code", "<unknown>"))
    try:
        values, warnings, hours_rule = validate_and_build_values(course)
        filename = filename_for_course(code)
        write_generated_docx(course, values, output_dir / filename)
        warnings.insert(0, f"{code}: contact hours use the {hours_rule}")
        return CourseResult(code, "generated", filename, warnings)
    except ExcludedCourse as exc:
        return CourseResult(code, "excluded", reason=str(exc))
    except ValidationError as exc:
        return CourseResult(code, "error", errors=[f"{code}: {exc}"])


def verify_preserved_parts(generated_path: Path) -> None:
    with zipfile.ZipFile(TEMPLATE_PATH) as source, zipfile.ZipFile(generated_path) as generated:
        source_names = source.namelist()
        if source_names != generated.namelist():
            raise ValidationError("generated DOCX package part list differs from the master template")
        for name in source_names:
            if name == "word/document.xml":
                continue
            if source.read(name) != generated.read(name):
                raise ValidationError(f"preserve-only template part changed: {name}")


def write_reports(results: list[CourseResult], output_dir: Path, template_hash: str) -> None:
    manifest = {
        result.course_code: {
            "status": result.status,
            **({"file": result.file} if result.file else {}),
            **({"reason": result.reason} if result.reason else {}),
            **({"errors": result.errors} if result.errors else {}),
        }
        for result in results
    }
    report = {
        "source": str(DATA_PATH.relative_to(ROOT)).replace("\\", "/"),
        "template": str(TEMPLATE_PATH.relative_to(ROOT)).replace("\\", "/"),
        "template_sha256": template_hash,
        "results": [result.as_dict() for result in results],
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    (output_dir / "generation-report.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("course", nargs="?", help="course code, e.g. EE351 or 'EE 351'")
    target.add_argument("--all", action="store_true", help="generate every eligible course")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not TEMPLATE_PATH.exists():
        print(f"ERROR: official template not found: {TEMPLATE_PATH}", file=sys.stderr)
        return 2
    template_hash = hashlib.sha256(TEMPLATE_PATH.read_bytes()).hexdigest().upper()
    courses = load_courses()

    if args.all:
        selected = courses
    else:
        wanted = normalized_course_code(args.course)
        selected = [course for course in courses if normalized_course_code(course.get("course_code", "")) == wanted]
        if not selected:
            print(f"ERROR: course not found: {args.course}", file=sys.stderr)
            return 2

    results = [generate_course(course, args.output_dir) for course in selected]
    for result in results:
        label = result.status.upper()
        detail = result.file or result.reason or "; ".join(result.errors)
        print(f"{label}: {result.course_code}: {detail}")
        for warning in result.warnings:
            print(f"  WARNING: {warning}")

    generated = [result for result in results if result.status == "generated" and result.file]
    for result in generated:
        verify_preserved_parts(args.output_dir / result.file)

    if args.all:
        write_reports(results, args.output_dir, template_hash)

    errors = [result for result in results if result.status == "error"]
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
