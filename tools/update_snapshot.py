"""Build the special-exercise inventory: official status, plus the user's Sierra PDF."""

import argparse
import hashlib
import io
import json
import re
import urllib.request
from datetime import datetime
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
STATES = {'未售': 'available', '已選': 'picked', '已售': 'picked'}


def parse_status(text: str, estate: str) -> tuple[dict, str]:
    dates = re.findall(r'最後更新日期:\s*(\d+)年(\d+)月(\d+)日', text)
    date_values = {datetime(*map(int, d)).date().isoformat() for d in dates}
    if len(date_values) != 1:
        raise ValueError(f'{estate}: missing or mixed official update dates')
    result = {}
    sections = re.findall(r'發展項目/屋苑:\s*(\S+)([^\n]*)(.*?)(?=宏福苑業主「特設銷售計劃」|\Z)', text, re.S)
    if not sections:
        raise ValueError(f'{estate}: missing estate sections')
    for name, tail, body in sections:
        if name != estate:
            raise ValueError(f'Expected {estate}, got {name}')
        block_match = re.search(r'(?:第)?([\dA-Z]+)座', tail)
        block = block_match[1] if block_match and estate not in ('欣雅苑', '曉雅苑') else '-'
        count_match = re.search(r'剩餘單位數目:\s*(\d+)', body)
        if not count_match:
            raise ValueError(f'{estate}: missing remaining count')
        available_count = 0
        for label in STATES:
            for part in re.findall(r'以下為' + label + r'單位:(.*?)(?=以下為|\Z)', body, re.S):
                for floor, unit in re.findall(r'(\d+)樓單位([A-Z\d]+)', part):
                    key = (block, int(floor), unit)
                    if key in result:
                        raise ValueError(f'{estate}: duplicate or conflicting status {key}')
                    result[key] = label
                    available_count += label == '未售'
        if available_count != int(count_match[1]):
            raise ValueError(f'{estate} {block}: remaining count does not match listed flats')
    return result, date_values.pop()


def read_source(source: dict, source_dir: Path | None) -> bytes:
    if source_dir:
        raw = (source_dir / source['file']).read_bytes()
    else:
        request = urllib.request.Request(source['url'], headers={'User-Agent': 'wangfuk-court public-data-check'})
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read()
    if not raw.startswith(b'%PDF'):
        raise ValueError(f"Not a PDF: {source['url']}")
    return raw


def import_sierra_pdf(path: Path, inventory: list) -> dict:
    raw = path.read_bytes()
    with pdfplumber.open(io.BytesIO(raw)) as pdf:
        text = '\n'.join(page.extract_text() or '' for page in pdf.pages)
    entries = re.findall(r'\d+月\d+日 樂嶺軒 - (\d+) ([ABC]\d)\b', text)
    ids = [f"樂嶺軒-{'-'}-{int(floor)}-{unit}" for floor, unit in entries]
    allowed = {f['id'] for f in inventory if f['estate'] == '樂嶺軒'}
    date_match = re.search(r'\d{8}', path.stem)
    if not ids or len(set(ids)) != len(ids) or not set(ids) <= allowed or not date_match:
        raise ValueError('Invalid Sierra selections or missing YYYYMMDD in PDF filename')
    return dict(sourceName=path.name, sha256=hashlib.sha256(raw).hexdigest(), asOf=datetime.strptime(date_match[0], '%Y%m%d').date().isoformat(), pickedIds=sorted(ids))


def validate_snapshot(snapshot: dict) -> None:
    flats = snapshot['flats']
    if len(flats) != snapshot['initialCount'] or len({f['id'] for f in flats}) != len(flats):
        raise ValueError('Full inventory must contain unique flat IDs')
    for f in flats:
        if f['status'] not in ('available', 'picked') or f['source'] not in ('official', 'user-pdf') or not all(isinstance(f[k], (int, float)) and f[k] > 0 for k in ('floor', 'sqft', 'sqm', 'price')):
            raise ValueError(f'Invalid flat: {f}')
        if (f['source'] == 'user-pdf') != (f['estate'] == '樂嶺軒'):
            raise ValueError('Unexpected status source')
    for estate in snapshot['estates']:
        rows = [f for f in flats if f['estate'] == estate['name']]
        if len(rows) != estate['initial']:
            raise ValueError('Estate inventory count mismatch')
        for state in ('available', 'picked'):
            if estate[state] != sum(f['status'] == state for f in rows):
                raise ValueError('Estate status count mismatch')
    if sum(e['initial'] for e in snapshot['estates']) != snapshot['initialCount']:
        raise ValueError('Initial totals do not match')


