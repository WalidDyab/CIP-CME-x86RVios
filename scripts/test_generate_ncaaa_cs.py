import importlib.util
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

from lxml import etree


ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "generate-ncaaa-cs.py"
SPEC = importlib.util.spec_from_file_location("generate_ncaaa_cs", MODULE_PATH)
generator = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = generator
SPEC.loader.exec_module(generator)


class NCAAA_CS_GeneratorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.courses = generator.load_courses()

    def course(self, code):
        wanted = generator.normalized_course_code(code)
        return next(c for c in self.courses if generator.normalized_course_code(c["course_code"]) == wanted)

    def test_clo_21_maps_to_fixed_slot_4(self):
        values, _, _ = generator.validate_and_build_values(self.course("EE351"))
        source = next(c for c in self.course("EE351")["clos"] if generator.clo_code(c["clo_number"]) == "2.1")
        self.assertEqual(values["CLO_4"], source["clo_text"])
        self.assertNotEqual(values["CLO_2"], source["clo_text"])

    def test_clo_33_maps_to_fixed_slot_11(self):
        values, _, _ = generator.validate_and_build_values(self.course("EE490"))
        source = next(c for c in self.course("EE490")["clos"] if generator.clo_code(c["clo_number"]) == "3.3")
        self.assertEqual(values["CLO_11"], source["clo_text"])
        self.assertEqual(values["MPLO11"], ", ".join(source["mapped_sos"]))

    def test_ee490_and_coop_generate_with_their_own_templates(self):
        with tempfile.TemporaryDirectory() as directory:
            result = generator.generate_course(self.course("EE490"), Path(directory))
            self.assertEqual(result.status, "generated")
            coop = generator.generate_course(self.course("EE492"), Path(directory))
            self.assertEqual(coop.status, "generated")
            self.assertEqual(coop.file, "EE492_NCAAA_Field_Experience_Specification.docx")

    def test_contact_hour_rules(self):
        self.assertEqual(generator.contact_hours(self.course("EE351"))[0]["TotalCH"], "90")
        self.assertEqual(generator.contact_hours(self.course("EE231"))[0]["TotalCH"], "60")
        self.assertEqual(generator.contact_hours(self.course("EE414"))[0]["TotalCH"], "45")

    def test_fes_values_use_current_admin_and_clo_data(self):
        course = self.course("EE492")
        values, warnings, rule = generator.validate_and_build_values(course)
        self.assertEqual(generator.document_kind_for_course(course), "fes")
        self.assertEqual(rule, "field-experience schedule")
        self.assertEqual(warnings, [])
        self.assertEqual(values["Version"], "2")
        self.assertEqual(values["Revision_Date"], "Aug-26")
        self.assertEqual(values["COUNCIL_COMMITTEE"], "Department Council")
        self.assertEqual(values["REFERENCE_NO"], "2")
        self.assertEqual(values["Date_of_Approval"], "August 2026")
        source = next(c for c in course["clos"] if generator.clo_code(c["clo_number"]) == "2.3")
        self.assertEqual(values["CLO_6"], source["clo_text"])
        self.assertEqual(values["MPLO6"], ", ".join(source["mapped_sos"]))
        self.assertEqual(values["CLO_6_TS"], "; ".join(source["teaching_strategy"]))
        self.assertEqual(values["CLO_6_AM"], "; ".join(source["assessment_methods"]))

    def test_generated_fes_resolves_fields_and_preserves_fixed_sections(self):
        with tempfile.TemporaryDirectory() as directory:
            output_dir = Path(directory)
            result = generator.generate_course(self.course("EE492"), output_dir)
            self.assertEqual(result.status, "generated")
            output_path = output_dir / result.file
            generator.verify_preserved_parts(output_path)
            with zipfile.ZipFile(output_path) as package:
                xml = package.read("word/document.xml")
                settings = package.read("word/settings.xml")
                settings_rels = package.read("word/_rels/settings.xml.rels")
            self.assertNotIn(b"MERGEFIELD", xml)
            self.assertNotIn(b"mailMerge", settings)
            self.assertNotIn(b"mailMergeSource", settings_rels)
            for marker in (
                "Number of weeks: (28)", "Number of days: (196)", "1568 hours",
                "Academic COOP Advisor", "Company Supervisor", "Two Examiners",
                "COOP Student satisfaction survey", "Department Council", "August 2026",
            ):
                self.assertIn(marker.encode("utf-8"), xml)

    def test_generated_docx_resolves_fields_and_preserves_package(self):
        with tempfile.TemporaryDirectory() as directory:
            output_dir = Path(directory)
            result = generator.generate_course(self.course("EE351"), output_dir)
            self.assertEqual(result.status, "generated")
            output_path = output_dir / result.file
            generator.verify_preserved_parts(output_path)
            with zipfile.ZipFile(output_path) as package:
                xml = package.read("word/document.xml")
            self.assertNotIn(b"MERGEFIELD", xml)
            self.assertIn("Communication Systems".encode("utf-8"), xml)

    def test_elective_checkbox_is_selected(self):
        values, _, _ = generator.validate_and_build_values(self.course("EE414"))
        with zipfile.ZipFile(generator.TEMPLATE_PATH) as package:
            xml = generator.patch_document_xml(
                package.read("word/document.xml"), values, "Elective"
            )
        root = etree.fromstring(xml)
        controls = root.xpath(".//w:sdt[w:sdtPr/w14:checkbox]", namespaces=generator.NS)
        states = {}
        for control in controls:
            paragraph = control.getparent()
            label_text = "".join(paragraph.xpath(".//w:t/text()", namespaces=generator.NS))
            for label in ("Required", "Elective"):
                if label in label_text:
                    states[label] = control.xpath(
                        "string(w:sdtPr/w14:checkbox/w14:checked/@w14:val)",
                        namespaces=generator.NS,
                    )
        self.assertEqual(states, {"Required": "0", "Elective": "1"})


if __name__ == "__main__":
    unittest.main()
