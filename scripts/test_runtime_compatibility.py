"""Static CSP and dependency checks for the shared web/desktop runtime.

Run: python scripts/test_runtime_compatibility.py
No build step or third-party dependencies are required.
"""
import base64
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unittest
from urllib.parse import unquote, urlsplit

import package_desktop_release as packaging

ROOT = Path(__file__).resolve().parents[1]
FILES = set(json.loads((ROOT / 'packaging/desktop-runtime-files.json').read_text(encoding='utf-8')))


class Document(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.tags = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


class RuntimeCompatibilityTests(unittest.TestCase):
    def test_report_generators_keep_external_assets(self):
        for name in ['generate_term_252_clo_report.mjs', 'generate_clo_revision_report_term_251_to_261.mjs']:
            template = (ROOT / 'scripts' / name).read_text(encoding='utf-8').split('const html = `', 1)[1]
            self.assertNotIn('unsafe-inline', template)
            for tag, attrs in Document(template).tags:
                self.assertNotEqual(tag, 'style')
                self.assertNotIn('style', attrs)
                if tag == 'script':
                    self.assertIn('src', attrs)
                if tag in {'script', 'link'}:
                    self.resolve('curriculum-vision/index.html', attrs.get('src', attrs.get('href')))

    def test_term_252_generator_in_temporary_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'data').mkdir()
            for name in ['clo_revision_audit.json', 'ee_curriculum.json', 'clo_baseline_term_251_abet.json']:
                shutil.copyfile(ROOT / 'data' / name, root / 'data' / name)
            # The Term 251-to-261 offline generator has a pre-existing editorial-data
            # validation failure; its template is covered by the static test above.
            for name in ['generate_term_252_clo_report.mjs']:
                result = subprocess.run(['node', str(ROOT / 'scripts' / name)], cwd=root, capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)
            for page in (root / 'curriculum-vision').glob('*.html'):
                for tag, attrs in Document(page.read_text(encoding='utf-8')).tags:
                    self.assertNotEqual(tag, 'style')
                    self.assertNotIn('style', attrs)
                    if tag == 'script':
                        self.assertIn('src', attrs)
                    if tag in {'script', 'link'}:
                        self.resolve('curriculum-vision/' + page.name, attrs.get('src', attrs.get('href')))

    def test_real_release_in_temporary_directory(self):
        # Exercise the actual source inventory without overwriting a generated release.
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in FILES | {'packaging/desktop-runtime-files.json', 'packaging/desktop-release-id.txt'}:
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / name, target)
            archive = packaging.build(root)
            manifest = packaging.verify_archive(archive, sorted(FILES))
            self.assertEqual(len(manifest['files']), len(FILES))
            for entry in manifest['files']:
                self.assertEqual(entry['sha256'], hashlib.sha256((ROOT / entry['path']).read_bytes()).hexdigest())

    def resolve(self, owner, target):
        url = urlsplit(target)
        self.assertFalse(url.scheme or url.netloc, (owner, target))
        if not url.path:
            return
        # portal.js rebases fetched header/footer URLs from the site root.
        base = ROOT if url.path.startswith('/') or owner in {'assets/header.html', 'assets/footer.html'} else (ROOT / owner).parent
        path = base / unquote(url.path).lstrip('/')
        if path.is_dir():
            path /= 'index.html'
        self.assertTrue(path.is_file(), (owner, target))
        self.assertIn(path.resolve().relative_to(ROOT).as_posix(), FILES, (owner, target))

    def test_all_portal_html_is_packaged(self):
        paths = list(ROOT.glob('*.html')) + list((ROOT / 'assets').glob('*.html'))
        for directory in ['undergraduate-ee', 'msc-ee', 'curriculum-vision', 'online-teaching-support']:
            paths.extend((ROOT / directory).rglob('*.html'))
        self.assertFalse({p.relative_to(ROOT).as_posix() for p in paths} - FILES)

    def test_html_policy_and_dependencies(self):
        for name in sorted(FILES):
            if not name.endswith('.html'):
                continue
            for tag, attrs in Document((ROOT / name).read_text(encoding='utf-8')).tags:
                with self.subTest(page=name, tag=tag, attrs=attrs):
                    self.assertNotIn('style', attrs)
                    self.assertFalse(any(key.startswith('on') for key in attrs))
                    self.assertNotEqual(tag, 'style')
                    if tag == 'script':
                        self.assertIn('src', attrs, 'Executable inline scripts are forbidden')
                    if attrs.get('http-equiv', '').lower() == 'content-security-policy':
                        self.assertNotRegex(attrs['content'], r"unsafe-inline|unsafe-eval|https?://|sha256-")
                    for key in ['src', 'poster']:
                        if key in attrs:
                            self.resolve(name, attrs[key])
                    if tag == 'link' and 'href' in attrs:
                        self.resolve(name, attrs['href'])
                    if tag == 'script' and 'integrity' in attrs:
                        asset = (ROOT / name).parent / attrs['src']
                        actual = 'sha512-' + base64.b64encode(hashlib.sha512(asset.read_bytes()).digest()).decode()
                        self.assertEqual(attrs['integrity'], actual)

    def test_css_and_generated_markup(self):
        for name in sorted(FILES):
            if not name.endswith(('.css', '.js')) or '/vendor/' in name:
                continue
            text = (ROOT / name).read_text(encoding='utf-8')
            with self.subTest(file=name):
                self.assertNotRegex(text, r'<style\b|<script\b|\sstyle\s*=\s*[\x22\x27]')
                self.assertNotRegex(text, r'<[^>]+\son\w+\s*=')
                self.assertNotRegex(text, r'fonts\.googleapis|fonts\.gstatic|cdnjs\.|cdn\.jsdelivr|unpkg\.')
                self.assertNotRegex(text, r'\.cssText\s*=|setAttribute\(\s*[\x22\x27]style')
                if name.endswith('.css'):
                    for target in re.findall(r'url\(\s*[\x22\x27]?([^\x22\x27\s)]+)', text):
                        self.resolve(name, target)


if __name__ == '__main__':
    unittest.main()
