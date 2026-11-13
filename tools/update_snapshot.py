"""Refresh remaining flats from official PDFs, preserving Sierra's dated estimate."""

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


def parse_status(text: str, estate: str) -> tuple[set[tuple[str, int, str]], str]:
    """Read only Chinese unsold sections; reject partial, duplicate or wrong PDFs."""
    dates = re.findall(r'最後更新日期:\s*(\d+)年(\d+)月(\d+)日', text)
    if not dates:
        raise ValueError(f'{estate}: missing official update date')
    date_values = {datetime(*map(int, d)).date().isoformat() for d in dates}
    if len(date_values) != 1:
        raise ValueError(f'{estate}: mixed update dates')
    available: set[tuple[str, int, str]] = set()
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
        count = int(count_match[1])
        match = re.search(r'以下為未售單位:(.*?)(?=以下為|\Z)', body, re.S)
        entries = re.findall(r'(\d+)樓單位([A-Z\d]+)', match[1]) if match else []
        keys = {(block, int(floor), unit) for floor, unit in entries}
        if len(entries) != count or len(keys) != count or available & keys:
            raise ValueError(f'{estate} {block}: listed flats do not match remaining count {count}')
        available |= keys
    return available, date_values.pop()


def validate_snapshot(snapshot: dict) -> None:
    flats = snapshot['flats']
    if len({f['id'] for f in flats}) != len(flats):
        raise ValueError('Duplicate flat IDs')
    for f in flats:
        if f['verification'] not in ('official', 'estimated') or not all(isinstance(f[k], (int, float)) and f[k] > 0 for k in ('floor', 'sqft', 'sqm', 'price')):
            raise ValueError(f'Invalid flat: {f}')
        if f['verification'] == 'estimated' and f['estate'] != '樂嶺軒':
            raise ValueError('Unexpected estimated estate')
    for estate in snapshot['estates']:
        if estate['remaining'] != sum(f['estate'] == estate['name'] for f in flats) or not 0 <= estate['remaining'] <= estate['initial']:
            raise ValueError(f'Invalid estate total: {estate}')
    if sum(e['initial'] for e in snapshot['estates']) != snapshot['initialCount']:
        raise ValueError('Initial totals do not match')


def build_snapshot(inventory: list[dict], config: dict, remaining: list[dict], as_of: str) -> dict:
    estates = [dict(name=name, district=district, initial=sum(f['estate'] == name for f in inventory), remaining=sum(f['estate'] == name for f in remaining)) for name, district in config['districts'].items()]
    snapshot = dict(schemaVersion=1, asOf=as_of, initialCount=len(inventory), estates=estates, flats=remaining, sources=config['links'], note='樂嶺軒推算基準為2026-11-12；其他九個項目的基準日期見頁頂。未核實已選彙編內每個選樓日期、估值及印花稅。')
    validate_snapshot(snapshot)
    return snapshot


def refresh(source_dir: Path | None) -> None:
    config = json.loads((ROOT / 'data/sources.json').read_text(encoding='utf-8'))
    inventory = json.loads((ROOT / 'data/inventory.json').read_text(encoding='utf-8'))
    sierra = json.loads((ROOT / 'data/sierra-baseline.json').read_text(encoding='utf-8'))
    by_key = {(f['estate'], f['block'], f['floor'], f['unit']): f for f in inventory}
    if len(by_key) != len(inventory):
        raise ValueError('Duplicate initial inventory')
    remaining, provenance, dates, seen = [], [], set(), set()
    for source in config['statusSources']:
        if source_dir:
            raw = (source_dir / source['file']).read_bytes()
        else:
            request = urllib.request.Request(source['url'], headers={'User-Agent': 'wangfuk-court public-data-check'})
            with urllib.request.urlopen(request, timeout=30) as response:
                raw = response.read()
        if not raw.startswith(b'%PDF'):
            raise ValueError(f"Not a PDF: {source['url']}")
        with pdfplumber.open(io.BytesIO(raw)) as pdf:
            text = '\n'.join(page.extract_text() or '' for page in pdf.pages)
        keys, as_of = parse_status(text, source['estate'])
        dates.add(as_of)
        for block, floor, unit in sorted(keys):
            key = (source['estate'], block, floor, unit)
            if key not in by_key or key in seen:
                raise ValueError(f'Unknown or duplicate flat {key}; review original inventory')
            seen.add(key)
            remaining.append(dict(by_key[key], verification='official', asOf=as_of))
        provenance.append(dict(source, asOf=as_of, remaining=len(keys), sha256=hashlib.sha256(raw).hexdigest()))
    if len(dates) != 1:
        raise ValueError(f'Official files have mixed dates {dates}; retry after all estates update')
    remaining += sierra
    for flat in sierra:
        if flat['id'] not in {f['id'] for f in inventory if f['estate'] == '樂嶺軒'} or flat['verification'] != 'estimated':
            raise ValueError('Invalid Sierra baseline')
    snapshot = build_snapshot(inventory, config, remaining, dates.pop())
    target = ROOT / 'docs/data/snapshot.json'
    previous = json.loads(target.read_text(encoding='utf-8')) if target.exists() else None
    if previous and snapshot['asOf'] < previous['asOf']:
        raise ValueError('Refusing an older snapshot')
    # Replace only after every official source and inventory key has passed validation.
    temporary = target.with_suffix('.tmp')
    temporary.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    temporary.replace(target)
    (ROOT / 'data/provenance.json').write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"Validated snapshot: {snapshot['asOf']}, {len(remaining)} remaining flats ({len(sierra)} dated Sierra estimates)")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, help='Replay a folder of official PDFs instead of downloading')
    args = parser.parse_args()
    refresh(args.source_dir)
