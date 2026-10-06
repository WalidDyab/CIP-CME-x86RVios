"""Browser + DOCX checks for the Required Textbooks (Library order) Word form.

Run: python -B scripts/test_textbook_order_docx.py
Drives the Program Overview dialog in a real browser, downloads the generated .docx and
inspects it against the official template and the live curriculum data.
"""
from functools import partial
from hashlib import sha256
from http.server import ThreadingHTTPServer
import json
import os
import shutil
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
import zipfile

from lxml import etree
from playwright.sync_api import sync_playwright
from smoke_runtime_compatibility import Handler, ROOT

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
W14 = '{http://schemas.microsoft.com/office/word/2010/wordml}'
TEMPLATE = ROOT / 'templates/EE-Required-Textbooks-Template.docx'
DATA = ROOT / 'data/ee_curriculum.json'
ESTIMATES = json.loads((ROOT / 'data/textbook_order_estimates.json').read_text(encoding='utf-8'))['quantities']


def cell_text(cell):
    return ''.join(t.text or '' for t in cell.iter(W + 't')).strip()


def table_rows(table):
    return table.findall(W + 'tr')


def main():
    data_hash = sha256(DATA.read_bytes()).hexdigest()
    courses = json.loads(DATA.read_text(encoding='utf-8'))['curriculum']['courses']
    expected = [c for c in courses if [t for t in (c.get('textbooks') or []) if str(t).strip()]]
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    origin = f'http://127.0.0.1:{server.server_port}'
    errors = []
    try:
        with TemporaryDirectory() as tmp, sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel='msedge', headless=True)
            page = browser.new_page(accept_downloads=True, viewport={'width': 1400, 'height': 900})
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
            page.on('response', lambda r: errors.append(f'{r.status} {r.url}') if r.status >= 400 else None)
            page.goto(origin + '/undergraduate-ee/program-overview.html')
            page.locator('#viewTextbookList').wait_for()
            assert page.locator('#generateTextbookList').is_visible()
            page.locator('dialog[aria-labelledby="textbookOrderTitle-required"]').wait_for(state='attached')
            page.locator('#generateRequiredTextbooks').click()
            dialog = page.locator('dialog[aria-labelledby="textbookOrderTitle-required"]')
            assert dialog.is_visible()
            rows = dialog.locator('tbody tr')
            assert rows.count() == len(expected), (rows.count(), len(expected))
            row322 = dialog.locator('tbody tr', has_text='EE 322')
            assert row322.locator('[data-field="edition"]').input_value() == 'RISC-V Edition'

            # Dialog validation: a bad quantity blocks generation.
            dialog.locator('[data-header="term"]').fill('261')
            # Quantities are pre-filled from the Term 241 estimates where a record exists, blank otherwise.
            for index, course in enumerate(expected):
                assert rows.nth(index).locator('[data-field="quantity"]').input_value() == str(ESTIMATES.get(course['course_code'], ''))
            rows.nth(0).locator('[data-field="quantity"]').fill('0')
            dialog.locator('[data-tbo-generate]').click()
            page.wait_for_function("document.querySelector('dialog[aria-labelledby=\"textbookOrderTitle-required\"] .tbo-status').textContent.includes('positive whole number')")
            # Access Code Duration is only available when Access Code = Yes.
            duration = rows.nth(0).locator('[data-field="accessDuration"]')
            assert duration.is_disabled()
            rows.nth(0).locator('[data-field="accessCode"]').select_option('Yes')
            assert duration.is_enabled()
            assert duration.locator('option').all_inner_texts() == ['-', '12 Months', '18 Months', '24 Months']
            duration.select_option('18')
            rows.nth(0).locator('[data-field="accessCode"]').select_option('No')
            assert duration.is_disabled() and duration.input_value() == ''
            rows.nth(0).locator('[data-field="accessCode"]').select_option('Yes')
            duration.select_option('24')
            rows.nth(0).locator('[data-field="quantity"]').fill('35')
            rows.nth(1).locator('[data-field="quantity"]').fill('20')
            rows.nth(1).locator('[data-field="accessCode"]').select_option('No')
            dialog.locator('[data-header="campus"]').select_option('Men')
            dialog.locator('[data-header="semester"]').fill('First')
            with page.expect_download() as download:
                dialog.locator('[data-tbo-generate]').click()
            out = Path(tmp) / download.value.suggested_filename
            download.value.save_as(out)
            assert out.name == 'EE_Required_Textbooks_261.docx', out.name

            # The existing Textbooks & References viewer still works.
            page.keyboard.press('Escape')
            page.locator('#viewTextbookList').click()
            assert page.locator('#programReferenceDialog').is_visible()
            page.keyboard.press('Escape')
            browser.close()

            if os.environ.get('TEXTBOOK_SAMPLE_DIR'):
                shutil.copy(out, Path(os.environ['TEXTBOOK_SAMPLE_DIR']) / out.name)
            with zipfile.ZipFile(out) as generated, zipfile.ZipFile(TEMPLATE) as template:
                assert generated.testzip() is None
                assert sorted(n for n in generated.namelist() if not n.endswith('/')) == sorted(n for n in template.namelist() if not n.endswith('/'))
                for name in template.namelist():
                    if name != 'word/document.xml':
                        assert generated.read(name) == template.read(name), f'{name} must be untouched'
                xml = generated.read('word/document.xml')
                root = etree.fromstring(xml)
                template_root = etree.fromstring(template.read('word/document.xml'))
            assert b'MERGEFIELD' not in xml
            tables = root.findall('.//' + W + 'tbl')
            assert len(tables) == 2, 'textbook table + signature table'
            rows_xml = table_rows(tables[0])
            texts = [[cell_text(c) for c in r.findall(W + 'tc')] for r in rows_xml]
            header = {r[0].split('[')[0].strip(): r[1] for r in texts[:6]}
            assert header == {'Campus': 'Men', 'College': 'College of Engineering', 'Department': 'Communications and Networks Engineering',
                              'Semester': 'First', 'Term': '261', 'Type of Textbooks': 'Required'}, header
            template_columns = [cell_text(c) for c in table_rows(template_root.findall('.//' + W + 'tbl')[0])[7].findall(W + 'tc')]
            assert texts[7] == template_columns and len(texts[7]) == 10
            body = texts[8:]
            assert [r[0] for r in body] == [c['course_code'] for c in expected]
            assert [r[1] for r in body] == [c['course_title'] for c in expected]
            assert any(c['required_or_elective'] == 'Elective' for c in expected)
            for course in expected:
                citation = ' '.join(str(course['textbooks'][0]).split())
                assert all(citation not in r[2] for r in body), 'a full citation was used as a title'
            plain = ''.join(t.text or '' for t in root.iter(W + 't'))
            for course in courses:
                for reference in course.get('references') or []:
                    assert ' '.join(reference.split())[:40] not in plain, reference[:40]
            assert body[0][7:] == ['35', 'Yes', '24 Months'], body[0]
            assert body[1][7:] == ['20', 'No', 'N/A'], body[1]
            for r in body[2:]:
                assert r[7:] == [str(ESTIMATES.get(r[0], '')), 'No', 'N/A'], r
            assert any(r[7] == '' for r in body), 'courses without a Term 241 record stay blank'
            assert [r[3] for r in body if r[0] == 'EE 322'] == ['RISC-V Edition']
            assert [r[3] for r in body if r[0] == 'EE 231'] == ['5th Global Edition']
            signatures = [cell_text(c) for c in tables[1].iter(W + 'tc')]
            assert any('Chairman of the Department' in s for s in signatures) and any('Dean of the College' in s for s in signatures)
            widths = lambda row: [c.find(W + 'tcPr/' + W + 'tcW').get(W + 'w') for c in row.findall(W + 'tc')]
            assert all(widths(r) == widths(rows_xml[8]) for r in rows_xml[8:])
            ids = [p.get(W14 + 'paraId') for p in root.iter(W + 'p') if p.get(W14 + 'paraId')]
            assert len(ids) == len(set(ids)), 'duplicate paraIds'
            for r in body:
                print(r[:2], '| title:', r[2][:40], '| ed:', r[3], '| author:', r[4][:25], '| isbn:', r[5], '| pub:', r[6])
        assert sha256(DATA.read_bytes()).hexdigest() == data_hash, 'curriculum data changed'
        assert not errors, errors
        print(f'Textbook-order DOCX checks passed ({len(expected)} textbooks).')
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
