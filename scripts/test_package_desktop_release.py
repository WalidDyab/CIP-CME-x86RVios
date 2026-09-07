"""Run with python -B -m unittest discover -s scripts -p test_package_desktop_release.py."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile
import unittest
from urllib.parse import unquote, urlsplit
import zipfile

import package_desktop_release as builder


class PackagingTests(unittest.TestCase):
    def fixture(self, root):
        (root / 'packaging').mkdir()
        names = ['資料/مراجع.json', 'index.html', 'assets/example.css']
        for name in names:
            p = root / name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(('content: ' + name).encode('utf-8'))
        (root / 'packaging/desktop-runtime-files.json').write_text(json.dumps(names), encoding='utf-8')
        (root / 'packaging/desktop-release-id.txt').write_text('r000000000001\n', encoding='utf-8')
        return names

    def test_release_ids(self):
        for value in ['r000000000001', 'r999999999999']:
            self.assertEqual(builder.release_id(value), value)
        for value in ['r000000000000', 'r1', 'R000000000001', 'r0000000000010',
                      'r00000000000x', 'r٠٠٠٠٠٠٠٠٠٠٠١', '../r000000000001', '', None]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                builder.release_id(value)

    def test_paths(self):
        for value in ['../index.html', '/index.html', 'C:/index.html', 'a\\index.html',
                      'a//b.js', './index.html', 'a./b.js', 'a /b.js', 'NUL.json',
                      'scripts/a.js', '.git/config.json', 'output/a.json', 'a:stream.json',
                      'a\x00.json', 'source.xlsx', '.env.json']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                builder.paths_checked([value])
        for names in [['a.js', 'a.js'], ['a.js', 'A.JS'], ['a.json', 'a.json/b.js'], ['Assets/a.js', 'assets/b.js']]:
            with self.assertRaises(ValueError):
                builder.paths_checked(names)

    def test_deterministic_build_and_inventory(self):
        archives = []
        for _ in range(2):
            with tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                names = self.fixture(root)
                archive = builder.build(root)
                archives.append(archive.read_bytes())
                manifest = builder.verify_archive(archive, names, 'r000000000001')
                self.assertEqual([e['path'] for e in manifest['files']], sorted(names))
                for entry in manifest['files']:
                    data = (root / entry['path']).read_bytes()
                    self.assertEqual(entry['bytes'], len(data))
                    self.assertEqual(entry['sha256'], hashlib.sha256(data).hexdigest())
                    self.assertEqual((archive.parent / 'site' / entry['path']).read_bytes(), data)
                with zipfile.ZipFile(archive) as z:
                    self.assertEqual(z.namelist(), ['release.json'] + ['site/' + n for n in sorted(names)])
                    self.assertTrue(all(i.date_time == (1980, 1, 1, 0, 0, 0) for i in z.infolist()))
                with self.assertRaises(ValueError):
                    builder.build(root)
        self.assertEqual(*archives)

    def test_missing_source(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            (root / 'index.html').unlink()
            with self.assertRaises(FileNotFoundError):
                builder.build(root)

    def test_symlink_source(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            (root / 'index.html').unlink()
            try:
                (root / 'index.html').symlink_to(root / 'assets/example.css')
            except OSError:
                self.skipTest('OS does not permit symlink creation')
            with self.assertRaises(ValueError):
                builder.build(root)

    def test_tampered_archives(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            names = self.fixture(root)
            archive = builder.build(root)
            with zipfile.ZipFile(archive) as z:
                original = [(n, z.read(n)) for n in z.namelist()]
            cases = [original + [('unexpected.json', b'{}')],
                     [('r000000000001/' + n, d) for n, d in original],
                     original + [('site/scripts/a.js', b'')],
                     original + [('site/../escape.json', b'')],
                     original + [('site/INDEX.HTML', b'')],
                     original + [('site/index.html', b'duplicate')],
                     [(n, b'changed' if n == 'site/index.html' else d) for n, d in original],
                     [(n, d) for n, d in original if n != 'site/index.html']]
            for i, entries in enumerate(cases):
                bad = root / f'bad{i}.zip'
                with zipfile.ZipFile(bad, 'w') as z:
                    for n, d in entries:
                        z.writestr(n, d)
                with self.subTest(case=i), self.assertRaises(ValueError):
                    builder.verify_archive(bad, names)
            (archive.parent / 'site/extra.json').write_text('{}', encoding='utf-8')
            self.assertNotEqual(builder.inventory(archive.parent / 'site'), sorted(names))

    def test_real_allowlist_and_dependencies(self):
        root = builder.ROOT
        names = json.loads((root / 'packaging/desktop-runtime-files.json').read_text(encoding='utf-8'))
        self.assertEqual(names, builder.paths_checked(names))
        for name in names:
            builder.regular_file(root, name)
        # Shared fragments resolve relative to portal root after portal.js rewrites them.
        for name in names:
            if not name.endswith('.html'):
                continue
            base = root if name in ['assets/header.html', 'assets/footer.html'] else (root / name).parent
            text = (root / name).read_text(encoding='utf-8')
            for value in re.findall(r'\b(?:href|src|data-baseline|data-audit|data-curriculum|data-template)="([^"]+)"', text):
                if '${' in value or value.startswith('#') or urlsplit(value).scheme:
                    continue
                local = unquote(urlsplit(value).path)
                if local:
                    if local.endswith('/'):
                        local += 'index.html'
                    target = (base / local).resolve().relative_to(root).as_posix()
                    self.assertIn(target, names, (name, value))
        for name in names:
            if name.endswith(('.js', '.html')):
                text = (root / name).read_text(encoding='utf-8')
                for target in re.findall(r'\.\./((?:data|templates)/[^\x22\x27<>]+\.(?:json|docx))', text):
                    self.assertIn(target, names, (name, target))
        nqf = json.loads((root / 'data/nqf_2026_alignment.json').read_text(encoding='utf-8'))
        for source in nqf['sources']:
            self.assertIn('curriculum-vision/' + source['href'], names)
        ignored = subprocess.run(['git', 'check-ignore', 'dist/desktop-release/r000000000001/cip-release-r000000000001.zip'], cwd=root, capture_output=True)
        self.assertEqual(ignored.returncode, 0)


if __name__ == '__main__':
    unittest.main()
