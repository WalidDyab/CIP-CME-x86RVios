"""Optional browser smoke check. Requires Python Playwright and installed Edge.

Serves only allowlisted source files, enforcing the desktop CSP through HTTP.
Run: python scripts/smoke_runtime_compatibility.py
No generated release is created or replaced. Downloads use a temporary directory.
"""
from functools import partial
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import tempfile
from threading import Thread
from urllib.parse import unquote, urlsplit
import zipfile

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
FILES = set(json.loads((ROOT / 'packaging/desktop-runtime-files.json').read_text(encoding='utf-8')))
CSP = "; ".join(["default-src 'none'", "script-src 'self'", "script-src-attr 'none'",
                 "style-src 'self'", "img-src 'self'", "font-src 'self'", "connect-src 'self'",
                 "object-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-src 'none'",
                 "frame-ancestors 'none'", "worker-src 'none'"])


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        name = unquote(urlsplit(self.path).path).lstrip('/')
        if not name or name.endswith('/'):
            name += 'index.html'
        if name == 'favicon.ico':
            self.send_response(204)
            self.end_headers()
            return
        if name not in FILES:
            self.send_error(404)
            return
        super().do_GET()

    def end_headers(self):
        self.send_header('Content-Security-Policy', CSP)
        super().end_headers()

    def log_message(self, *args):
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--page', action='append', help='Check only this runtime page (repeatable).')
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    origin = f'http://127.0.0.1:{server.server_port}'
    courses = json.loads((ROOT / 'data/ee_curriculum.json').read_text(encoding='utf-8'))['curriculum']['courses']
    msc = json.loads((ROOT / 'data/msc_ee_courses_full.json').read_text(encoding='utf-8'))
    errors = []
    results = []
    try:
        with tempfile.TemporaryDirectory() as temporary, sync_playwright() as p:
            browser = p.chromium.launch(channel='msedge', headless=True)
            context = browser.new_context(accept_downloads=True, viewport={'width': 1440, 'height': 1000})
            # Instrumentation observes violations; it does not relax CSP or replace app code.
            context.add_init_script("window.__cspViolations=[]; document.addEventListener('securitypolicyviolation', e => window.__cspViolations.push({directive:e.effectiveDirective,uri:e.blockedURI}));")
            def route_request(route):
                if route.request.url.startswith(origin + '/'):
                    route.continue_()
                else:
                    errors.append(('external-request', route.request.url))
                    route.abort()
            context.route('**/*', route_request)

            def download(page, selector, kind):
                with page.expect_download() as event:
                    page.locator(selector).click()
                item = event.value
                assert item.failure() is None, item.failure()
                path = Path(temporary) / item.suggested_filename
                item.save_as(path)
                if kind == 'pdf':
                    assert path.read_bytes().startswith(b'%PDF-') and path.stat().st_size > 1000
                elif kind == 'png':
                    assert path.read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
                elif kind == 'docx':
                    with zipfile.ZipFile(path) as archive:
                        assert 'word/document.xml' in archive.namelist()
                results.append({'download': item.suggested_filename, 'bytes': path.stat().st_size})

            for name in sorted(FILES):
                if not name.endswith('.html') or name.startswith('assets/'):
                    continue
                if args.page and name not in args.page:
                    continue
                page = context.new_page()
                page.on('pageerror', lambda error, name=name: errors.append((name, str(error))))
                page.on('response', lambda response, name=name: errors.append((name, response.status, response.url)) if response.status >= 400 else None)
                page.goto(origin + '/' + name)
                page.wait_for_load_state('networkidle')
                assert page.locator('body').inner_text().strip(), name
                if page.locator('#header-placeholder').count():
                    raise AssertionError((name, 'Header failed to load'))
                if name == 'undergraduate-ee/course-dashboard.html':
                    assert page.locator('#courseSelect option').count() == len(courses)
                    page.select_option('#courseSelect', label=page.locator('#courseSelect option').nth(1).inner_text())
                    assert page.locator('#detail .code').first.inner_text()
                    page.select_option('#courseSelect', 'EE 351')
                    page.locator('#printReportBtn').click()
                    download(page, '#printGenerateBtn', 'pdf')
                    download(page, 'button:has-text("Generate NCAAA CS")', 'docx')
                    page.select_option('#courseSelect', 'EE 492')
                    download(page, 'button:has-text("Generate NCAAA CS")', 'docx')
                    page.locator('#cloReviewOpen').click()
                    assert page.locator('#cloReviewOverlay').is_visible()
                    page.locator('#cloReviewClose').click()
                    page.locator('#referenceReviewOpen').click()
                    assert page.locator('#referenceReviewOverlay').is_visible()
                    page.locator('#referenceReviewClose').click()
                elif name == 'msc-ee/course-dashboard.html':
                    assert page.locator('#courseList .course-card').count() == len(msc)
                    page.locator('#printReportBtn').click()
                    download(page, '#printGenerateBtn', 'pdf')
                elif name == 'msc-ee/course-view-v4.html':
                    assert page.locator('#courseList .citem').count() == len(msc)
                    page.locator('#courseList .citem').nth(1).click()
                    assert 'course=' in page.url
                    assert page.locator('#detail .hero .title').inner_text()
                    page.fill('#search', 'EE 542')
                    assert page.locator('#courseList .citem').count() == 1
                elif name == 'msc-ee/program-dashboard.html':
                    assert page.locator('#courseList .course-card').count() == len(msc)
                    page.fill('#search', 'EE 542')
                    assert page.locator('#courseList .course-card').count() == 1
                elif name == 'msc-ee/concentration-dashboard.html':
                    assert page.locator('#groups .course-card').count() == len(msc)
                elif name == 'msc-ee/concentration-view.html':
                    assert page.locator('#trackGrid .track-col').count() == 4
                    assert page.locator('#focusedTags .pw-tag').count() == 3
                elif name == 'msc-ee/unified-advising-view.html':
                    assert page.locator('#trackGrid .track').count() == 4
                elif name == 'msc-ee/index.html':
                    assert page.locator('#stats .stat').count() > 0
                elif name == 'curriculum-vision/nqf-2026-transition.html':
                    nqf = json.loads((ROOT / 'data/nqf_2026_alignment.json').read_text(encoding='utf-8'))
                    assert page.locator('#descriptorRows .descriptor-id').count() == len(nqf['descriptors'])
                    assert page.locator('#matrixBody .descriptor-id').count() == len(nqf['abet_matrix'])
                elif name == 'undergraduate-ee/program-overview.html':
                    download(page, '#generateTextbookList', 'pdf')
                    page.locator('#toggleHeatmapBtn').click()
                    download(page, '#exportPiBtn', 'png')
                    download(page, '#exportSoBtn', 'png')
                    assert page.locator('.ps-bar-seg').count() > 0
                    assert page.locator('.pf-node').count() > 0
                    assert page.locator('.ps-bar-seg').first.evaluate('(e) => e.getBoundingClientRect().width') > 0
                    assert page.locator('.pf-year').first.evaluate('(e) => getComputedStyle(e).gridRowStart') == '1'
                    assert page.locator('.pf-sem').first.evaluate('(e) => getComputedStyle(e).gridRowStart') == '2'
                elif name == 'undergraduate-ee/clo-methods-review.html':
                    assert page.locator('#review tbody tr').count() > 0
                    page.fill('#search', 'EE 351')
                    assert page.locator('#review tbody tr').count() > 0
                elif name == 'undergraduate-ee/teaching-assessment-methods.html':
                    assert page.locator('#assessmentCoursesBody tr').count() > 0
                elif name == 'undergraduate-ee/so-leader-dashboard.html':
                    assert page.locator('#evidence tbody tr').count() > 0
                    page.locator('#soMappingReviewOpen').click()
                    page.fill('#soMappingReviewer', 'Runtime Compatibility Test')
                    download(page, '#generateSOMappingPdf', 'pdf')
                    page.locator('#soMappingReviewClose').click()
                elif name.startswith('curriculum-vision/clo-revision-report-'):
                    if '251-to-261' in name:
                        download(page, '#generateCloReport', 'docx')
                    # Verify native print events and the existing print stylesheet in headless Chromium.
                    page.evaluate("window.__printed=false; window.addEventListener('beforeprint', () => window.__printed=true)")
                    button = '#printReport' if '251-to-261' in name else '#printReportBtn'
                    page.locator(button).click()
                    assert page.evaluate('window.__printed')
                    assert page.pdf().startswith(b'%PDF-')
                violations = page.evaluate('window.__cspViolations')
                assert not violations, (name, violations)
                # Only explicitly reviewed numeric CSSOM properties may serialize as style attributes.
                inline = page.locator('[style]').evaluate_all('(nodes) => nodes.map(e => ({class:e.className,style:e.getAttribute("style")}))')
                if name != 'undergraduate-ee/program-overview.html':
                    assert not inline, (name, inline)
                results.append({'page': name, 'cspViolations': len(violations), 'numericCssomElements': len(inline)})
                print('PASS', name, flush=True)
                page.close()
            browser.close()
        assert not errors, errors
        print(json.dumps(results, indent=2))
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
