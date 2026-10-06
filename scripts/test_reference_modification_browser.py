"""Browser check: Add/Modify References still works and carries ISBN / Access Code metadata.

Run: python -B scripts/test_reference_modification_browser.py
"""
from functools import partial
from hashlib import sha256
from http.server import ThreadingHTTPServer
from tempfile import TemporaryDirectory
from threading import Thread

from playwright.sync_api import sync_playwright
from smoke_runtime_compatibility import Handler, ROOT

DATA = ROOT / 'data/ee_curriculum.json'


def main():
    data_hash = sha256(DATA.read_bytes()).hexdigest()
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    origin = f'http://127.0.0.1:{server.server_port}'
    errors = []
    try:
        with TemporaryDirectory() as tmp, sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel='msedge', headless=True)
            page = browser.new_page(accept_downloads=True, viewport={'width': 1300, 'height': 900})
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
            page.goto(origin + '/undergraduate-ee/course-dashboard.html?course=EE%20312&layout=full')
            page.locator('#referenceReviewOpen').click()
            assert page.locator('#referenceReviewOverlay').is_visible()
            slots = page.locator('.reference-slot')
            assert slots.count() == 4
            assert [t.strip() for t in page.locator('.reference-slot-head h3').all_inner_texts()] == ['Main Textbook', 'Additional Reference 1', 'Additional Reference 2', 'Additional Reference 3']
            main = slots.nth(0)
            assert main.locator('.reference-operation').locator('option').all_inner_texts() == ['Keep', 'Change', 'Remove']
            main.locator('.reference-operation').select_option('Change')
            field = lambda name: main.locator(f'[data-book-field="{name}"]')
            access, duration = field('accessCode'), field('accessDuration')
            assert duration.is_disabled()
            for name, value in [('authors', 'R. Boylestad'), ('title', 'Electronic Devices'), ('publisher', 'Pearson'), ('year', '2015')]:
                field(name).fill(value)
            page.locator('#referenceJustification').fill('Newer edition.')
            field('isbn').fill('123')
            page.locator('#generateReferenceProposal').click()
            assert 'ISBN must have 10 or 13 digits' in page.locator('#referenceFormError').inner_text()
            field('isbn').fill('9780134746968')
            access.select_option('Yes')
            assert duration.is_enabled()
            assert duration.locator('option').all_inner_texts() == ['N/A', '12 months', '18 months', '24 months']
            page.locator('#generateReferenceProposal').click()
            assert '12, 18, or 24' in page.locator('#referenceFormError').inner_text()
            duration.select_option('12')
            with page.expect_download() as download:
                page.locator('#generateReferenceProposal').click()
            assert download.value.suggested_filename == 'EE312_Reference_Change_Request.pdf'
            access.select_option('No')
            assert duration.is_disabled() and duration.input_value() == ''
            # A migrated course shows its main textbook plus Reference 1 (the alternative) in the existing slots.
            page.goto(origin + '/undergraduate-ee/course-dashboard.html?course=EE%20201&layout=full')
            page.locator('#referenceReviewOpen').click()
            assert page.locator('.reference-slot').count() == 4
            assert 'Introductory Circuit Analysis' in page.locator('.reference-slot').nth(0).inner_text()
            assert 'Fundamentals of Electric Circuits' in page.locator('.reference-slot').nth(1).inner_text()
            browser.close()
        assert sha256(DATA.read_bytes()).hexdigest() == data_hash, 'curriculum data changed'
        assert not errors, errors
        print('Reference modification browser checks passed.')
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
