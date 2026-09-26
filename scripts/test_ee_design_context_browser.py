"""Exercise the static stakeholder and design-context page in Edge.

Run: .venv/Scripts/python.exe -B scripts/test_ee_design_context_browser.py
"""
from functools import partial
from http.server import ThreadingHTTPServer
import json
from threading import Thread

from playwright.sync_api import sync_playwright
from smoke_runtime_compatibility import Handler, ROOT


def main():
    data = json.loads((ROOT / 'data/ee-design-context.json').read_text(encoding='utf-8'))
    standards = json.loads((ROOT / 'data/ee-standards.json').read_text(encoding='utf-8'))['standards']
    valid = {(item['organization'] + '|' + item['identifier'], mapping['courseCode'])
             for item in standards for mapping in item['courses']}
    assert len(data['courses']) == 14
    assert all((ref, course['code']) in valid for course in data['courses']
               for factor in course['factors'] for ref in factor['standards'])
    assert all(person['why'] for course in data['courses'] for person in course['stakeholders'])
    assert all(factor['example'] and factor['teachingIdea'] and
               factor['assessmentPrompt'].startswith('You may ask students to')
               for course in data['courses'] for factor in course['factors'])
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
                page.goto(origin + '/undergraduate-ee/stakeholders-design-context.html?course=EE%20490')
                page.locator('.context-guide-factor').first.wait_for()
                assert page.locator('#contextCourse').input_value() == 'EE 490'
                assert page.locator('.context-guide-factor').count() == 9
                assert page.locator('.context-guide-person').count() == 9
                assert page.locator('#contextContent :is(input, select, textarea)').count() == 0
                assert page.locator('#contextCustomize').is_visible()
                assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), width
                assert page.locator('.context-standard-links a').evaluate_all('links => links.every(link => link.target === "_blank" && link.rel.includes("noopener") && link.rel.includes("noreferrer"))')
                for course in data['courses']:
                    page.locator('#contextCourse').select_option(course['code'])
                    assert page.locator('.context-guide-person').count() == len(course['stakeholders'])
                    assert page.locator('.context-guide-factor').count() == len(course['factors'])
                    assert page.locator('.context-standard-links a').count() == sum(len(f['standards']) for f in course['factors'])
                    assert page.locator('.context-guide-label', has_text='How to teach it').count() == len(course['factors'])
                    assert page.locator('.context-guide-label', has_text='How to assess it').count() == len(course['factors'])
                    assert page.locator('#contextContent :is(input, select, textarea)').count() == 0
                    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), (width, course['code'])
                    if course['code'] == 'EE 201':
                        guide = page.locator('#contextContent').inner_text()
                        assert 'Two voltmeters' in guide and 'cheaper but less repeatable meter' in guide
                        assert 'Social' in page.locator('.context-other-concepts').inner_text()
                        assert 'Socioeconomic' in page.locator('.context-other-concepts').inner_text()
                    if course['code'] == 'EE 351':
                        guide = page.locator('#contextContent').inner_text()
                        assert 'frequency allocation cannot automatically be deployed unchanged' in guide
                        assert 'digital exclusion' in guide and 'rural and urban groups' in guide
                    if course['code'] == 'EE 403':
                        guide = page.locator('#contextContent').inner_text()
                        assert 'clinic loses power' in guide and 'urban and a remote community' in guide
                    if course['code'] == 'EE 490':
                        guide = page.locator('#contextContent').inner_text()
                        assert 'Stakeholder → Need / Concern → Contextual Factor' in guide
                        assert 'at least four stakeholders' in guide
                page.evaluate('window.__printCalled = false; window.print = () => { window.__printCalled = true; }')
                page.locator('#contextPrint').click()
                normal_report = page.locator('#contextPrintReport').inner_text()
                assert page.evaluate('window.__printCalled')
                assert 'Teaching and Assessment Guide' in normal_report
                assert 'You may ask students to' in normal_report
                assert 'Instructor customization' not in normal_report
                page.locator('#contextCourse').select_option('EE 490')
                page.locator('#contextCustomize').click()
                assert page.locator('.context-factor-card').count() == 9
                assert page.locator('[data-role="factorStatus"]').first.input_value() == ''
                page.locator('[data-role="stakeholderStatus"]').first.select_option('Relevant')
                page.locator('[data-role="stakeholderStatus"]').nth(1).select_option('Not Applicable')
                page.locator('[data-role="stakeholderNeed"]').first.fill('Confirm sponsor acceptance criteria')
                page.locator('[data-role="factorStatus"]').first.select_option('Relevant')
                page.locator('[data-role="factorStatus"]').nth(1).select_option('Not Applicable')
                page.locator('[data-role="factorNote"]').first.fill('Set a project-specific exposure limit')
                page.locator('[data-role="factorExtraConsideration"]').first.fill('Battery chemistry during charging')
                page.locator('[data-role="factorTeachingIdea"]').first.fill('Compare two charging designs')
                page.locator('[data-role="factorAssessmentPrompt"]').first.fill('Explain which charging design better protects a user')
                page.locator('#customStakeholderName').fill('Community clinic')
                page.locator('#customStakeholderNeed').fill('Dependable service')
                page.locator('#contextAddStakeholder button').click()
                assert page.locator('.context-stakeholder').count() == 10
                page.locator('[data-role="stakeholderStatus"]').last.select_option('Possibly Relevant')
                page.locator('#contextAddAnalysis').click()
                page.locator('[data-role="analysisStakeholder"]').fill('Community clinic')
                page.locator('[data-role="analysisNeed"]').fill('Dependable service')
                page.locator('[data-role="analysisFactor"]').select_option('Safety')
                page.locator('[data-role="analysisImplication"]').fill('Fail safely')
                page.locator('[data-role="analysisRequirement"]').fill('Enter a safe state after a fault')
                page.locator('[data-role="analysisStandard"]').select_option('IEEE|29148-2018')
                page.locator('[data-role="analysisEvidence"]').fill('Fault injection test')
                page.locator('#contextNotes').fill('Review with sponsor')
                page.locator('#contextCourse').select_option('EE 351')
                page.locator('#contextCourse').select_option('EE 490')
                assert page.locator('#contextContent :is(input, select, textarea)').count() == 0
                assert 'A wearable prototype uses a battery' in page.locator('#contextContent').inner_text()
                page.locator('#contextCustomize').click()
                assert page.locator('[data-role="stakeholderStatus"]').first.input_value() == 'Relevant'
                assert page.locator('[data-role="stakeholderStatus"]').nth(1).input_value() == 'Not Applicable'
                assert page.locator('[data-role="factorNote"]').first.input_value() == 'Set a project-specific exposure limit'
                assert page.locator('[data-role="factorTeachingIdea"]').first.input_value() == 'Compare two charging designs'
                assert page.locator('[data-role="analysisStandard"]').input_value() == 'IEEE|29148-2018'
                page.locator('#contextPrint').click()
                assert page.evaluate('window.__printCalled')
                report = page.locator('#contextPrintReport').inner_text()
                for phrase in ('Customized Course Analysis', 'EE 490', 'Community clinic', 'Fail safely',
                               'Enter a safe state after a fault', 'IEEE 29148-2018', 'Fault injection test',
                               'Review with sponsor', 'Battery chemistry during charging',
                               'Compare two charging designs', 'Explain which charging design better protects a user'):
                    assert phrase in report, phrase
                assert 'Not Applicable' in report
                assert 'End users — Not Applicable' not in report
                page.emulate_media(media='print')
                assert page.locator('#contextPrintReport').is_visible()
                assert not page.locator('#contextContent').is_visible()
                page.emulate_media(media='screen')
                page.locator('[data-remove-stakeholder]').click()
                assert page.locator('.context-stakeholder').count() == 9
                page.close()
                print(f'PASS design context at {width}px')

            page = browser.new_page()
            page.goto(origin + '/undergraduate-ee/program-overview.html')
            names = page.locator('section.card > h2').all_text_contents()
            start = names.index('Textbooks & References')
            assert names[start:start + 3] == ['Textbooks & References', 'Standards & Codes', 'Stakeholders & Design Context']
            page.goto(origin + '/undergraduate-ee/course-dashboard.html?course=EE%20351')
            link = page.locator('a[href="stakeholders-design-context.html?course=EE%20351"]')
            link.wait_for()
            page.goto(origin + '/undergraduate-ee/stakeholders-design-context.html?course=EE%20351')
            page.locator('.context-guide-factor').first.wait_for()
            assert page.locator('#contextCourse').input_value() == 'EE 351'
            browser.close()
        assert not errors, errors
        print('PASS navigation, deep links, data references, editing, and print view')
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
