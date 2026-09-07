"""Build and independently verify a local desktop release. Standard library only."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
FORBIDDEN = {'.git', '.github', '.venv', 'venv', 'node_modules', '__pycache__',
             'scripts', 'tests', 'docs', 'packaging', 'dist', 'output', 'generated'}
EXTENSIONS = {'.html', '.css', '.js', '.json', '.png', '.svg', '.pdf', '.docx', '.woff', '.woff2'}


def release_id(value):
    if not isinstance(value, str) or not re.fullmatch(r'r[0-9]{12}', value) or value == 'r000000000000':
        raise ValueError('Invalid ReleaseId')
    return value


def safe_path(value):
    if not isinstance(value, str) or not value or '\\' in value:
        raise ValueError('Unsafe path')
    parts = value.split('/')
    for part in parts:
        if (not part or part in {'.', '..'} or part[-1:] in {' ', '.'}
                or any(ord(c) < 32 or c in '<>:"|?*' for c in part)
                or part.casefold() in FORBIDDEN or part.startswith('.')
                or re.fullmatch(r'(?i)(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?', part)):
            raise ValueError(f'Unsafe or forbidden path: {value}')
    if Path(value).suffix.lower() not in EXTENSIONS:
        raise ValueError(f'Non-runtime file: {value}')
    return value


def paths_checked(paths):
    seen = set()
    spellings = {}
    for name in paths:
        safe_path(name)
        for i in range(1, len(name.split('/')) + 1):
            prefix = '/'.join(name.split('/')[:i])
            folded = prefix.casefold()
            if folded in spellings and spellings[folded] != prefix:
                raise ValueError(f'Case-colliding path component: {prefix}')
            spellings[folded] = prefix
        key = name.casefold()
        if key in seen:
            raise ValueError(f'Duplicate/case-colliding path: {name}')
        seen.add(key)
    for key in seen:
        if any('/'.join(key.split('/')[:i]) in seen for i in range(1, len(key.split('/')))):
            raise ValueError('File/directory path collision')
    return sorted(paths)


def regular_file(root, name):
    current = root
    for part in name.split('/'):
        current = current / part
        info = current.lstat()
        if stat.S_ISLNK(info.st_mode) or getattr(info, 'st_file_attributes', 0) & 0x400:
            raise ValueError(f'Symlink/reparse point rejected: {current}')
    if not current.is_file():
        raise ValueError(f'Not a regular file: {current}')
    return current


def inventory(site):
    names = []
    for directory, dirs, files in os.walk(site, followlinks=False):
        for name in dirs + files:
            p = Path(directory) / name
            info = p.lstat()
            if stat.S_ISLNK(info.st_mode) or getattr(info, 'st_file_attributes', 0) & 0x400:
                raise ValueError('Unexpected link in output')
        names.extend((Path(directory) / name).relative_to(site).as_posix() for name in files)
    return paths_checked(names)


def record(name, data):
    return {'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf-8')


def verify_archive(archive, expected_paths=None, expected_id=None):
    with zipfile.ZipFile(archive) as z:
        infos = z.infolist()
        names = [i.filename for i in infos]
        if len(names) != len(set(names)) or names.count('release.json') != 1:
            raise ValueError('Duplicate entries or missing manifest')
        if any(i.is_dir() or i.compress_type != zipfile.ZIP_STORED or i.flag_bits & 1
               or stat.S_ISLNK(i.external_attr >> 16) for i in infos):
            raise ValueError('Unexpected archive entry type')
        if any(n != 'release.json' and not n.startswith('site/') for n in names):
            raise ValueError('Unexpected ZIP root')
        site_names = paths_checked([n[5:] for n in names if n.startswith('site/')])
        manifest = json.loads(z.read('release.json'))
        if set(manifest) != {'schema_version', 'release_id', 'entrypoint', 'files'}:
            raise ValueError('Invalid manifest fields')
        release_id(manifest['release_id'])
        if type(manifest['schema_version']) is not int or manifest['schema_version'] != 1 or manifest['entrypoint'] != 'index.html':
            raise ValueError('Invalid manifest header')
        if expected_id is not None and manifest['release_id'] != expected_id:
            raise ValueError('Wrong release identity')
        if 'index.html' not in site_names:
            raise ValueError('Missing entrypoint')
        if expected_paths is not None and site_names != sorted(expected_paths):
            raise ValueError('Unexpected/missing runtime inventory')
        entries = manifest['files']
        if not isinstance(entries, list) or any(not isinstance(e, dict) or set(e) != {'path', 'bytes', 'sha256'}
                or type(e['bytes']) is not int or e['bytes'] < 0
                or not isinstance(e['sha256'], str) or not re.fullmatch('[0-9a-f]{64}', e['sha256']) for e in entries):
            raise ValueError('Invalid inventory records')
        actual = [record(n, z.read('site/' + n)) for n in site_names]
        if entries != actual:
            raise ValueError('Archive inventory/hash/size mismatch')
        if names != ['release.json'] + ['site/' + n for n in site_names]:
            raise ValueError('Archive ordering mismatch')
        return manifest


def build(root=ROOT):
    root = Path(root).resolve()
    rid = release_id(regular_file(root, 'packaging/desktop-release-id.txt').read_text(encoding='utf-8').strip())
    allowlist = json.loads(regular_file(root, 'packaging/desktop-runtime-files.json').read_text(encoding='utf-8'))
    if not isinstance(allowlist, list) or not allowlist:
        raise ValueError('Allowlist must be a nonempty array of exact file paths')
    names = paths_checked(allowlist)
    if 'index.html' not in names:
        raise ValueError('Allowlist missing index.html')
    sources = [(n, regular_file(root, n)) for n in names]
    base = root / 'dist' / 'desktop-release'
    for p in (root / 'dist', base):
        if p.exists() or p.is_symlink():
            info = p.lstat()
            if stat.S_ISLNK(info.st_mode) or getattr(info, 'st_file_attributes', 0) & 0x400:
                raise ValueError('Output reparse point rejected')
        p.mkdir(exist_ok=True)
    destination = base / rid
    if destination.exists() or destination.is_symlink():
        raise ValueError(f'Output already exists; refusing overwrite: {destination}')
    with tempfile.TemporaryDirectory(prefix='.build-', dir=base) as temporary:
        staging = Path(temporary)
        site = staging / 'site'
        site.mkdir()
        for name, source in sources:
            target = site / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(source.read_bytes())
        if inventory(site) != names:
            raise ValueError('Unexpected staging inventory')
        manifest = {'schema_version': 1, 'release_id': rid, 'entrypoint': 'index.html',
                    'files': [record(n, (site / n).read_bytes()) for n in names]}
        (staging / 'release.json').write_bytes(json_bytes(manifest))
        archive = staging / f'cip-release-{rid}.zip'
        with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_STORED) as z:
            for name in ['release.json'] + ['site/' + n for n in names]:
                info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
                info.create_system = 3
                info.external_attr = (stat.S_IFREG | 0o644) << 16
                z.writestr(info, (staging / name).read_bytes())
        verify_archive(archive, names, rid)
        staging.rename(destination)
    return destination / archive.name


if __name__ == '__main__':
    argparse.ArgumentParser(description=__doc__).parse_args()
    result = build()
    manifest = verify_archive(result)
    print(json.dumps({'archive': str(result), 'files': len(manifest['files']),
                      'site_bytes': sum(f['bytes'] for f in manifest['files']),
                      'zip_bytes': result.stat().st_size,
                      'zip_sha256': hashlib.sha256(result.read_bytes()).hexdigest()}, indent=2))
