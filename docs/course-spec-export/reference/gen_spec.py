#!/usr/bin/env python3
"""
Generate NCAAA Course Specification .docx files from ee_curriculum.json
by filling the merge fields in EE_CS_NCAAA_Template.docx.

Strategy: operate on a COPY of the template's word/document.xml.
  Pass 1 - flatten every MERGEFIELD complex field into a single run that
           keeps the cached result run's formatting (rPr), carrying a sentinel.
  Pass 2 - clone <w:tr> rows for variable-length sections (CLOs, topics)
           so cloned rows inherit the model row's exact formatting.
  Pass 3 - substitute sentinels with values; blank when data is missing.
Nothing is rebuilt, so styles/fonts/borders/headers survive untouched.
"""
import json, re, shutil, subprocess, sys, os, copy
from pathlib import Path
from lxml import etree

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
NS = {'w': W}
def q(tag): return f'{{{W}}}{tag}'

# ---------------------------------------------------------------- config
# Program constants: not in the JSON, identical for every course.
CONFIG = {
    'Department':        'Communications and Networks Engineering',
    'Version':           '1',
    'Revision_Date':     '25-09-2024',
    'COUNCIL_COMMITTEE': 'Departmental Council',
    'REFERENCE_NO':      '1',
    'Date_of_Approval':  '25-09-2024',
}
LECTURE_HOURS = 45          # hard-coded in the template's activity table
NQF_GROUPS = [('Knowledge', 1), ('Skills', 2), ('Values', 3)]

SENT_OPEN, SENT_CLOSE = '\u241e', '\u241f'   # non-printing sentinels
def sent(name): return f'{SENT_OPEN}{name}{SENT_CLOSE}'


# ---------------------------------------------------------------- rules
def contact_hours(course):
    """Total = 45 lecture + tutorial + lab.  Validated against 29/30 Excel rows."""
    cr = course.get('credit_hours') or ''
    cr = int(cr) if str(cr).isdigit() else None
    if course.get('type') in ('Capstone', 'COOP') or course.get('required_or_elective') == 'Elective':
        lab, tut = 0, 0
    elif cr == 4:
        lab, tut = 30, 15
    else:
        lab, tut = 0, 15
    return lab, tut, LECTURE_HOURS + lab + tut


def plo_codes(clo):
    """SO1 -> 1 ; joined with commas when a CLO maps to several."""
    out = []
    for so in clo.get('mapped_sos') or []:
        m = re.search(r'(\d+)', str(so))
        if m:
            out.append(m.group(1))
    return ', '.join(out)


def join_list(items, sep='; '):
    return sep.join(str(i).strip() for i in items if str(i).strip()) if items else ''


# ------------------------------------------------- pass 1: flatten fields
def flatten_merge_fields(root):
    """Replace each MERGEFIELD complex field with one run carrying a sentinel,
    inheriting the rPr of the cached-result run so formatting is identical.

    Field runs may sit directly in <w:p> or inside a <w:sdtContent> content
    control, so we work from each field's actual parent container.
    """
    found = []
    parents = []
    for fc in root.iter(q('fldChar')):
        r = fc.getparent()
        if r is None or r.tag != q('r'):
            continue
        p = r.getparent()
        if p is not None and p not in parents:
            parents.append(p)

    for para in parents:
        kids = list(para)
        i = 0
        while i < len(kids):
            r = kids[i]
            if r.tag != q('r'):
                i += 1; continue
            fc = r.find(q('fldChar'))
            if fc is None or fc.get(q('fldCharType')) != 'begin':
                i += 1; continue

            # scan child-by-child: merged runs can hold begin+instrText+separate
            depth, instr, sep_at, end_at = 0, [], None, None
            for j in range(i, len(kids)):
                rj = kids[j]
                if rj.tag != q('r'):
                    continue
                for child in rj:
                    if child.tag == q('fldChar'):
                        ct = child.get(q('fldCharType'))
                        if ct == 'begin':
                            depth += 1
                        elif ct == 'separate' and depth == 1:
                            sep_at = j
                        elif ct == 'end':
                            depth -= 1
                            if depth == 0:
                                end_at = j
                                break
                    elif child.tag == q('instrText') and depth == 1 and child.text:
                        instr.append(child.text)
                if end_at is not None:
                    break
            if end_at is None:
                i += 1; continue

            m = re.search(r'MERGEFIELD\s+"?([A-Za-z0-9_]+)"?', ''.join(instr))
            if not m:
                i = end_at + 1; continue
            name = m.group(1)
            found.append(name)

            donor_rpr = None
            if sep_at is not None:
                for k in range(sep_at + 1, end_at):
                    if kids[k].tag == q('r') and kids[k].find(q('t')) is not None:
                        donor_rpr = kids[k].find(q('rPr')); break
            if donor_rpr is None:
                donor_rpr = r.find(q('rPr'))

            new_r = etree.Element(q('r'))
            if donor_rpr is not None:
                new_r.append(copy.deepcopy(donor_rpr))
            t = etree.SubElement(new_r, q('t'))
            t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
            t.text = sent(name)
            r.addprevious(new_r)
            for k in range(i, end_at + 1):
                para.remove(kids[k])
            kids = list(para)
            i = kids.index(new_r) + 1
    return found


