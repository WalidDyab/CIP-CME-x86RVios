"""Convert the approved EE standards workbook to the static portal inventory.

Run from the repository root: python -B scripts/generate_ee_standards.py
Only the two course-matrix sheets supply browser content. Master sheets are
cross-checked to catch missing or accidentally added standards.
"""
import json
from pathlib import Path
import re
from zipfile import ZipFile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/source/standards/CIP_Standards_IEEE_ITU_R_ETSI_3GPP_with_Access.xlsx'
OUTPUT = ROOT / 'data/ee-standards.json'
MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
NS = {'m': MAIN}


def sheets_from_xlsx(path):
    with ZipFile(path) as archive:
        strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            root = ET.fromstring(archive.read('xl/sharedStrings.xml'))
            strings = [''.join(t.text or '' for t in item.findall('.//m:t', NS))
                       for item in root.findall(f'{{{MAIN}}}si')]
        book = ET.fromstring(archive.read('xl/workbook.xml'))
        rels = ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))
        targets = {item.attrib['Id']: item.attrib['Target'].lstrip('/') for item in rels}
        result = {}
        for sheet in book.findall('m:sheets/m:sheet', NS):
            target = targets[sheet.attrib[f'{{{REL}}}id']]
            if not target.startswith('xl/'):
                target = 'xl/' + target
            root = ET.fromstring(archive.read(target))
            rows = []
            for row in root.findall('.//m:sheetData/m:row', NS):
                values = {'_row': int(row.attrib['r'])}
                for cell in row.findall('m:c', NS):
                    column = re.match(r'[A-Z]+', cell.attrib['r']).group()
                    value = cell.find('m:v', NS)
                    inline = cell.find('m:is', NS)
                    text = value.text if value is not None else ''
                    if cell.attrib.get('t') == 's' and text:
                        text = strings[int(text)]
                    elif inline is not None:
                        text = ''.join(t.text or '' for t in inline.findall('.//m:t', NS))
                    values[column] = text or ''
                rows.append(values)
            result[sheet.attrib['name']] = rows
        return result


def main():
    sheets = sheets_from_xlsx(SOURCE)
    standards = {}

    def add(organization, identifier, title, course_code, course_title, priority,
            teaching_use, access_type, status, official_url, get_url, source_group):
        assert organization in {'IEEE', 'ITU-R', 'ETSI', '3GPP'}
        assert priority in {'Core', 'Useful', 'Advanced'}
        assert access_type == 'Subscription / purchase' or access_type.startswith('Free')
        assert official_url.startswith('https://')
        assert not get_url or get_url.startswith('https://')
        key = (organization, identifier)
        metadata = {'organization': organization, 'identifier': identifier,
                    'title': title, 'accessType': access_type, 'status': status,
                    'officialUrl': official_url, 'getUrl': get_url,
                    'sourceGroup': source_group}
        mapping = {'courseCode': course_code, 'courseTitle': course_title,
                   'priority': priority, 'teachingUse': teaching_use}
        if key not in standards:
            standards[key] = {**metadata, 'courses': []}
        else:
            assert all(standards[key][field] == value for field, value in metadata.items()), key
        assert not any(m['courseCode'] == course_code for m in standards[key]['courses']), key
        standards[key]['courses'].append(mapping)

    for row in sheets['Course Matrix']:
        if row['_row'] < 5 or not row.get('A'):
            continue
        add('IEEE', row['D'], row['E'], row['A'], row['B'], row['C'],
            row['F'], row['G'], row['H'], row['L'], row.get('M', ''), 'IEEE')
    for row in sheets['ITU ETSI 3GPP Matrix']:
        if row['_row'] < 5 or not row.get('A'):
            continue
        add(row['C'], row['E'], row['F'], row['A'], row['B'], row['D'],
            row['G'], row['H'], row['I'], row['K'], '', 'Telecom')

    ieee_master = {('IEEE', row['A']) for row in sheets['Standards Master']
                   if row['_row'] >= 5 and row.get('A')}
    telecom_master = {(row['A'], row['B']) for row in sheets['ITU ETSI 3GPP Master']
                      if row['_row'] >= 5 and row.get('A')}
    assert set(standards) == ieee_master | telecom_master, (
        f'Matrix only: {set(standards) - ieee_master - telecom_master}; '
        f'Master only: {(ieee_master | telecom_master) - set(standards)}')
    # Preserve approved codes maintained directly in the canonical inventory.
    # The workbook remains the source for the IEEE/telecom course matrices only.
    if OUTPUT.exists():
        current = json.loads(OUTPUT.read_text(encoding='utf-8'))
        for item in current['standards']:
            if item.get('sourceGroup') != 'Professional ethics':
                continue
            key = (item['organization'], item['identifier'])
            assert key not in standards, key
            standards[key] = item
    output = {'sourceWorkbook': SOURCE.relative_to(ROOT).as_posix(),
              'standards': list(standards.values())}
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"Wrote {len(standards)} standards, "
          f"{sum(len(item['courses']) for item in standards.values())} mappings to {OUTPUT}")


if __name__ == '__main__':
    main()