def build_snapshot(inventory: list, config: dict, records: dict, as_of: str) -> dict:
    flats = [dict(f, **records[f['id']]) for f in inventory]
    estates = [dict(name=name, district=district, initial=sum(f['estate'] == name for f in flats), **{state: sum(f['estate'] == name and f['status'] == state for f in flats) for state in ('available', 'picked')}) for name, district in config['districts'].items()]
    snapshot = dict(schemaVersion=2, asOf=as_of, initialCount=len(inventory), estates=estates, flats=flats, sources=config['links'], note=f'只包括宏福苑特設銷售計劃的{len(inventory):,}伙供選範圍，並非各屋苑全部單位。其他九個項目以官方狀態表為準；樂嶺軒按使用者提供的已選PDF判定，來源日期逐伙顯示。')
    validate_snapshot(snapshot)
    return snapshot


def refresh(source_dir: Path | None, sierra_pdf: Path | None = None) -> None:
    config = json.loads((ROOT / 'data/sources.json').read_text(encoding='utf-8'))
    inventory = json.loads((ROOT / 'data/inventory.json').read_text(encoding='utf-8'))
    sierra = import_sierra_pdf(sierra_pdf, inventory) if sierra_pdf else json.loads((ROOT / 'data/sierra-selections.json').read_text(encoding='utf-8'))
    by_key = {(f['estate'], f['block'], f['floor'], f['unit']): f for f in inventory}
    if len(by_key) != len(inventory):
        raise ValueError('Duplicate initial inventory')
    records, provenance, dates = {}, [], set()
    for source in config['statusSources']:
        raw = read_source(source, source_dir)
        with pdfplumber.open(io.BytesIO(raw)) as pdf:
            text = '\n'.join(page.extract_text() or '' for page in pdf.pages)
        statuses, as_of = parse_status(text, source['estate'])
        dates.add(as_of)
        for (block, floor, unit), label in statuses.items():
            key = (source['estate'], block, floor, unit)
            if key not in by_key or by_key[key]['id'] in records:
                raise ValueError(f'Unknown or duplicate flat {key}')
            records[by_key[key]['id']] = dict(status=STATES[label], sourceStatus=label, source='official', asOf=as_of)
        provenance.append(dict(source, asOf=as_of, listed=len(statuses), available=sum(s == '未售' for s in statuses.values()), sha256=hashlib.sha256(raw).hexdigest()))
    expected = {f['id'] for f in inventory if f['estate'] != '樂嶺軒'}
    if set(records) != expected:
        raise ValueError('Official status lists do not cover the full non-Sierra inventory')
    allowed = {f['id'] for f in inventory if f['estate'] == '樂嶺軒'}
    picked = set(sierra['pickedIds'])
    if len(picked) != len(sierra['pickedIds']) or not picked <= allowed:
        raise ValueError('User PDF selections are outside Sierra special-exercise inventory')
    datetime.fromisoformat(sierra['asOf'])
    for flat_id in allowed:
        confirmed = flat_id in picked
        records[flat_id] = dict(status='picked' if confirmed else 'available', sourceStatus='PDF已選' if confirmed else '按PDF扣除', source='user-pdf', asOf=sierra['asOf'])
    provenance.append(dict(estate='樂嶺軒', source='user-pdf', sourceName=sierra['sourceName'], asOf=sierra['asOf'], picked=len(picked), available=len(allowed - picked), sha256=sierra['sha256']))
    if len(dates) != 1:
        raise ValueError(f'Official sources have mixed dates {dates}; review update times')
    snapshot = build_snapshot(inventory, config, records, dates.pop())
    target = ROOT / 'docs/data/snapshot.json'
    previous = json.loads(target.read_text(encoding='utf-8')) if target.exists() else None
    if previous and snapshot['asOf'] < previous['asOf']:
        raise ValueError('Refusing an older snapshot')
    temporary = target.with_suffix('.tmp')
    temporary.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    temporary.replace(target)
    if sierra_pdf:
        (ROOT / 'data/sierra-selections.json').write_text(json.dumps(sierra, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (ROOT / 'data/provenance.json').write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"Validated special-exercise inventory: {len(inventory)} flats; " + ', '.join(f'{s}={sum(f["status"] == s for f in snapshot["flats"])}' for s in ('available', 'picked')))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, help='Replay official PDFs instead of downloading')
    parser.add_argument('--sierra-pdf', type=Path, help='Import a new user-supplied selected-flats PDF with YYYYMMDD in its filename')
    args = parser.parse_args()
    refresh(args.source_dir, args.sierra_pdf)