# ---------------------------------------------------- text substitution
def set_cell_text(tc, value):
    """Write value into a table cell, keeping the first run's formatting."""
    paras = tc.findall(q('p'))
    if not paras:
        return
    first = paras[0]
    runs = first.findall(q('r'))
    keep_rpr = None
    for r in runs:
        if r.find(q('rPr')) is not None:
            keep_rpr = copy.deepcopy(r.find(q('rPr'))); break
    for r in runs:
        first.remove(r)
    for p in paras[1:]:
        tc.remove(p)
    if value:
        nr = etree.SubElement(first, q('r'))
        if keep_rpr is not None:
            nr.insert(0, keep_rpr)
        t = etree.SubElement(nr, q('t'))
        t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
        t.text = str(value)


def substitute_sentinels(root, values):
    """Replace remaining sentinels; unknown or empty -> blank (per ruling 4)."""
    pat = re.compile(re.escape(SENT_OPEN) + r'([A-Za-z0-9_]+)' + re.escape(SENT_CLOSE))
    for t in root.iter(q('t')):
        if t.text and SENT_OPEN in t.text:
            t.text = pat.sub(lambda m: str(values.get(m.group(1), '') or ''), t.text)


def cell_sentinels(tr):
    names = []
    for t in tr.iter(q('t')):
        if t.text:
            names += re.findall(re.escape(SENT_OPEN) + r'([A-Za-z0-9_]+)' + re.escape(SENT_CLOSE), t.text)
    return names


# --------------------------------------------- pass 2: clone table rows
def fill_clo_table(root, course):
    """CLO rows are grouped by NQF domain. Clone the group's model row once per
    CLO so formatting is inherited, then drop the unused template rows."""
    tbl = None
    for t in root.iter(q('tbl')):
        if any('CLO_1' in cell_sentinels(tr) for tr in t.findall(q('tr'))):
            tbl = t; break
    if tbl is None:
        return
    rows = tbl.findall(q('tr'))

    # classify: which rows are CLO slots, and which domain group they follow
    groups, current = {}, None
    for tr in rows:
        s = cell_sentinels(tr)
        clo_here = [n for n in s if re.fullmatch(r'CLO_\d+', n)]
        if clo_here:
            groups.setdefault(current, []).append(tr)
        else:
            txt = ' '.join(''.join(t.text or '' for t in tc.iter(q('t'))) for tc in tr.findall(q('tc')))
            for dom, num in NQF_GROUPS:
                if dom.lower().split(',')[0] in txt.lower():
                    current = dom
    by_dom = {}
    for clo in course.get('clos') or []:
        by_dom.setdefault(clo.get('nqf_domain'), []).append(clo)

    for dom, num in NQF_GROUPS:
        model_rows = groups.get(dom) or []
        if not model_rows:
            continue
        model = model_rows[0]
        anchor = model
        items = by_dom.get(dom) or []
        made = []
        for i, clo in enumerate(items, start=1):
            nr = copy.deepcopy(model)
            tcs = nr.findall(q('tc'))
            vals = [f'{num}.{i}',
                    clo.get('clo_text') or '',
                    plo_codes(clo),
                    join_list(clo.get('teaching_strategy')),
                    join_list(clo.get('assessment_methods'))]
            for tc, v in zip(tcs, vals):
                set_cell_text(tc, v)
            anchor.addnext(nr); anchor = nr; made.append(nr)
        if not items:                       # keep one blank row so the group reads
            nr = copy.deepcopy(model)
            for k, tc in enumerate(nr.findall(q('tc'))):
                set_cell_text(tc, f'{num}.1' if k == 0 else '')
            anchor.addnext(nr); made.append(nr)
        for tr in model_rows:
            tbl.remove(tr)


