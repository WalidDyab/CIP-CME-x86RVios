"""Read-only, standard-library reader for the QAC SO assessment workbooks.

It exposes exactly what is stored in the .xlsx package (strings, formulas,
merged ranges, data validations, cell comments, sheet state) and never
writes a workbook. It is shared by the rubric generator and the validation tests.
"""
from __future__ import annotations

import hashlib
import posixpath
import re
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET

NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
NS_X14 = 'http://schemas.microsoft.com/office/spreadsheetml/2009/9/main'
NS_XM = 'http://schemas.microsoft.com/office/excel/2006/main'
M = '{%s}' % NS_MAIN
R = '{%s}' % NS_REL
P = '{%s}' % NS_PKG_REL
X14 = '{%s}' % NS_X14
XM = '{%s}' % NS_XM
CELL_RE = re.compile(r'^([A-Z]{1,3})([1-9][0-9]*)$')
RANGE_RE = re.compile(r'^([A-Z]{1,3})([1-9][0-9]*)(?::([A-Z]{1,3})([1-9][0-9]*))?$')


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b''):
            digest.update(chunk)
    return digest.hexdigest()


def col_to_num(col):
    n = 0
    for ch in col:
        n = n * 26 + ord(ch) - 64
    return n


def num_to_col(n):
    out = ''
    while n:
        n, rem = divmod(n - 1, 26)
        out = chr(65 + rem) + out
    return out


def split_cell(ref):
    m = CELL_RE.match(ref)
    if not m:
        raise ValueError('Not a single-cell reference: %r' % ref)
    return col_to_num(m.group(1)), int(m.group(2))


def split_range(ref):
    """Return (col1, row1, col2, row2) for 'A1' or 'A1:C3'."""
    m = RANGE_RE.match(ref)
    if not m:
        raise ValueError('Not a cell or range reference: %r' % ref)
    c1, r1 = col_to_num(m.group(1)), int(m.group(2))
    if m.group(3):
        return c1, r1, col_to_num(m.group(3)), int(m.group(4))
    return c1, r1, c1, r1


def _text(node):
    """Concatenate <t> text of a shared/inline string, ignoring phonetic runs."""
    if node is None:
        return ''
    parts = []
    for child in node:
        if child.tag == M + 't':
            parts.append(child.text or '')
        elif child.tag == M + 'r':
            for t in child.findall(M + 't'):
                parts.append(t.text or '')
    return ''.join(parts)


class Sheet:
    def __init__(self, name, state, path, workbook):
        self.name = name
        self.state = state
        self.path = path
        self.workbook = workbook
        self._root = None
        self._cells = None

    @property
    def root(self):
        if self._root is None:
            self._root = ET.fromstring(self.workbook.zip.read(self.path))
        return self._root

    @property
    def cells(self):
        """Mapping ref -> {'value', 'formula', 'type', 'style'} for non-empty cells."""
        if self._cells is None:
            cells = {}
            for c in self.root.iter(M + 'c'):
                ref = c.get('r')
                t = c.get('t', 'n')
                v = c.find(M + 'v')
                f = c.find(M + 'f')
                if t == 's' and v is not None:
                    value = self.workbook.shared_strings[int(v.text)]
                elif t == 'inlineStr':
                    value = _text(c.find(M + 'is'))
                elif v is not None and v.text is not None:
                    value = v.text if t in ('str', 'e') else self._number(v.text, t)
                else:
                    value = None
                formula = None
                if f is not None:
                    formula = f.text if f.text else ('<shared:%s>' % f.get('si') if f.get('t') == 'shared' else '')
                if value is None and formula is None:
                    continue
                cells[ref] = {'value': value, 'formula': formula, 'type': t, 'style': c.get('s')}
            self._cells = cells
        return self._cells

    @staticmethod
    def _number(text, t):
        if t == 'b':
            return text == '1'
        try:
            number = float(text)
        except ValueError:
            return text
        return int(number) if number.is_integer() else number

    def value(self, ref):
        cell = self.cells.get(ref)
        return None if cell is None else cell['value']

    def formula(self, ref):
        cell = self.cells.get(ref)
        return None if cell is None else cell['formula']

    @property
    def dimension(self):
        """Declared <dimension>, else the extent of non-empty cells and merged ranges."""
        node = self.root.find(M + 'dimension')
        if node is not None:
            return node.get('ref')
        max_col = max_row = 1
        for ref in self.cells:
            col, row = split_cell(ref)
            max_col, max_row = max(max_col, col), max(max_row, row)
        for rng in self.merged:
            _, _, c2, r2 = split_range(rng)
            max_col, max_row = max(max_col, c2), max(max_row, r2)
        return 'A1:%s%d' % (num_to_col(max_col), max_row)

    @property
    def merged(self):
        merges = self.root.find(M + 'mergeCells')
        return [] if merges is None else [m.get('ref') for m in merges.findall(M + 'mergeCell')]

    @property
    def protected(self):
        return self.root.find(M + 'sheetProtection') is not None

    @property
    def data_validations(self):
        out = []
        for dv in self.root.iter(M + 'dataValidation'):
            f1 = dv.find(M + 'formula1')
            out.append({'sqref': dv.get('sqref'), 'type': dv.get('type'),
                        'formula1': None if f1 is None else f1.text, 'extension': False})
        for dv in self.root.iter(X14 + 'dataValidation'):
            f1 = dv.find(X14 + 'formula1')
            f = None if f1 is None else f1.find(XM + 'f')
            sq = dv.find(XM + 'sqref')
            out.append({'sqref': None if sq is None else sq.text, 'type': dv.get('type'),
                        'formula1': None if f is None else f.text, 'extension': True})
        return out

    @property
    def comments(self):
        """Mapping ref -> comment text (legacy cell comments)."""
        rels = self.workbook.rels_for(self.path)
        out = {}
        for rel in rels:
            if rel['type'].endswith('/comments'):
                root = ET.fromstring(self.workbook.zip.read(rel['target']))
                for c in root.iter(M + 'comment'):
                    out[c.get('ref')] = ''.join(t.text or '' for t in c.iter(M + 't'))
        return out

    def merged_range_for(self, ref):
        col, row = split_cell(ref)
        for rng in self.merged:
            c1, r1, c2, r2 = split_range(rng)
            if c1 <= col <= c2 and r1 <= row <= r2:
                return rng
        return None

    def range_values(self, ref):
        c1, r1, c2, r2 = split_range(ref)
        return {num_to_col(c) + str(r): self.value(num_to_col(c) + str(r))
                for r in range(r1, r2 + 1) for c in range(c1, c2 + 1)
                if self.value(num_to_col(c) + str(r)) is not None}

    def formulas_in(self, ref):
        c1, r1, c2, r2 = split_range(ref)
        return {num_to_col(c) + str(r): self.formula(num_to_col(c) + str(r))
                for r in range(r1, r2 + 1) for c in range(c1, c2 + 1)
                if self.formula(num_to_col(c) + str(r))}


