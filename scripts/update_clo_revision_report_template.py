"""Embed the approved PSU/CME stationery as the fixed DOCX page background."""

from __future__ import annotations

import tempfile
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "templates" / "CLO-Revision-Report-Template.docx"
BACKGROUND = ROOT / "templates" / "CME-CE-letter-background.png"

HEADER_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
 <w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:pict>
  <v:shape id="CMEStationeryBackground" type="#_x0000_t75"
   style="position:absolute;margin-left:0;margin-top:0;width:595.3pt;height:841.9pt;z-index:-251654144;mso-position-horizontal-relative:page;mso-position-vertical-relative:page"
   o:allowincell="f" filled="f" stroked="f">
   <v:imagedata r:id="rId1" o:title="CME CE letter background"/>
  </v:shape>
 </w:pict></w:r></w:p>
</w:hdr>"""

HEADER_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/CME-CE-letter-background.png"/>
</Relationships>"""

FOOTER_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p/></w:ftr>"""


def update_document_xml(data: bytes) -> bytes:
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    ET.register_namespace("w", ns["w"])
    ET.register_namespace("r", "http://schemas.openxmlformats.org/officeDocument/2006/relationships")
    root = ET.fromstring(data)
    sect = root.find(".//w:sectPr", ns)
    if sect is None:
        raise ValueError("Template is missing section properties")
    margins = sect.find("w:pgMar", ns)
    if margins is None:
        margins = ET.SubElement(sect, f"{{{ns['w']}}}pgMar")
    for key, value in {"top": "2016", "bottom": "1440", "left": "1008", "right": "1008", "header": "0", "footer": "0"}.items():
        margins.set(f"{{{ns['w']}}}{key}", value)
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def update_content_types(data: bytes) -> bytes:
    namespace = "http://schemas.openxmlformats.org/package/2006/content-types"
    ET.register_namespace("", namespace)
    root = ET.fromstring(data)
    if not any(node.get("Extension", "").lower() == "png" for node in root.findall(f"{{{namespace}}}Default")):
        ET.SubElement(root, f"{{{namespace}}}Default", Extension="png", ContentType="image/png")
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)


def main() -> None:
    if not TEMPLATE.exists() or not BACKGROUND.exists():
        raise FileNotFoundError("CLO report template or stationery image is missing")
    replacements = {
        "word/header1.xml": HEADER_XML.encode(),
        "word/_rels/header1.xml.rels": HEADER_RELS.encode(),
        "word/footer1.xml": FOOTER_XML.encode(),
        "word/media/CME-CE-letter-background.png": BACKGROUND.read_bytes(),
    }
    with tempfile.NamedTemporaryFile(suffix=".docx", dir=TEMPLATE.parent, delete=False) as handle:
        temporary = Path(handle.name)
    try:
        with zipfile.ZipFile(TEMPLATE, "r") as source, zipfile.ZipFile(temporary, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as target:
            names = set(source.namelist()) | set(replacements)
            for name in sorted(names):
                if name in replacements:
                    payload = replacements[name]
                elif name == "word/document.xml":
                    payload = update_document_xml(source.read(name))
                elif name == "[Content_Types].xml":
                    payload = update_content_types(source.read(name))
                else:
                    payload = source.read(name)
                info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o600 << 16
                target.writestr(info, payload)
        temporary.replace(TEMPLATE)
    finally:
        temporary.unlink(missing_ok=True)
    print(f"Updated {TEMPLATE.relative_to(ROOT)} with {BACKGROUND.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
