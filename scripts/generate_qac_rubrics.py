#!/usr/bin/env python3
"""Generate the QAC rubric library, template manifest and Main-sheet mapping.

Reads ONLY the byte-preserved QAC workbooks under templates/qac-so-assessment/
(standard library only) and the read-only CIP curriculum database. It writes:

  data/ee-qac-rubrics.json           official QAC rubric text (verbatim) + indexes
  data/ee-qac-templates.json         template manifest (versions, checksums, sheet inventory)
  data/ee-qac-main-sheet-mapping.json  Main-sheet input-field mapping per template
  data/ee-qac-review-issues.json     inconsistencies recorded for QAC review (not corrected)

Run:  python -B scripts/generate_qac_rubrics.py            (write)
      python -B scripts/generate_qac_rubrics.py --check    (exit 1 if files are stale)

Nothing here edits a workbook or any approved curriculum data.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from qac_xlsx import Workbook, sha256_file  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE_DIR = ROOT / 'templates' / 'qac-so-assessment'
DATA = ROOT / 'data'
OUT_RUBRICS = DATA / 'ee-qac-rubrics.json'
OUT_TEMPLATES = DATA / 'ee-qac-templates.json'
OUT_MAPPING = DATA / 'ee-qac-main-sheet-mapping.json'
OUT_ISSUES = DATA / 'ee-qac-review-issues.json'
CURRICULUM = DATA / 'ee_curriculum.json'

SCHEMA_VERSION = '1.0'
LEVEL_KEYS = ('above', 'meet', 'developing', 'below')
LEVEL_COLUMNS = ('B', 'C', 'D', 'E')
AUDIENCE_RE = re.compile(r'^(Team assessment \(Report\):|Individual [Aa]ssessment(?: \(Oral Discussion\))?:)', re.M)

# --------------------------------------------------------------------------
# Template registry: which supplied workbook is which, and where its
# authoritative rubric / results / Main-sheet content lives. Everything here is
# an explicit statement about the supplied files, verified by the test suite.
# --------------------------------------------------------------------------
TEMPLATES = [
    {
        'template_id': 'qac-so1-ver01', 'so': 'SO1', 'folder': 'so1-ver01',
        'file': 'PI-SO1 Assessment-EExxx-T2xx ver01.xlsx', 'version_label': 'ver01', 'variant': None,
        'results_sheet': 'SO1 Assessment Results',
        'rubric_sheets': [{
            'sheet': 'Rubric', 'title_cell': 'A1', 'header_row': 2, 'criteria_rows': [4, 5, 6], 'note_cell': 'A7',
            'checklists': [('F', 'project'), ('G', 'exam')], 'pi_source': 'label',
        }],
        'authoritative_notes': 'Visible sheet "Rubric" is the SO1 rubric (PI11-PI13).',
    },
    {
        'template_id': 'qac-so2-ver02-group', 'so': 'SO2', 'folder': 'so2-ver02-group',
        'file': 'PI-SO2 Assessment-EExxx-T2xx ver02 - Group.xlsx', 'version_label': 'ver02', 'variant': 'Group',
        'results_sheet': 'SO2 Assessment Results',
        'rubric_sheets': [
            {'sheet': 'SO2-PI21 Rubric', 'title_cell': 'A1', 'header_row': 2, 'criteria_rows': list(range(4, 12)),
             'note_cell': 'A12', 'checklists': [('F', 'unspecified')], 'pi_source': 'title'},
            {'sheet': 'SO2-PI22,PI23&PI24 Rubric', 'title_cell': 'A1', 'header_row': 2, 'criteria_rows': [4, 5, 6],
             'note_cell': 'A7', 'checklists': [('F', 'unspecified')], 'pi_source': 'label'},
        ],
        'authoritative_notes': 'Two visible rubric sheets: PI21 (8 design-element criteria) and PI22/PI23/PI24 (one criterion each).',
    },
    {
        'template_id': 'qac-so3-ver01', 'so': 'SO3', 'folder': 'so3-ver01',
        'file': 'PI-SO3 Assessment-EExxx-T2xx ver01.xlsx', 'version_label': 'ver01', 'variant': None,
        'results_sheet': 'SO3 Assessment Results',
        'rubric_sheets': [{
            'sheet': 'Rubric', 'title_cell': 'A1', 'header_row': 2, 'criteria_rows': [4, 5, 6], 'note_cell': 'A7',
            'checklists': [('F', 'project')], 'pi_source': 'label',
        }],
        'authoritative_notes': 'Visible sheet "Rubric" is the SO3 rubric (PI31-PI33).',
    },
    {
        'template_id': 'qac-so4-ver02', 'so': 'SO4', 'folder': 'so4-ver02',
        'file': 'PI-SO4 Assessment-EExxx-T2xx ver02 (1) (1).xlsx', 'version_label': 'ver02', 'variant': None,
        'results_sheet': 'SO4 -Assessment Results',
        'rubric_sheets': [{
            'sheet': ' Rubric', 'title_cell': 'A1', 'header_row': 2, 'criteria_rows': [4, 5], 'note_cell': 'A6',
            'checklists': [('F', 'project'), ('G', 'exam')], 'pi_source': 'label',
        }],
        'authoritative_notes': 'Visible sheet " Rubric" (leading space in the sheet name) is the SO4 rubric (PI41-PI42).',
    },
]

# Sheets present in every workbook that are NOT treated as authoritative rubrics.
LEGACY_HIDDEN = {
    'SO4 Rubric': 'Hidden. Contains an SO4 rubric with #REF! student headers and sample student comments/scores; copied into all four workbooks.',
    'SO4 Assessment Results': 'Hidden. Legacy SO4 results sheet present in every workbook.',
    'Student work Description': 'Hidden. All cells are #REF! formulas.',
    'SO4': 'Hidden. Legacy computing-program KPI rubric ("computing practice") for SO4.',
    'SO5': 'Hidden. Legacy teamwork KPI rubric for SO5.',
    'SO6': 'Hidden. Legacy sheet for SO6.',
    'SO7': 'Hidden. Legacy sheet for SO7.',
    'SO8': 'Hidden. Legacy cybersecurity (CYS-SO) rubric for SO8.',
    'Lookup Tables': 'Hidden. Supporting lookup (SO statements, level codes, drop-down lists); not a rubric.',
}

SCORING_FORMULA_ROWS = {
    # template_id -> (first data row, pi columns, avg col, attainment col, summary row)
    'qac-so1-ver01': {'first_row': 4, 'last_row': 17, 'pi_columns': ['E', 'F', 'G'], 'avg': 'H', 'attain': 'I', 'summary_row': 18},
    'qac-so3-ver01': {'first_row': 4, 'last_row': 17, 'pi_columns': ['E', 'F', 'G'], 'avg': 'H', 'attain': 'I', 'summary_row': 18},
    'qac-so4-ver02': {'first_row': 4, 'last_row': 17, 'pi_columns': ['E', 'F'], 'avg': 'G', 'attain': 'H', 'summary_row': 18},
}


def read_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def dump_json(path, value):
    Path(path).write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')


def sha256_text(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def template_path(spec):
    return TEMPLATE_DIR / spec['folder'] / spec['file']


def split_audience_segments(text):
    """Split a checklist cell into Team / Individual segments (verbatim substrings)."""
    matches = list(AUDIENCE_RE.finditer(text))
    if not matches:
        return [{'audience': 'unspecified', 'heading': None, 'text': text}]
    segments = []
    if matches[0].start() > 0:
        segments.append({'audience': 'unspecified', 'heading': None, 'text': text[:matches[0].start()]})
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        heading = m.group(1)
        audience = 'team' if heading.startswith('Team') else 'individual'
        segments.append({'audience': audience, 'heading': heading, 'text': text[m.start():end]})
    return segments


def checklist_context(role, audience):
    if role == 'exam':
        return 'exam_written'
    if audience == 'team':
        return 'team_evidence'
    if audience == 'individual':
        return 'individual_verification'
    return 'unspecified'


def pi_id(text):
    m = re.search(r'\bPI\s?(\d)(\d)\b', text)
    return 'PI%s%s' % (m.group(1), m.group(2)) if m else None


def pi_label_text(label):
    """QAC PI wording after the identifier, for comparison only (not stored as CIP text)."""
    m = re.match(r'\s*PI\s?\d\d\b[\s.–\-]*(.*)', label, re.S)
    return m.group(1).strip() if m else None


def norm(text):
    return re.sub(r'[\W_]+', ' ', (text or '').lower()).strip()


def compare_with_cip(label, cip_statement):
    qac = pi_label_text(label)
    if qac is None:
        return 'not_applicable'
    if qac == cip_statement:
        return 'exact'
    if norm(qac) == norm(cip_statement):
        return 'punctuation_or_case_only'
    return 'differs'


def build_rubrics(curriculum):
    abet = curriculum['abet']
    rubrics = []
    scoring_rules = []
    for spec in TEMPLATES:
        with Workbook(template_path(spec)) as wb:
            for rs in spec['rubric_sheets']:
                sh = wb.sheet(rs['sheet'])
                header_row = rs['header_row']
                level_headers = {}
                scale = []
                for key, col in zip(LEVEL_KEYS, LEVEL_COLUMNS):
                    header = sh.value('%s%d' % (col, header_row))
                    score = int(re.search(r'\((\d)\)', header).group(1))
                    level_headers[key] = {'cell': '%s%d' % (col, header_row), 'text': header}
                    scale.append({'key': key, 'score': score, 'header_cell': '%s%d' % (col, header_row)})
                checklist_defs = []
                for col, role in rs['checklists']:
                    checklist_defs.append({'checklist_id': role if role != 'unspecified' else 'checklist',
                                           'column': col, 'role': role,
                                           'header_cell': '%s%d' % (col, header_row),
                                           'header': sh.value('%s%d' % (col, header_row))})
                title = sh.value(rs['title_cell'])
                title_pi = pi_id(title) if rs['pi_source'] == 'title' else None
                rubric_id = '%s-%s' % (spec['template_id'], re.sub(r'[^a-z0-9]+', '-', rs['sheet'].strip().lower()).strip('-'))
                criteria = []
                per_pi_counter = {}
                for row in rs['criteria_rows']:
                    label = sh.value('A%d' % row)
                    pi = title_pi or pi_id(label)
                    per_pi_counter[pi] = per_pi_counter.get(pi, 0) + 1
                    n = per_pi_counter[pi]
                    descriptors = {}
                    for (key, col), item in zip(zip(LEVEL_KEYS, LEVEL_COLUMNS), scale):
                        descriptors[key] = {'score': item['score'], 'cell': '%s%d' % (col, row),
                                            'text': sh.value('%s%d' % (col, row))}
                    checklists = []
                    for cdef in checklist_defs:
                        cell = '%s%d' % (cdef['column'], row)
                        text = sh.value(cell)
                        if text is None:
                            continue
                        segments = split_audience_segments(text) if cdef['role'] != 'exam' else \
                            [{'audience': 'unspecified', 'heading': None, 'text': text}]
                        for seg in segments:
                            seg['context'] = checklist_context(cdef['role'], seg['audience'])
                        checklists.append({'checklist_id': cdef['checklist_id'], 'role': cdef['role'], 'cell': cell,
                                           'text': text, 'segments': segments})
                    cip_pi = abet['performance_indicators'][pi]
                    criteria.append({
                        'criterion_id': '%s.C%d' % (pi, n),
                        'so': spec['so'], 'pi': pi, 'order_in_pi': n,
                        'label': label, 'label_cell': 'A%d' % row, 'source_row': row,
                        'cip_pi_statement_comparison': compare_with_cip(label, cip_pi['statement']) if rs['pi_source'] == 'label' else 'not_applicable',
                        'descriptors': descriptors,
                        'checklists': checklists,
                    })
                note_cell = rs['note_cell']
                rubrics.append({
                    'rubric_id': rubric_id,
                    'so': spec['so'],
                    'pis': sorted({c['pi'] for c in criteria}),
                    'template_id': spec['template_id'],
                    'workbook_variant': spec['variant'],
                    'source': {'workbook': spec['file'], 'sheet': rs['sheet'], 'sheet_state': sh.state,
                               'dimension': sh.dimension, 'merged_ranges': sh.merged,
                               'workbook_version_label': spec['version_label']},
                    'title': {'cell': rs['title_cell'], 'text': title},
                    'item_header': {'cell': 'A%d' % header_row, 'text': sh.value('A%d' % header_row)},
                    'performance_levels': {'scale': scale, 'headers': level_headers},
                    'checklist_columns': checklist_defs,
                    'criteria': criteria,
                    'assessment_note': {'cell': note_cell, 'text': sh.value(note_cell)},
                    'weights': None,
                    'weights_note': 'No criterion or PI weights are defined on this rubric sheet or in the workbook; the Results sheet averages scores without weights.',
                })
            scoring_rules.append(build_scoring(spec, wb))
    return rubrics, scoring_rules


def build_scoring(spec, wb):
    sh = wb.sheet(spec['results_sheet'])
    tid = spec['template_id']
    rule = {
        'template_id': tid, 'so': spec['so'],
        'source': {'workbook': spec['file'], 'sheet': spec['results_sheet'], 'sheet_state': sh.state,
                   'sheet_protected': sh.protected},
        'scale_scores': [0, 1, 2, 3],
        'weights': None,
        'score_entry_instruction': {'cell': 'A2', 'text': sh.value('A2')},
    }
    if tid in SCORING_FORMULA_ROWS:
        cfg = SCORING_FORMULA_ROWS[tid]
        r = cfg['first_row']
        avg_cell, att_cell = '%s%d' % (cfg['avg'], r), '%s%d' % (cfg['attain'], r)
        rule['pi_columns'] = [{'column': c, 'header_cell': '%s3' % c, 'header': sh.value('%s3' % c)} for c in cfg['pi_columns']]
        rule['formulas'] = {
            'student_pi_average': {'cell': avg_cell, 'formula': sh.formula(avg_cell)},
            'student_attainment': {'cell': att_cell, 'formula': sh.formula(att_cell)},
            'class_pi_percentage': [{'cell': '%s%d' % (c, cfg['summary_row']), 'formula': sh.formula('%s%d' % (c, cfg['summary_row']))}
                                    for c in cfg['pi_columns']],
            'so_result': {'cell': '%s%d' % (cfg['attain'], cfg['summary_row']),
                          'formula': sh.formula('%s%d' % (cfg['attain'], cfg['summary_row']))},
        }
        rule['student_rows'] = {'first': cfg['first_row'], 'last': cfg['last_row']}
        rule['notes'] = {'cell': 'A19', 'text': sh.value('A19')}
    else:  # SO2 group/individual structure
        rule['pi_groups'] = [
            {'pi': 'PI21', 'element_score_cells': 'E6:L6', 'element_header_cells': 'E5:L5',
             'element_headers': [sh.value('%s5' % c) for c in 'EFGHIJKL'],
             'group_average_cell': 'M6', 'individual_cell': 'N6', 'average_cell': 'O6'},
            {'pi': 'PI22', 'group_cell': 'P6', 'individual_cell': 'Q6', 'average_cell': 'R6'},
            {'pi': 'PI23', 'group_cell': 'S6', 'individual_cell': 'T6', 'average_cell': 'U6'},
            {'pi': 'PI24', 'group_cell': 'V6', 'individual_cell': 'W6', 'average_cell': 'X6'},
        ]
        rule['column_headers'] = {c: sh.value('%s4' % c) for c in ['M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X']}
        rule['group_headers'] = {c: sh.value('%s3' % c) for c in ['E', 'P', 'S', 'V', 'Y', 'Z', 'AA']}
        rule['formulas'] = {
            'pi21_group_average': {'cell': 'M6', 'formula': sh.formula('M6')},
            'pi21_average': {'cell': 'O6', 'formula': sh.formula('O6')},
            'pi22_average': {'cell': 'R6', 'formula': sh.formula('R6')},
            'pi23_average': {'cell': 'U6', 'formula': sh.formula('U6')},
            'pi24_average': {'cell': 'X6', 'formula': sh.formula('X6')},
            'student_pi_average': {'cell': 'Y6', 'formula': sh.formula('Y6')},
            'student_attainment': {'cell': 'Z6', 'formula': sh.formula('Z6')},
            'class_pi_percentage': [{'cell': '%s20' % c, 'formula': sh.formula('%s20' % c)} for c in ('O', 'R', 'U', 'X')],
            'so_result': {'cell': 'Z20', 'formula': sh.formula('Z20')},
        }
        rule['student_rows'] = {'first': 6, 'last': 19}
        rule['notes'] = {'cell': 'A21', 'text': sh.value('A21')}
    rule['attainment_thresholds'] = {
        'derived_from': rule['formulas']['student_attainment']['cell'],
        'rule': 'student PI average <1 = BE; <2 = DE; <3 = ME; otherwise AE',
        'bands': [{'code': 'BE', 'min_inclusive': 0, 'max_exclusive': 1},
                  {'code': 'DE', 'min_inclusive': 1, 'max_exclusive': 2},
                  {'code': 'ME', 'min_inclusive': 2, 'max_exclusive': 3},
                  {'code': 'AE', 'min_inclusive': 3, 'max_exclusive': None}],
        'satisfactory_threshold': 2,
    }
    return rule


def build_rubric_library(curriculum):
    rubrics, scoring_rules = build_rubrics(curriculum)
    by_so, by_pi, by_criterion, by_context = {}, {}, {}, {}
    for r in rubrics:
        by_so.setdefault(r['so'], []).append(r['rubric_id'])
        for c in r['criteria']:
            by_pi.setdefault(c['pi'], []).append(c['criterion_id'])
            by_criterion[c['criterion_id']] = r['rubric_id']
            for cl in c['checklists']:
                for seg in cl['segments']:
                    by_context.setdefault(seg['context'], [])
                    if c['criterion_id'] not in by_context[seg['context']]:
                        by_context[seg['context']].append(c['criterion_id'])
    return {
        'schema_version': SCHEMA_VERSION,
        'program': curriculum['program'],
        'description': ('Official Quality Assurance Committee (QAC) SO/PI assessment rubrics extracted verbatim from the '
                        'byte-preserved QAC Excel templates. Contains no suggested assignments, CLO interpretation or '
                        'instructional guidance. SO and PI identifiers refer to abet.student_outcomes and '
                        'abet.performance_indicators in ee_curriculum.json, which remain the single source of truth; '
                        'SO/PI descriptions are not duplicated here (only the QAC criterion label is kept, for fidelity).'),
        'authority': {'issuer': 'Quality Assurance Committee (QAC)',
                      'authoritative_sheets': 'The visible rubric sheet(s) of each workbook (see rubrics[].source). Hidden legacy sheets are not extracted.',
                      'text_policy': 'All text fields are verbatim cell values (including non-breaking spaces, bullets and typographical errors). Nothing is corrected.'},
        'curriculum_reference': {'file': 'data/ee_curriculum.json', 'so_path': 'abet.student_outcomes', 'pi_path': 'abet.performance_indicators'},
        'templates_manifest': 'data/ee-qac-templates.json',
        'checklist_contexts': {
            'team_evidence': 'Checklist items under "Team assessment (Report):" (group/team evidence).',
            'individual_verification': 'Checklist items under "Individual Assessment:" (individual verification, e.g. oral or exam question).',
            'exam_written': 'Checklist column for exam/written assessment.',
            'unspecified': 'Checklist text without a Team/Individual heading.',
        },
        'rubrics': rubrics,
        'scoring_rules': scoring_rules,
        'index': {'by_so': by_so, 'by_pi': by_pi, 'by_criterion': by_criterion, 'by_checklist_context': by_context},
    }


# --------------------------------------------------------------------------
# Template manifest
# --------------------------------------------------------------------------
def build_template_manifest():
    templates = []
    for spec in TEMPLATES:
        path = template_path(spec)
        with Workbook(path) as wb:
            sheets = []
            for sh in wb.sheets:
                if sh.name in LEGACY_HIDDEN and sh.state == 'hidden':
                    role = 'legacy_hidden'
                    note = LEGACY_HIDDEN[sh.name]
                elif sh.name == 'Main':
                    role, note = 'main', 'Instructor data-entry sheet.'
                elif sh.name in [r['sheet'] for r in spec['rubric_sheets']]:
                    role, note = 'authoritative_rubric', 'Official QAC rubric for ' + spec['so'] + '.'
                elif sh.name == spec['results_sheet']:
                    role, note = 'results', 'Student scoring/attainment sheet (formulas); out of scope for Phase 1 population.'
                else:
                    role, note = 'unclassified', ''
                sheets.append({'name': sh.name, 'state': sh.state, 'role': role, 'dimension': sh.dimension,
                               'protected': sh.protected, 'note': note})
            props = wb.properties
            main = wb.sheet('Main')
            declared = {'cell': 'C11', 'value': main.value('C11')} if main.value('A11') else None
            templates.append({
                'template_id': spec['template_id'],
                'so': spec['so'],
                'version_label': spec['version_label'],
                'variant': spec['variant'],
                'workbook_declared_version': declared,
                'asset_path': 'templates/qac-so-assessment/%s/%s' % (spec['folder'], spec['file']),
                'original_file_name': spec['file'],
                'size_bytes': path.stat().st_size,
                'sha256': sha256_file(path),
                'core_properties': {k: props.get(k) for k in ('creator', 'lastModifiedBy', 'created', 'modified') if props.get(k)},
                'main_sheet': 'Main',
                'rubric_sheets': [r['sheet'] for r in spec['rubric_sheets']],
                'results_sheet': spec['results_sheet'],
                'sheet_order': wb.sheet_names,
                'sheets': sheets,
                'external_links': wb.external_links,
                'defined_names': wb.defined_names,
                'authoritative_notes': spec['authoritative_notes'],
            })
    return {
        'schema_version': SCHEMA_VERSION,
        'description': ('Versioned manifest of the original QAC SO assessment workbooks. The workbooks are stored byte-for-byte '
                        'as supplied (never edited, re-saved or renamed) and are the only inputs to the future export, which must '
                        'copy a workbook, fill the Main-sheet input cells listed in ee-qac-main-sheet-mapping.json and leave every '
                        'other part of the package untouched.'),
        'asset_root': 'templates/qac-so-assessment',
        'preservation_rules': [
            'Do not modify, correct, re-save, reorder or rename the stored workbooks.',
            'Populate copies only; edit the package XML in place (cell values on the Main sheet) rather than loading and re-saving through a spreadsheet library, which would drop data-validation extensions, comments and external-link parts.',
            'Record any inconsistency in data/ee-qac-review-issues.json for QAC instead of fixing the template.',
        ],
        'output_naming': {
            'status': 'unresolved',
            'note': 'QAC file names use the placeholders "EExxx-T2xx". A concrete convention for generated files (course code spacing, term format, suffixes) has not been confirmed; see issue QAC-18.',
            'template_placeholder_pattern': 'PI-SO<n> Assessment-EExxx-T2xx ver<nn>.xlsx',
        },
        'templates': templates,
    }


if __name__ == '__main__':
    curriculum = read_json(CURRICULUM)
    rubric_library = build_rubric_library(curriculum)
    from qac_mapping_data import build_mapping, build_issues  # noqa: E402
    outputs = {
        OUT_RUBRICS: rubric_library,
        OUT_TEMPLATES: build_template_manifest(),
        OUT_MAPPING: build_mapping(curriculum),
        OUT_ISSUES: build_issues(),
    }
    stale = []
    for path, value in outputs.items():
        text = json.dumps(value, indent=2, ensure_ascii=False) + '\n'
        if '--check' in sys.argv:
            if not path.exists() or path.read_text(encoding='utf-8') != text:
                stale.append(path.name)
        else:
            dump_json(path, value)
            print('wrote', path.relative_to(ROOT))
    if stale:
        print('Stale generated files:', ', '.join(stale))
        sys.exit(1)