class Workbook:
    def __init__(self, path):
        self.path = Path(path)
        self.zip = ZipFile(self.path)
        self._shared = None
        self.sheets = self._load_sheets()

    def close(self):
        self.zip.close()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()

    @property
    def shared_strings(self):
        if self._shared is None:
            self._shared = []
            if 'xl/sharedStrings.xml' in self.zip.namelist():
                root = ET.fromstring(self.zip.read('xl/sharedStrings.xml'))
                self._shared = [_text(si) for si in root.findall(M + 'si')]
        return self._shared

    def rels_for(self, part):
        folder, name = posixpath.split(part)
        rel_path = posixpath.join(folder, '_rels', name + '.rels')
        if rel_path not in self.zip.namelist():
            return []
        root = ET.fromstring(self.zip.read(rel_path))
        out = []
        for rel in root.findall(P + 'Relationship'):
            target = rel.get('Target')
            if rel.get('TargetMode') != 'External':
                target = posixpath.normpath(target[1:] if target.startswith('/') else posixpath.join(folder, target))
            out.append({'id': rel.get('Id'), 'type': rel.get('Type'), 'target': target,
                        'external': rel.get('TargetMode') == 'External'})
        return out

    def _load_sheets(self):
        root = ET.fromstring(self.zip.read('xl/workbook.xml'))
        targets = {r['id']: r['target'] for r in self.rels_for('xl/workbook.xml')}
        sheets = []
        for s in root.find(M + 'sheets').findall(M + 'sheet'):
            sheets.append(Sheet(s.get('name'), s.get('state', 'visible'), targets[s.get(R + 'id')], self))
        return sheets

    def sheet(self, name):
        for s in self.sheets:
            if s.name == name:
                return s
        raise KeyError('No worksheet named %r in %s' % (name, self.path.name))

    @property
    def sheet_names(self):
        return [s.name for s in self.sheets]

    @property
    def properties(self):
        out = {}
        if 'docProps/core.xml' in self.zip.namelist():
            root = ET.fromstring(self.zip.read('docProps/core.xml'))
            for child in root:
                out[child.tag.split('}')[1]] = child.text
        return out

    @property
    def defined_names(self):
        root = ET.fromstring(self.zip.read('xl/workbook.xml'))
        names = root.find(M + 'definedNames')
        return [] if names is None else [{'name': d.get('name'), 'ref': d.text} for d in names.findall(M + 'definedName')]

    @property
    def external_links(self):
        out = []
        for rel in self.rels_for('xl/workbook.xml'):
            if rel['type'].endswith('/externalLink'):
                for inner in self.rels_for(rel['target']):
                    out.append(inner['target'])
        return out