def fill_topics_table(root, course):
    tbl = None
    for t in root.iter(q('tbl')):
        if any('Top1' in cell_sentinels(tr) for tr in t.findall(q('tr'))):
            tbl = t; break
    if tbl is None:
        return
    slots = [tr for tr in tbl.findall(q('tr')) if any(re.fullmatch(r'Top\d+', n) for n in cell_sentinels(tr))]
    if not slots:
        return
    model, anchor = slots[0], slots[0]
    topics = course.get('course_topics') or []
    for tp in topics:
        nr = copy.deepcopy(model)
        tcs = nr.findall(q('tc'))
        vals = ['', tp.get('topic_title') or '', tp.get('contact_hours') or '']
        for tc, v in zip(tcs, vals):
            set_cell_text(tc, v)
        anchor.addnext(nr); anchor = nr
    if not topics:
        nr = copy.deepcopy(model)
        for tc in nr.findall(q('tc')):
            set_cell_text(tc, '')
        anchor.addnext(nr)
    for tr in slots:
        tbl.remove(tr)


# ------------------------------------------------------------ scalar values
def scalar_values(course, program):
    lab, tut, total = contact_hours(course)
    objs = course.get('course_objectives') or []
    refs = course.get('references') or []
    v = dict(CONFIG)
    v.update({
        'Course_Title':       course.get('course_title') or '',
        'Course_Code':        course.get('course_code') or '',
        'Program':            program,
        'Credit_Hours':       course.get('credit_hours') or '',
        'Type':               course.get('type') or '',
        'Level':              course.get('level') or '',
        'Year':               course.get('year') or '',
        'Course_Description': course.get('course_description') or '',
        'Prereq':             course.get('prerequisite_text') or join_list(course.get('prerequisites'), ', '),
        'Coreq':              course.get('corequisite_text') or join_list(course.get('corequisites'), ', '),
        'O1': objs[0] if len(objs) > 0 else '',
        'O2': objs[1] if len(objs) > 1 else '',
        'O3': objs[2] if len(objs) > 2 else '',
        'TotalCH':  total,
        'LabHrs':   lab or '',
        'TutHrs':   tut or '',
        'TopicHrs': course.get('total_topic_contact_hours') or '',
        'Textbook': join_list(course.get('textbooks')),
        'Ref_1': refs[0] if len(refs) > 0 else '',
        'Ref_2': refs[1] if len(refs) > 1 else '',
        'Ref_3': refs[2] if len(refs) > 2 else '',
    })
    return v


# ------------------------------------------------------------------- main
def build(course, program, workdir, outpath):
    docxml = Path(workdir) / 'word' / 'document.xml'
    tree = etree.parse(str(docxml))
    root = tree.getroot()
    flatten_merge_fields(root)
    fill_clo_table(root, course)
    fill_topics_table(root, course)
    substitute_sentinels(root, scalar_values(course, program))
    tree.write(str(docxml), xml_declaration=True, encoding='UTF-8', standalone=True)
    if os.path.exists(outpath):
        os.remove(outpath)
    subprocess.run(['zip', '-Xqr', os.path.abspath(outpath), '.'], cwd=workdir, check=True)


if __name__ == '__main__':
    code = sys.argv[1]
    out = sys.argv[2]
    data = json.load(open('/mnt/user-data/uploads/ee_curriculum.json'))
    program = data['curriculum']['program']
    course = next(c for c in data['curriculum']['courses'] if c['course_code'] == code)
    wd = Path('/home/claude/work/_build')
    if wd.exists(): shutil.rmtree(wd)
    wd.mkdir(parents=True)
    subprocess.run(['unzip', '-qo', '/mnt/user-data/uploads/EE_CS_NCAAA_Template.docx', '-d', str(wd)], check=True)
    build(course, program, wd, out)
    print('wrote', out)
