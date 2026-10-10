"""Main-sheet field mapping and QAC review issues for the QAC SO workbooks.

Used by generate_qac_rubrics.py. Every cell reference and every quoted text below is
checked against the stored workbooks by scripts/test_qac_rubrics.py; nothing is guessed:
where the template's intent is unclear the field carries an issue id instead.
"""
from __future__ import annotations

import hashlib

from generate_qac_rubrics import SCHEMA_VERSION, TEMPLATES, template_path
from qac_xlsx import Workbook

CURRICULUM_FILE = 'data/ee_curriculum.json'
ASSESSMENT_FILE = 'data/ee-assessment.json'
COURSE = 'curriculum.courses[course_code == <course>]'

# Text that differs per SO workbook on the Main sheet (read from the files, asserted by tests).
CONTEXT_FIELD = {
    'SO1': ('complex_problem_characteristics', 'Complex engineering problem characteristic(s) considered in the assessment'),
    'SO2': ('design_factors', 'Design factors actually addressed by students in the project(s)'),
    'SO3': ('audience', 'Audience of the communication assessment'),
    'SO4': ('so4_considerations', 'Global/societal/economic/environmental contexts considered in the assessment'),
}


def sha(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def content_info(sheet, anchor):
    value = sheet.value(anchor)
    formula = sheet.formula(anchor)
    if formula:
        return {'kind': 'formula', 'formula': formula}
    if value is None:
        return {'kind': 'empty'}
    text = value if isinstance(value, str) else str(value)
    if isinstance(value, str) and (value.lstrip().startswith('[') or 'Add the CLO' in value
                                   or value.startswith('List all SO4 assessment instruments')):
        kind = 'placeholder_guidance'
    else:
        kind = 'prefilled'
    return {'kind': kind, 'text_sha256': sha(text), 'preview': text[:80]}


def field(sheet, field_id, description, anchor, entry_mode, requirement, editable, *, label_cell=None,
          cip_source=None, flags=(), notes=None, data_validation=None, rng=None, rules=()):
    merged = sheet.merged_range_for(anchor)
    return {
        'field_id': field_id,
        'description': description,
        'label': None if label_cell is None else {'cell': label_cell, 'text': sheet.value(label_cell)},
        'target': {'sheet': 'Main', 'anchor': anchor, 'range': rng or merged or anchor, 'merged': bool(merged)},
        'entry_mode': entry_mode,
        'requirement': requirement,
        'editable': editable,
        'current_content': content_info(sheet, anchor),
        'cip_source': cip_source,
        'data_validation': data_validation,
        'flags': list(flags),
        'requirement_rules': list(rules),
        'notes': notes,
    }


def dv_for(sheet, anchor):
    from qac_xlsx import split_cell, split_range
    col, row = split_cell(anchor)
    for dv in sheet.data_validations:
        for part in (dv['sqref'] or '').split():
            c1, r1, c2, r2 = split_range(part)
            if c1 <= col <= c2 and r1 <= row <= r2:
                return {'type': dv['type'], 'source': dv['formula1'], 'sqref': dv['sqref'], 'extension_element': dv['extension']}
    return None


DECISIONS = {
    'D1': {
        'title': 'Maximum assessment activities',
        'requirement': 'A course preparation session holds at most five assessment activities in total (not per SO). One activity may cover several CLOs, SOs and PIs.',
        'status': 'requirement_for_later_phases',
        'consequence': 'An activity that addresses several SOs appears in the workbook of each SO it covers, so up to five activities may share the single assessment row (A10, C10, F10) of one workbook; fit within the 409.5 pt row must be verified when the exporter is built.',
    },
    'D2': {
        'title': 'Main row 6 cleared; one SO per workbook',
        'requirement': 'Each QAC workbook is dedicated to one Student Outcome. The pre-filled row 6 (SO4, its PI list and CLO text, and the B6 lookup formula) is an error. The future exporter clears the entire row 6 of Main in every generated copy, for all four SO templates.',
        'status': 'requirement_for_later_phases',
        'generated_copy_rule': 'After verifying the worksheet structure (see cleared_rows in each template), remove the contents and formulas of every cell in row 6, including the B6 lookup, in the copy only. Never populate A6. Keep merged ranges, styles, validation, comments, all other cells and all other worksheets; drop the B6 entry from calcChain.xml if present. A generated workbook contains information only for its own SO and the selected, validly mapped PIs. The stored templates stay unchanged.',
        'supersedes': 'Earlier D2 text (clear or replace A6, F6, J6 and keep B6); QAC-20 is resolved by this decision.',
    },
    'D3': {
        'title': 'Mapped PI selection',
        'requirement': "Mapped PIs on a generated Main sheet contain only PIs explicitly selected by the instructor that are validly mapped to the selected CLOs and to the workbook's SO. Never list all PIs of an SO automatically.",
        'status': 'requirement_for_later_phases',
        'derivation': [
            'For each assessment activity, take the instructor-selected PIs.',
            "Keep a PI only if its SO is the workbook's SO (abet.performance_indicators[PI].so) and it is in pi_codes of at least one CLO selected for that activity whose mapped_sos includes that SO.",
            'Across activities combine the kept PIs without duplicates (ordered by PI id).',
            'Preserve assessment-to-PI traceability in the preparation record (PI -> activity ids) and in the per-PI justification text; the Main cell shows each PI once.',
        ],
    },
    'D4': {
        'title': 'PI31 authoritative wording',
        'requirement': "The exact PI31 wording of the visible QAC SO3 rubric is CIP's authoritative PI31 statement.",
        'status': 'applied',
        'original': 'Communicate relevant, accurate, and sufficient engineering information.',
        'replacement': 'Communicate engineering information using appropriate technical content.',
        'location': 'data/ee_curriculum.json -> abet.performance_indicators.PI31.statement',
        'note': 'Rubric label text plus the final period (owner-specified). Dependent guidance updated: data/ee_alignment_evidence.json -> pi_evidence_profiles.PI31 (demonstrates, relationship, rubric_criteria, attainment_methodology). Approved mappings untouched.',
    },
}


def build_mapping(curriculum):
    templates = []
    for spec in TEMPLATES:
        so = spec['so']
        with Workbook(template_path(spec)) as wb:
            s = wb.sheet('Main')
            ctx_id, ctx_desc = CONTEXT_FIELD[so]
            course_src = lambda attr: {'file': CURRICULUM_FILE, 'path': COURSE + '.' + attr, 'transform': None}
            fields = [
                field(s, 'course_name', 'Course title', 'C1', 'cip_derived', 'mandatory', True, label_cell='A1',
                      cip_source=course_src('course_title')),
                field(s, 'course_code', 'Course code', 'C2', 'cip_derived', 'mandatory', True, label_cell='A2',
                      cip_source=course_src('course_code'), flags=['QAC-18'],
                      notes='CIP stores codes with a space ("EE 322"); the QAC file name uses "EExxx". Display format not specified by QAC.'),
                field(s, 'semester', 'Term / semester', 'H1', 'cip_derived', 'mandatory', True, label_cell='F1',
                      cip_source={'file': ASSESSMENT_FILE, 'path': 'active_term', 'transform': None,
                                  'note': 'Default only; the term of the assessment is chosen by the user. Format of the value in this cell is not specified.'},
                      flags=['QAC-18']),
                field(s, 'instructor', 'Instructor name', 'H2', 'cip_derived', 'mandatory', True, label_cell='F2',
                      cip_source=course_src('instructor'),
                      notes='CIP stores one instructor string per course; the user may override it.'),
            ]
            row, a, b, f, j = 5, 'A5', 'B5', 'F5', 'J5'
            so_rows = [{
                'row': row,
                'requirement': 'mandatory',
                'fields': [
                    field(s, 'so_id_row5', 'Student Outcome of this workbook (pre-selected; the workbook is dedicated to one SO)', a, 'selector',
                          'mandatory', True, label_cell='A4',
                          cip_source={'file': CURRICULUM_FILE, 'path': 'abet.student_outcomes (key)',
                                      'note': 'Must equal the workbook SO (%s). Which SO workbooks a course needs: %s -> so_course_selection.' % (so, ASSESSMENT_FILE)},
                          data_validation=dv_for(s, a), flags=['QAC-12'],
                          notes='Cell comment on the template: "' + wb.sheet('Main').comments.get(a, '').strip().replace('\n', ' ') + '"'),
                    field(s, 'so_statement_row5', 'SO statement (QAC lookup, derived)', b, 'workbook_formula',
                          'not_applicable', False, label_cell='A4',
                          cip_source={'file': CURRICULUM_FILE, 'path': 'abet.student_outcomes.<SO>.statement',
                                      'note': 'Reference only. Do not write this cell: it is a VLOOKUP into the hidden Lookup Tables sheet, which holds QAC copies of the SO statements.'},
                          flags=['QAC-15']),
                    field(s, 'mapped_pis_row5', 'PIs of the SO selected for assessment and validly mapped to the selected CLOs', f, 'cip_derived',
                          'mandatory', True, label_cell='F4',
                          cip_source={'file': CURRICULUM_FILE,
                                      'path': 'abet.performance_indicators[<PI>].statement for instructor-selected PIs that are in ' + COURSE + '.clos[].pi_codes of selected CLOs mapped to <SO>',
                                      'transform': 'PI id + statement, one PI per line'},
                          flags=['QAC-11', 'QAC-15'],
                          notes='Template text is static and lists every PI of the SO with inconsistent separators. Generated copies follow decision D3: only instructor-selected, validly mapped PIs, deduplicated across activities; the template text is replaced.',
                          rules=['D3']),
                    field(s, 'mapped_clos_row5', 'CLOs of the course mapped to the SO and selected for assessment', j, 'cip_derived',
                          'mandatory', True, label_cell='J4',
                          cip_source={'file': CURRICULUM_FILE,
                                      'path': COURSE + '.clos[] selected, where <SO> in mapped_sos',
                                      'transform': '"<clo_number> <clo_text>" per CLO'},
                          flags=[]),
                ],
            }]
            row6_cells = []
            for ref in ('A6', 'B6', 'F6', 'J6'):
                info = content_info(s, ref)
                row6_cells.append({
                    'cell': ref, 'range': s.merged_range_for(ref) or ref,
                    'template_content': info, 'clear': 'cell value and formula; keep the cell style and merged range',
                })
            cleared_rows = [{
                'row': 6, 'decision': 'D2', 'action': 'clear_row',
                'scope': 'Every cell of Main row 6 (A6:J6): contents and formulas, including the B6 VLOOKUP.',
                'cells_with_template_content': row6_cells,
                'precondition': 'Verify the template structure first: row 6 holds exactly these cells with these content hashes, row 5 holds the workbook SO.',
                'preserve': ['merged ranges', 'cell styles and row height', 'data validation and comments', 'all other Main cells', 'all other worksheets'],
                'package_notes': ['Remove the B6 entry from xl/calcChain.xml when that part exists (otherwise Excel reports a corrupt calc chain).',
                                  'Shared-string entries made unused by the clearing may remain.'],
                'rationale': 'Each QAC workbook is dedicated to one Student Outcome; the pre-filled SO4 row is an error.',
            }]
            assessment_fields = [
                field(s, 'assessment_instruments', 'All assessment instruments used for this SO, stating which are team-based and which individual',
                      'A10', 'instructor_entry', 'mandatory', True, label_cell='A9',
                      cip_source={'file': CURRICULUM_FILE, 'path': COURSE + '.clos[].assessment_methods',
                                  'note': 'Approved assessment methods constrain which instruments may be listed; the descriptive text is instructor-written.'},
                      flags=['QAC-08', 'QAC-13', 'QAC-14'],
                      notes='Individual/Group classification has no discrete cell; it is expressed inside this free-text cell (and the template examples use "Team based:" / "individual assessment:" headings).'),
                field(s, ctx_id, ctx_desc, 'C10', 'instructor_entry', 'mandatory', True, label_cell='C9',
                      cip_source=None, flags=['QAC-13', 'QAC-14'],
                      notes='Heading text of this column is SO-specific. No CIP source exists.'),
                field(s, 'pi_assessment_justification', 'Justification of the assessment selection: how the assessment addresses each PI',
                      'F10', 'instructor_entry', 'mandatory', True, label_cell='F9',
                      cip_source=None, flags=['QAC-13', 'QAC-14'],
                      notes='Template example text (radar project) is guidance to be replaced; it is not a CIP-derived value.'),
            ]
            metadata_fields = []
            if s.value('A11'):
                metadata_fields = [
                    field(s, 'template_version', 'Template version as declared on Main', 'C11', 'template_metadata',
                          'not_applicable', False, label_cell='A11', flags=['QAC-06'],
                          notes='Maintained by QAC. Not an instructor input.'),
                    field(s, 'template_date_of_update', 'Date of update as declared on Main', 'C12', 'template_metadata',
                          'not_applicable', False, label_cell='A12', flags=['QAC-06'],
                          notes='Maintained by QAC; stored value is a serial date in the year 2028.'),
                ]
            static_cells = [
                {'cell': 'A4', 'range': s.merged_range_for('A4'), 'role': 'column heading "SO"'},
                {'cell': 'F4', 'range': s.merged_range_for('F4'), 'role': 'column heading "Mapped PIs"'},
                {'cell': 'J4', 'role': 'column heading "Mapped CLO"'},
                {'cell': 'A8', 'range': s.merged_range_for('A8'), 'role': 'instruction banner'},
            ]
            for item in static_cells:
                item['text'] = s.value(item['cell'])
            templates.append({
                'template_id': spec['template_id'],
                'so': so,
                'main_sheet': 'Main',
                'header_fields': fields,
                'so_rows': so_rows,
                'cleared_rows': cleared_rows,
                'assessment_block': {
                    'row': 10,
                    'column_headings': {
                        'instruments': {'cell': 'A9', 'text': s.value('A9')},
                        'context': {'cell': 'C9', 'text': s.value('C9')},
                        'justification': {'cell': 'F9', 'text': s.value('F9')},
                    },
                    'capacity': 'One row only (row 10, height 409.5 pt in the template); all assessment activities for the SO (at most five per session in total, decision D1) share these three cells.',
                    'max_activities_per_session': 5,
                    'fields': assessment_fields,
                },
                'template_metadata_fields': metadata_fields,
                'static_cells': static_cells,
                'unresolved_regions': [
                    {'range': 'B3:E3', 'merged': True, 'content': 'empty', 'flags': ['QAC-12'],
                     'note': 'Merged empty region between the course rows and the SO table; purpose not stated.'},
                    {'range': 'A7:J7', 'merged': True, 'content': 'empty', 'flags': ['QAC-12'],
                     'note': 'Merged empty row below the SO table that still carries a drop-down (Lookup Tables L1:L8) on A7.'},
                ],
            })
    return {
        'schema_version': SCHEMA_VERSION,
        'decisions': DECISIONS,
        'preparation_limits': {'max_assessment_activities_per_session': 5, 'scope': 'total across all SOs, not per SO',
                               'activity_may_cover': ['multiple CLOs', 'multiple SOs', 'multiple PIs'], 'decision': 'D1'},
        'description': ('Machine-readable map of the Main-sheet cells each QAC workbook expects an instructor (or the future export) '
                        'to complete. Layouts are compared cell-by-cell in the tests; fields whose intent is unclear carry issue ids '
                        '(see data/ee-qac-review-issues.json) instead of a guessed mapping. This file does not populate anything.'),
        'vocabulary': {
            'entry_mode': {
                'cip_derived': 'Value should come from the CIP curriculum database (user may confirm or override).',
                'instructor_entry': 'Free text supplied by the instructor; no CIP source.',
                'selector': 'Drop-down list in the template.',
                'workbook_formula': 'Computed by the workbook; must not be overwritten.',
                'template_metadata': 'QAC-maintained version information.',
            },
            'requirement': {'mandatory': 'Needed for a complete Main sheet.', 'optional': 'May be left as in the template.',
                            'not_applicable': 'Not an input.'},
            'current_content.kind': {'empty': 'Cell empty in the template.',
                                     'placeholder_guidance': 'Bracketed guidance/example text meant to be replaced (replacement rule to be confirmed by QAC, QAC-14).',
                                     'prefilled': 'Static text already in the template.', 'formula': 'Workbook formula.'},
        },
        'cip_sources': {'curriculum': CURRICULUM_FILE, 'assessment_plan': ASSESSMENT_FILE},
        'templates': templates,
    }


def issue(issue_id, severity, category, templates, title, observed, question, impact, evidence=()):
    return {
        'id': issue_id, 'severity': severity, 'category': category, 'templates': templates, 'title': title,
        'observed': observed, 'question_for_qac': question, 'impact_on_future_phases': impact,
        'evidence': [{'template_id': t, 'sheet': sh, 'cell': c, 'contains': text} for t, sh, c, text in evidence],
        'status': 'open',
        'resolution': None,
    }


ALL = [t['template_id'] for t in TEMPLATES]


RESOLUTIONS = {
    'QAC-10': ('resolved_by_decision', 'D2', 'Each workbook is dedicated to one SO; the pre-filled row 6 is an error. The exporter clears the whole of Main row 6 (contents and formulas) in every generated copy; the templates stay unchanged.'),
    'QAC-11': ('resolved_by_decision', 'D3', 'Mapped PIs list only instructor-selected PIs validly mapped to the selected CLOs and the workbook SO, deduplicated across activities, with assessment-to-PI traceability kept. The separator style is still not specified by QAC.'),
    'QAC-13': ('partially_resolved', 'D1', 'At most five assessment activities per session in total. How several activities are delimited inside A10/C10/F10 and whether they fit the 409.5 pt row remain to be defined in the exporter phase.'),
    'QAC-15': ('partially_resolved', 'D4', 'PI31 in CIP now carries the QAC rubric wording plus a final period (data/ee_curriculum.json). PI23/PI24 verb forms and punctuation-only differences remain.'),
    'QAC-20': ('resolved_by_decision', 'D2', 'Row 6 is cleared completely, including the B6 lookup formula; A6 is never populated, so no #N/A cell remains.'),
    'QAC-21': ('resolved_by_decision', 'D4', 'The PI31 profile in data/ee_alignment_evidence.json was revised to the adopted wording (demonstrates, relationship, rubric criteria, attainment methodology); no mapping changed.'),
}


def build_issues():
    so1, so2, so3, so4 = ALL
    issues = [
        issue('QAC-01', 'question', 'rubric_authority', ALL,
              'Hidden legacy "SO4 Rubric" sheet duplicates an SO4 rubric with different wording',
              'Every workbook contains a hidden sheet "SO4 Rubric" with #REF! headers and sample student comments/scores. In the SO4 workbook its PI41/PI42 descriptors differ from the visible " Rubric" sheet. The visible sheets were treated as authoritative; hidden sheets were not extracted.',
              'Confirm that the visible rubric sheet is the only authoritative rubric per workbook and that the hidden legacy sheets can be retired.',
              'None while only visible sheets are used. A wrong authority assumption would change SO4 descriptors.',
              [(so4, 'SO4 Rubric', 'B4', 'Identifies the ethical responsibilities and references at least one applicable professional code'),
               (so4, ' Rubric', 'B4', 'Clearly identifies and explains relevant ethical and professional responsibilities')]),
        issue('QAC-02', 'info', 'rubric_authority', ALL,
              'Hidden legacy sheets SO4-SO8, Student work Description, SO4 Assessment Results, Lookup Tables',
              'Nine hidden sheets are carried in every workbook. They describe other programs\' KPIs (e.g. "computing practice", cybersecurity SO8), contain #REF! formulas, or are lookups. Hidden sheet contents differ in a few workbooks (e.g. SO3 Lookup Tables, SO8, hidden SO4 Rubric).',
              'Confirm none of the hidden sheets is intended for instructors.',
              'Preserved unchanged in exports; not parsed.',
              [(so1, 'SO4', 'B4', '4. Recognize professional responsibilities and make informed judgments in computing practice')]),
        issue('QAC-03', 'question', 'rubric_structure', [so2],
              'SO2 PI21 rubric has eight design-element criteria; PI22-PI24 have one each; no weights',
              'PI21 is scored through eight criteria (rubric rows 4-11) whose Results columns are numbered 1.1-1.8 (E5:L5); the PI21 group average M6 is an unweighted AVERAGE(E6:L6). No weights are defined anywhere. The numbering 1.1-1.8 is matched to rubric criteria 1-8 only by order.',
              'Confirm criteria-to-result-column correspondence (1.1-1.8 = criteria 1-8) and that criteria are intentionally unweighted.',
              'Needed before any score/attainment logic; Phase 1 only records the structure.',
              [(so2, 'SO2 Assessment Results', 'M6', None), (so2, 'SO2 Assessment Results', 'E5', None)]),
        issue('QAC-04', 'defect', 'formula', [so2],
              'SO2 student PI average formula spans derived columns and omits PI24 individual score',
              'Y6 is =IF(COUNT(M6:V6)=0,"",AVERAGE(M6:V6)). M6:V6 includes the derived average columns O, R and U and excludes W (PI24 individual) and X (PI24 average), which conflicts with the note that the SO result is based on the student\'s average PI score.',
              'Confirm the intended range for the student PI average.',
              'Do not reuse the formula as a scoring specification until clarified.',
              [(so2, 'SO2 Assessment Results', 'Y6', 'AVERAGE(M6:V6)')]),
        issue('QAC-05', 'defect', 'template_content', [so2],
              'Test data left in SO2 Results sheet',
              'B6 contains "fsdfsa" and C6 contains "asdf" (student name and ID cells in the first data row of the protected results sheet).',
              'Confirm these are leftovers and should be removed from the template.',
              'Exports would carry the dummy student row.',
              [(so2, 'SO2 Assessment Results', 'B6', 'fsdfsa'), (so2, 'SO2 Assessment Results', 'C6', 'asdf')]),
        issue('QAC-06', 'question', 'versioning', [so2],
              'Only the SO2 workbook declares a version/date on Main, and the date is in 2028',
              'Main A11 "Verion" / C11 = 2 and A12 "Date of update" / C12 = serial date 28-Sep-2028. The other workbooks carry no version cells; versions are otherwise visible only in file names (ver01, ver02) and file properties.',
              'Confirm the date (2028 vs 2026) and whether all templates should declare version/date on Main.',
              'Version tracking in CIP relies on file names + checksums until clarified.',
              [(so2, 'Main', 'A11', 'Verion'), (so2, 'Main', 'A12', 'Date of update')]),
        issue('QAC-07', 'defect', 'formula', [so3],
              'SO3 SO-result formula covers rows 4-14 while class PI formulas cover rows 4-17',
              'SO3 Results I18 counts I4:I14; the corresponding SO1/SO4 formulas count rows 4-17 (14 student rows).',
              'Confirm that the SO3 range should be I4:I17.',
              'Do not reuse the formula as a scoring specification until clarified.',
              [(so3, 'SO3 Assessment Results', 'I18', 'COUNTIF(I4:I14')]),
        issue('QAC-08', 'question', 'individual_group', ALL,
              'Individual vs Group treatment differs by workbook and has no dedicated Main-sheet field',
              'Only the SO2 ("ver02 - Group") Results sheet has separate Group and Individual score columns per PI. SO1 and SO4 Results sheets hold one score per PI per student and say that combined project and individual evidence is averaged; SO3 states neither. In every rubric the checklist cell separates "Team assessment (Report)" from "Individual Assessment". On Main, team/individual is only expressed in the free-text instrument cell.',
              'Should SO1, SO3 and SO4 also have Group variants (as the SO2 file name suggests), and how should team/individual be recorded on Main?',
              'Determines how Phase 2+ classifies each assessment and which checklist segments apply.',
              [(so2, 'SO2 Assessment Results', 'M4', 'Group'), (so1, 'SO1 Assessment Results', 'A19', 'combined evidence (average)')]),
        issue('QAC-09', 'info', 'terminology', ALL,
              'Performance-level labels differ between rubric sheets and hidden Lookup Tables',
              'Rubric headers use "Above Expectation (3)", "Meet Expectation (2)", "Developing Expectation (1)", "Below Expectation (0)". Hidden Lookup Tables labels level 3 as "Accomplished Expectations" (AE) and level 2 as "Meets Expectations". The hidden "Section\'s Satisfaction" table text (ME = "70% to 79%" with upper bound 84; AE "90% or more" with bound 100) is internally inconsistent.',
              'Confirm the official level names and that the Section\'s Satisfaction table is unused.',
              'Level names in CIP rubric JSON follow the rubric sheet headers.',
              [(so1, 'Lookup Tables', 'F12', 'Accomplished Expectations'), (so1, 'Lookup Tables', 'F21', '70% to 79%')]),
        issue('QAC-10', 'question', 'main_sheet', ALL,
              'Main row 6 is pre-filled with SO4 text that is not from the CIP curriculum',
              'All four workbooks pre-fill Main row 6 with SO4, its PI list, and the CLO text "3.1 Recognize the engineering profession and the importance of ethical and legal factors in professional duties". No CIP course CLO has this wording. In the SO4 workbook rows 5 and 6 both carry SO4.',
              'Please remove the pre-filled row 6 in a future template version (owner decision: it is an error).',
              'Generated copies must clear row 6; see decision D2 and cleared_rows in the mapping.',
              [(so1, 'Main', 'A6', 'SO4'), (so1, 'Main', 'J6', '3.1 Recognize the engineering profession'), (so4, 'Main', 'A5', 'SO4')]),
        issue('QAC-11', 'question', 'main_sheet', ALL,
              'Mapped-PI text is static, lists the whole SO, and uses inconsistent separators',
              'F5/F6 hold fixed text for the template\'s SO; they do not follow the SO drop-down in A5/A6 (only B5/B6 are formulas). Separators vary ("PI11 Identify", "PI31 \u2013 Communicate", "PI41. Recognize", "PI 24 Identify"). Whether the cell should list all PIs of the SO or only PIs mapped to the course is not stated.',
              'Should "Mapped PIs" list all PIs of the SO or only those mapped to the course, and which separator format is required?',
              'Defines the transformation of CIP PI data into F5/F6.',
              [(so1, 'Main', 'F5', 'PI11'), (so3, 'Main', 'F5', 'PI31 \u2013 Communicate'), (so2, 'Main', 'F5', 'PI 24 Identify')]),
        issue('QAC-12', 'question', 'main_sheet', ALL,
              'SO drop-down comments and merged regions (rows 3 and 7) are unclear',
              'Comments on A5 and A6 say to select the last empty list cell to avoid selecting an SO, but A5:A6 validate against Lookup Tables L1:L7 (no empty entry). A7 has a validation list L1:L8 (L8 is empty) yet row 7 is merged across A7:J7, so it cannot hold a third SO row. B3:E3 is a merged empty region.',
              'Is a third SO row intended? What is B3:E3 for? Should rows 5-6 allow an empty selection?',
              'Limits the number of SOs per workbook that can be populated; multi-SO courses may need several workbooks.',
              [(so1, 'Main', 'A5', None)]),
        issue('QAC-13', 'question', 'main_sheet', ALL,
              'Main sheet has a single assessment row; multiple assessments per SO share three free-text cells',
              'Assessment inputs are A10:B10 (instruments), C10:E10 (context) and F10:J10 (PI justification) in one row with a 409.5 pt height. There is no per-assessment row, ID, CLO link or Individual/Group field. The SO2 placeholder only says to name which project covered which factors.',
              'What is the expected convention for several assessments (separate labelled paragraphs? one workbook per assessment?) and for the capacity of the 409.5 pt row?',
              'Central design question for Phase 4+ population.',
              [(so2, 'Main', 'C10', 'more than one project')]),
        issue('QAC-14', 'info', 'main_sheet', ALL,
              'Template wording errors and copy-over text (not corrected)',
              'Examples: "Verion"; "mapaped"; "characterstics"; "chacractersitc"; "individaul assssment"; unmatched "}" in A10; "Justifymultiple" in SO2 F5. The SO1 workbook\'s F9 heading says "...PIs of the SO2" and its example justification labels PI12 as "PI 22". The bracketed guidance text and radar-project examples in A10/C10/F10 are placeholders whose replacement rule is not stated.',
              'Please correct the templates in a future QAC version; confirm placeholders are replaced, not appended to.',
              'Exports keep the QAC wording unless QAC issues a new version.',
              [(so1, 'Main', 'F9', 'PIs of the SO2'), (so1, 'Main', 'A10', 'individaul assssment'), (so2, 'Main', 'F5', 'Justifymultiple')]),
        issue('QAC-15', 'info', 'curriculum_consistency', ALL,
              'QAC wording of SOs/PIs differs from the CIP curriculum text',
              'PI31 in the SO3 rubric differed in substance from the CIP statement; CIP now adopts the rubric wording plus a final period (decision D4; the SO3 Main sheet text also ends with a period). PI23/PI24 in the SO2 rubric use third-person verbs; punctuation or case differs for PI11, PI22, PI32, PI33. Hidden Lookup Tables SO statements for SO3 and SO6 differ from CIP only by a final period. CIP remains authoritative; nothing was changed. Each criterion records its comparison result in cip_pi_statement_comparison.',
              'Confirm whether QAC or CIP wording is current for PI31 and the other flagged PIs.',
              'Documents prepared from CIP text may disagree with the workbook rubric labels.',
              [(so3, 'Rubric', 'A4', 'Communicate engineering information using appropriate technical content')]),
        issue('QAC-16', 'info', 'workbook_structure', ALL,
              'Broken external link in defined names',
              'Defined names OutcomesList and Percentage point at "[1]Lookups Tables" in the external file C:\\21752_Rachid.xlsx. Excel may prompt to update links when a workbook is opened.',
              'Confirm the names are unused and can be removed in a future version.',
              'Exports inherit the link and prompt.', []),
        issue('QAC-17', 'info', 'tooling', [so1, so2, so4, so3],
              'Spreadsheet libraries cannot round-trip these workbooks safely',
              'SO1, SO2 and SO4 Main sheets store their SO drop-downs as x14 data-validation extensions, and all Main sheets carry cell comments, VML drawings and an external-link part. openpyxl reports "Data Validation extension is not supported and will be removed". SO3 is a Google Sheets export with a different package layout.',
              'None (informational).',
              'The future export must patch Main-sheet cell values directly in the package XML (or equivalent) to preserve everything else.', []),
        issue('QAC-18', 'question', 'naming', ALL,
              'No confirmed output naming convention',
              'Template names end in "EExxx-T2xx ver01/ver02". CIP stores codes as "EE 322" and the active term as "T261". The SO4 file name carries a "(1) (1)" download suffix; sheet names include a leading space (" Rubric") and a stray hyphen ("SO4 -Assessment Results").',
              'Confirm the file-name pattern (e.g. EE322-T261), term format on Main, and whether the template names should be normalised in a new version.',
              'Needed for the download step. Stored assets keep the supplied names.', []),
        issue('QAC-19', 'info', 'results_sheet', [so1, so2, so3, so4],
              'Results sheets have fixed capacity (14 student rows) and 0-3 score entry only',
              'Student formulas and class/SO summary formulas cover 14 rows (SO1/SO3/SO4 rows 4-17; SO2 rows 6-19). Attainment bands from the formulas: <1 BE, <2 DE, <3 ME, otherwise AE; PI and SO results count scores/averages \u2265 2. Student results and attainment are out of scope for this tool.',
              'None (informational).', 'Not used before any attainment work.', []),
        issue('QAC-20', 'question', 'main_sheet', ALL,
              'Clearing only A6 would leave the B6 VLOOKUP returning #N/A (superseded: whole row cleared)',
              "B6 is =VLOOKUP(A6,'Lookup Tables'!$L$1:$M$7,2,FALSE). If A6 alone were cleared, the lookup would find no match and B6 would show #N/A. Decision D2 avoids this by clearing the entire row 6, including the B6 formula, in generated copies.",
              'None (resolved by decision).',
              'Exporter must also drop the B6 entry from calcChain.xml.', [(so1, 'Main', 'B6', 'VLOOKUP(A6')]),
        issue('QAC-21', 'question', 'curriculum_consistency', [so3],
              'ee_alignment_evidence.json PI31 profile paraphrases the superseded PI31 wording',
              'The PI31 evidence profile ("relevant, accurate and sufficient for the purpose"; rubric_criteria on accuracy and sufficiency) was written for the previous CIP statement. It is analysis guidance, not a curriculum mapping; it has since been revised to the adopted wording.',
              'None (resolved by decision).',
              'Alignment-analysis text for PI31 matches the adopted statement.',
              [(so3, 'Rubric', 'B4', 'appropriate technical content')]),
    ]
    by_id = {i['id']: i for i in issues}
    for issue_id, (status, decision, summary) in RESOLUTIONS.items():
        by_id[issue_id]['status'] = status
        by_id[issue_id]['resolution'] = {'decision': decision, 'summary': summary}
    return {
        'schema_version': SCHEMA_VERSION,
        'status_values': {'open': 'Awaiting QAC/academic decision.',
                          'partially_resolved': 'A decision covers part of the item; remainder stays open.',
                          'resolved_by_decision': 'Settled by an owner decision; the QAC template itself is unchanged.'},
        'description': 'Inconsistencies, ambiguities and questions found while ingesting the QAC workbooks. Recorded for possible QAC review; no template or rubric text was corrected.',
        'issues': issues,
    }
