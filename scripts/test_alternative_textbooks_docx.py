"""Browser + DOCX checks for the (draft) Alternative Textbooks Word form.

Run: python -B scripts/test_alternative_textbooks_docx.py
Set ALT_SAMPLE_DIR to also keep a copy of the generated .docx.
"""
from functools import partial
from hashlib import sha256
from http.server import ThreadingHTTPServer
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
import zipfile

from lxml import etree
from playwright.sync_api import sync_playwright
from smoke_runtime_compatibility import Handler, ROOT

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
TEMPLATE = ROOT / 'templates/EE-Alternative-Textbooks-Template.docx'
DATA = ROOT / 'data/ee_curriculum.json'


def cell_text(cell):
    return ''.join(t.text or '' for t in cell.iter(W + 't')).strip()


def main():
    data_hash = sha256(DATA.read_bytes()).hexdigest()
    courses = json.loads(DATA.read_text(encoding='utf-8'))['curriculum']['courses']
    expected = [c for c in courses if [t for t in (c.get('references') or [])[:1] if str(t).strip()]]
    without = [c for c in courses if (c.get('textbooks') or []) and not (c.get('references') or [])]
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
            page.locator('dialog[aria-labelledby="textbookOrderTitle-alternatives"]').wait_for(state='attached')
            assert page.locator('#generateRequiredTextbooks').is_visible()
            page.locator('#generateAlternativeTextbooks').click()
            dialog = page.locator('dialog[aria-labelledby="textbookOrderTitle-alternatives"]')
            assert dialog.is_visible()
            assert 'Alternative Textbooks' in dialog.locator('h2').inner_text()
            assert (len(without) == 0) == (dialog.locator('.tbo-note').count() == 0)
            rows = dialog.locator('tbody tr')
            assert rows.count() == len(expected) and len(expected) >= 1
            # No quantity / access-code columns on the Alternatives form.
            assert dialog.locator('[data-field="quantity"]').count() == 0
            assert [t.lower() for t in dialog.locator('thead th').all_inner_texts()] == ['course', 'textbook title', 'edition', 'author', 'isbn (print)', 'publisher']
            # The Reference 1 citation stays visible for comparison.
            assert 'Reference 1 on record' in rows.nth(0).inner_text()
            # An unedited run is the shareable sheet.
            with page.expect_download() as clean_download:
                dialog.locator('[data-tbo-generate]').click()
            if os.environ.get('ALT_SAMPLE_DIR'):
                clean_download.value.save_as(Path(os.environ['ALT_SAMPLE_DIR']) / clean_download.value.suggested_filename)
            # A bad ISBN blocks generation; editing a cell flows into the document.
            rows.nth(0).locator('[data-field="isbn"]').fill('123')
            dialog.locator('[data-tbo-generate]').click()
            page.wait_for_function("document.querySelector('dialog[aria-labelledby=\"textbookOrderTitle-alternatives\"] .tbo-status').textContent.includes('10 or 13')")
            rows.nth(0).locator('[data-field="isbn"]').fill(((expected[0].get('reference_details') or [{}])[0]).get('isbn_print', ''))
            rows.nth(1).locator('[data-field="edition"]').fill('7th (faculty edit)')
            with page.expect_download() as download:
                dialog.locator('[data-tbo-generate]').click()
            out = Path(tmp) / download.value.suggested_filename
            download.value.save_as(out)
            assert out.name == 'EE_Alternative_Textbooks.docx', out.name
            browser.close()

            with zipfile.ZipFile(out) as generated, zipfile.ZipFile(TEMPLATE) as template:
                assert generated.testzip() is None
                assert sorted(n for n in generated.namelist() if not n.endswith('/')) == sorted(n for n in template.namelist() if not n.endswith('/'))
                for name in template.namelist():
                    if name != 'word/document.xml':
                        assert generated.read(name) == template.read(name), f'{name} must be untouched'
                xml = generated.read('word/document.xml')
                root = etree.fromstring(xml)
                template_root = etree.fromstring(template.read('word/document.xml'))
            tables = root.findall('.//' + W + 'tbl')
            assert len(tables) == 2
            rows_xml = tables[0].findall(W + 'tr')
            texts = [[cell_text(c) for c in r.findall(W + 'tc')] for r in rows_xml]
            assert texts[5] == ['Type of Textbooks', 'Alternatives'], texts[5]
            template_columns = [cell_text(c) for c in template_root.findall('.//' + W + 'tbl')[0].findall(W + 'tr')[7].findall(W + 'tc')]
            assert texts[7] == template_columns and len(texts[7]) == 7
            body = texts[8:]
            assert [r[0] for r in body] == [c['course_code'] for c in expected]
            assert [r[1] for r in body] == [c['course_title'] for c in expected]
            for r in body:
                course = next(c for c in expected if c['course_code'] == r[0])
                edition = '7th (faculty edit)' if r[0] == expected[1]['course_code'] else None
                detail = (course.get('reference_details') or [None])[0]
                if detail:
                    assert r[2:] == [detail['title'], edition or detail['edition'], detail['author'], detail['isbn_print'], detail['publisher']], r
                else:
                    # Unreviewed existing Reference 1: only what the citation itself states is shown.
                    citation = ' '.join(str(course['references'][0]).split())
                    assert r[2] == '' or r[2] in citation, r
            # Only Reference 1 is used: no supporting reference (Reference 2 onwards) appears.
            for course in courses:
                for extra in (course.get('references') or [])[1:]:
                    assert ' '.join(str(extra).split())[:40] not in ''.join(t.text or '' for t in root.iter(W + 't')), extra[:40]
            signatures = [cell_text(c) for c in tables[1].iter(W + 'tc')]
            assert any('Chairman of the Department' in s for s in signatures) and any('Dean of the College' in s for s in signatures)
            print(f'{len(body)} alternatives in', out.name)
        assert sha256(DATA.read_bytes()).hexdigest() == data_hash, 'curriculum data changed'
        assert not errors, errors
        print('Alternative-textbooks DOCX checks passed.')
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
