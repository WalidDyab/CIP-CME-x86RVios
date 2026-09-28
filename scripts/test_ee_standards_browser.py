"""Browser checks for the static BSc EE standards page.

Run: .venv/Scripts/python.exe -B scripts/test_ee_standards_browser.py
"""
from functools import partial
from http.server import ThreadingHTTPServer
import json
from threading import Thread

from playwright.sync_api import sync_playwright
from smoke_runtime_compatibility import Handler, ROOT


def main():
    standards = json.loads((ROOT / 'data/ee-standards.json').read_text(encoding='utf-8'))['standards']
    mappings = [(standard, mapping) for standard in standards for mapping in standard['courses']]
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    origin = f'http://127.0.0.1:{server.server_port}'
    errors = []
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel='msedge', headless=True)
            for width in (1280, 768, 390, 360):
                page = browser.new_page(viewport={'width': width, 'height': 900})
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
                page.on('response', lambda response: errors.append(f'{response.status} {response.url}') if response.status >= 400 else None)
                page.goto(origin + '/undergraduate-ee/standards-and-codes.html')
                page.locator('.standard-card').first.wait_for()
                assert page.locator('.standard-card').count() == len(mappings)
                assert page.locator('.standards-course').count() == len({m['courseCode'] for _, m in mappings})
                assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), width
                assert page.locator('.standard-links .btn').evaluate_all('links => links.every(link => link.target === "_blank" && link.rel.includes("noopener") && link.rel.includes("noreferrer"))')
                displayed = page.locator('.standards-course').evaluate_all('sections => sections.map(section => ({code: section.querySelector(".code").textContent, cards: [...section.querySelectorAll(".standard-card")].map(card => ({id: card.querySelector(".standard-id").textContent, priority: card.querySelector(".standard-priority").textContent, title: card.querySelector("h4").textContent, url: card.querySelector(".standard-links .btn").href, access: card.querySelector(".standard-access").textContent}))}))')
                by_key = {(mapping['courseCode'], standard['identifier']): (standard, mapping) for standard, mapping in mappings}
                for section in displayed:
                    priorities = [card['priority'] for card in section['cards']]
                    assert priorities == sorted(priorities, key={'Core': 0, 'Useful': 1, 'Advanced': 2}.get)
                    for card in section['cards']:
                        standard, mapping = by_key[(section['code'], card['id'])]
                        assert (card['title'], card['url'], card['access'], card['priority']) == (
                            standard['title'], standard['officialUrl'], standard['accessType'], mapping['priority'])
                page.locator('#standardsAccess').select_option('free')
                assert page.locator('.standard-card').count() == sum(s['accessType'].startswith('Free') for s, _ in mappings)
                page.locator('#standardsAccess').select_option('subscription')
                assert page.locator('.standard-card').count() == sum(s['accessType'] == 'Subscription / purchase' for s, _ in mappings)
                page.locator('#standardsAccess').select_option('')
                page.locator('#standardsCourse').select_option('EE 351')
                assert page.locator('.standard-card').count() == 32
                assert page.locator('.standards-course').count() == 1
                page.locator('#standardsOrganization').select_option('3GPP')
                assert page.locator('.standard-card').count() == sum(s['organization'] == '3GPP' and m['courseCode'] == 'EE 351' for s, m in mappings)
                page.locator('#standardsPriority').select_option('Advanced')
                assert page.locator('.standard-card').count() == sum(s['organization'] == '3GPP' and m['courseCode'] == 'EE 351' and m['priority'] == 'Advanced' for s, m in mappings)
                page.locator('#standardsAccess').select_option('free')
                assert page.locator('.standard-card').count() == sum(s['organization'] == '3GPP' and m['courseCode'] == 'EE 351' and m['priority'] == 'Advanced' and s['accessType'].startswith('Free') for s, m in mappings)
                page.locator('#standardsSearch').fill('TS 36.211')
                assert page.locator('.standard-card').count() == 1
                assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), width
                page.goto(origin + '/undergraduate-ee/index.html')
                main = page.locator('.page-section[aria-labelledby="explore-title"] > .explore-grid > .explore-card')
                support = page.locator('.support-grid > .support-card')
                assert main.locator('h3').all_text_contents() == [
                    'Program Overview', 'Course Dashboard', 'SO Leader Dashboard', 'Teaching & Assessment']
                assert support.locator('h3').all_text_contents() == [
                    'Standards & Codes', 'Stakeholders & Design Context']
                assert main.count() == 4 and support.count() == 2
                assert all(page.request.get(origin + '/undergraduate-ee/' + href).ok for href in
                           main.evaluate_all('cards => cards.map(card => card.getAttribute("href"))') +
                           support.evaluate_all('cards => cards.map(card => card.getAttribute("href"))'))
                main_boxes = main.evaluate_all('cards => cards.map(card => card.getBoundingClientRect().toJSON())')
                support_boxes = support.evaluate_all('cards => cards.map(card => card.getBoundingClientRect().toJSON())')
                if width == 1280:
                    assert max(box['top'] for box in main_boxes) - min(box['top'] for box in main_boxes) < 2
                if width > 620:
                    assert abs(support_boxes[0]['top'] - support_boxes[1]['top']) < 2
                else:
                    assert support_boxes[1]['top'] > support_boxes[0]['bottom']
                assert support_boxes[0]['top'] > max(box['bottom'] for box in main_boxes)
                assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), width
                page.close()
                print(f'PASS standards page at {width}px')

            page = browser.new_page()
            page.goto(origin + '/undergraduate-ee/standards-and-codes.html?course=EE%20351')
            page.locator('.standard-card').first.wait_for()
            assert page.locator('#standardsCourse').input_value() == 'EE 351'
            assert page.locator('.standard-card').count() == 32
            page.goto(origin + '/undergraduate-ee/program-overview.html')
            assert page.locator('section:has(> h2:text-is("Textbooks & References")) + section > h2').text_content() == 'Standards & Codes'
            assert page.locator('section:has(> h2:text-is("Standards & Codes")) a').get_attribute('href') == 'standards-and-codes.html'
            page.goto(origin + '/undergraduate-ee/course-dashboard.html?course=EE%20351')
            link = page.locator('.course-standards-link')
            link.wait_for()
            assert link.get_attribute('href') == 'standards-and-codes.html?course=EE%20351'
            assert '32 relevant standards' in link.locator('xpath=..').text_content()
            page.goto(origin + '/undergraduate-ee/teaching-assessment-methods.html')
            page.locator('.ethics-card h3').first.wait_for()
            assert page.locator('.ethics-card h3').all_text_contents() == [
                'IEEE Code of Ethics', 'Engineer’s Charter (ميثاق المهندس)']
            assert 'SO4 learning activities' in page.locator('.ethics-note').inner_text()
            for standard in standards[-2:]:
                card = page.locator(f'.ethics-card[data-standard-key="{standard["organization"]}|{standard["identifier"]}"]')
                assert card.locator('.ethics-org').inner_text() == standard['issuingOrganization']
                assert card.locator('.ethics-actions a').nth(0).get_attribute('href') == standard['documentUrl']
                assert card.locator('.ethics-actions a').nth(1).get_attribute('href') == standard['officialUrl']
                assert page.request.get(origin + '/undergraduate-ee/' + standard['documentUrl']).ok
                page.goto(origin + '/undergraduate-ee/' + card.locator('.ethics-actions a').nth(2).get_attribute('href'))
                page.locator('.standard-card').first.wait_for()
                assert page.locator('.standard-card').count() == len(standard['courses'])
                assert page.locator('#standardsOrganization').input_value() == standard['organization']
                page.goto(origin + '/undergraduate-ee/teaching-assessment-methods.html')
                page.locator('.ethics-card h3').first.wait_for()
            browser.close()
        assert not errors, errors
        print('PASS links, source data, filters, priorities, navigation, and browser errors')
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
