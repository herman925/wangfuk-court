"""Import authorized public Lightview project bundles without expanding our inventory."""

import argparse
import hashlib
import json
import math
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

try:
    from tools.netfetch import fetch_bytes
except ImportError:  # executed directly as `python tools/import_lightview.py`
    from netfetch import fetch_bytes

ROOT = Path(__file__).resolve().parents[1]
PROJECTS = {'啟陽苑': 'kai-yeung-court', '裕豐苑': 'yu-fung-court', '灝然': 'hemma-sapphire'}


def validate_refresh(output: dict, previous: dict | None) -> None:
    if not output['flats'] or any(project['matched'] == 0 for project in output['projects'].values()):
        raise ValueError('Empty Lightview coverage; inspect changed source format')
    if previous and not set(previous['flats']) <= set(output['flats']):
        raise ValueError('Lightview coverage decreased; review removed or changed flat models')
    for slug, project in output['projects'].items():
        old_dates = previous['projects'][slug]['dataDate'] if previous else {}
        if not old_dates.keys() <= project['dataDate'].keys():
            raise ValueError(f'Missing Lightview model dates: {slug}')
        for name, value in project['dataDate'].items():
            datetime.strptime(value, '%Y-%m-%d')
            old = old_dates.get(name)
            if old and value < old:
                raise ValueError(f'Refusing older Lightview {slug} {name}')


def extract_bundle(html: str, slug: str) -> dict:
    """Decode Next.js streamed JSON without executing downloaded JavaScript."""
    stream = ''
    for script in re.findall(r'<script[^>]*>(.*?)</script>', html, re.S):
        match = re.fullmatch(r'self\.__next_f\.push\((.*)\)', script, re.S)
        if match:
            record = json.loads(match[1])
            if record[0] == 1:
                stream += record[1]
    marker = '"bundle":'
    if marker not in stream:
        raise ValueError('Lightview bundle not found; inspect changed page format')
    bundle, _ = json.JSONDecoder().raw_decode(stream[stream.index(marker) + len(marker):])
    if bundle.get('id') != slug or bundle.get('project', {}).get('schema') != 1 or bundle.get('metrics', {}).get('schema') != 1:
        raise ValueError('Unexpected Lightview identity or schema')
    return bundle


def validate_access(bundle: dict, estate: str, *, legacy_replay=False) -> None:
    """Validate the publisher's two access maps against the project they describe."""
    project = bundle['project']
    if project['site']['nameZh'] != estate:
        raise ValueError('Unexpected Lightview estate')
    towers = {t['id']: t for t in project['towers']}
    if len(towers) != len(project['towers']):
        raise ValueError('Duplicate Lightview tower')
    # Older full public bundles had neither access map. They never justify a loss.
    if legacy_replay and 'open' not in bundle and 'openFlats' not in bundle:
        return
    if 'open' not in bundle or 'openFlats' not in bundle:
        raise ValueError('Missing Lightview access declaration')
    floors, exceptions = bundle['open'], bundle['openFlats']
    if floors is not None and (not isinstance(floors, dict) or floors.keys() != towers.keys()):
        raise ValueError('Invalid Lightview public floor map')
    if not isinstance(exceptions, dict) or not exceptions.keys() <= towers.keys():
        raise ValueError('Invalid Lightview public flat map')
    for key, tower in towers.items():
        labels = {f['label'] for f in tower['floors']}
        units = {f['id'] for f in tower['flats']}
        if len(labels) != len(tower['floors']) or len(units) != len(tower['flats']):
            raise ValueError(f'Duplicate model identity: {key}')
        if floors is not None and (not isinstance(floors[key], list) or not set(floors[key]) <= labels):
            raise ValueError(f'Invalid public floors: {key}')
        entries = exceptions.get(key, [])
        if not isinstance(entries, list):
            raise ValueError(f'Invalid public flats: {key}')
        for entry in entries:
            if not isinstance(entry, str):
                raise ValueError(f'Invalid public flat identity: {key}')
            unit, separator, floor = entry.partition('@')
            if unit not in units or (separator and floor not in labels):
                raise ValueError(f'Unknown public flat: {key} {entry}')
        by_floor = bundle['metrics']['windows'].get(key, {})
        for floor, by_unit in by_floor.items():
            if floor not in labels or not by_unit.keys() <= units:
                raise ValueError(f'Unknown metrics identity: {key} {floor}')
            for unit in by_unit:
                if not is_public(bundle, key, floor, unit):
                    raise ValueError(f'Metrics outside declared public scope: {key} {floor} {unit}')
    if not bundle['metrics']['windows'].keys() <= towers.keys():
        raise ValueError('Unknown Lightview metrics tower')


def is_public(bundle: dict, tower: str, floor: str, unit: str) -> bool:
    if bundle.get('open') is None or floor in bundle['open'][tower]:
        return True
    exceptions = bundle['openFlats'].get(tower, [])
    return unit in exceptions or f'{unit}@{floor}' in exceptions


def enrich_flat(flat: dict, bundle: dict, old=None, captured_at=None) -> tuple[dict | None, str | None]:
    tower_id = 'T' + flat['block'] if flat['estate'] == '灝然' else flat['block']
    tower = next((t for t in bundle['project']['towers'] if t['id'] == tower_id), None)
    model = next((f for f in tower['flats'] if f['id'] == flat['unit']), None) if tower else None
    label = str(flat['floor'])
    floor = next((f for f in tower['floors'] if f['label'] == label), None) if tower else None
    metrics = bundle['metrics']['windows'].get(tower_id, {}).get(label, {}).get(flat['unit'])
    if not model or not floor or (not metrics and floor['plan'] != 'typical'):
        return None, 'Lightview未涵蓋此單位或樓層'
    # shortcut: use the typical-flat geometry only when its area agrees; review floor-specific models before relaxing this gate.
    area = model['saleableAreaSqm']
    if type(area) not in (int, float) or not math.isfinite(area):
        raise ValueError(f'Invalid Lightview area: {flat["id"]}')
    if abs(flat['sqm'] - area) > 0.15:
        return None, 'Lightview面積與官方價單不符'
    url = f'https://lightview.app/{bundle["id"]}?t={tower_id}&f={label}&u={flat["unit"]}'
    if old and (old['project'] != bundle['id'] or old['sourceUrl'] != url):
        raise ValueError(f'Changed Lightview identity: {flat["id"]}')
    if not is_public(bundle, tower_id, label, flat['unit']):
        if old:
            if floor['floorMpd'] != old['floorMpd'] or any(model[k] != old[k] for k in ('living', 'outline')):
                raise ValueError(f'Changed historical flat model: {flat["id"]}')
            return {**old, 'coverage': 'historical'}, None
        return None, 'Lightview未涵蓋此單位或樓層'
    if not metrics:
        return None, 'Lightview未涵蓋此單位或樓層'
    for season in ('summer', 'equinox', 'winter'):
        sun = metrics['sun'][season]
        if not all(type(sun[k]) in (int, float) and 0 <= sun[k] <= 24 for k in ('hours', 'morningHours', 'afternoonHours')):
            raise ValueError(f'Invalid sun values: {flat["id"]}')
        if abs(sun['hours'] - sun['morningHours'] - sun['afternoonHours']) > 0.21:
            raise ValueError(f'Inconsistent sun totals: {flat["id"]}')
    view = metrics['view']
    keys = ('skyPct', 'waterPct', 'greeneryPct', 'buildingPct', 'otherPct')
    if not all(type(view[k]) in (int, float) and 0 <= view[k] <= 100 for k in keys) or abs(sum(view[k] for k in keys) - 100) > 0.6:
        raise ValueError(f'Invalid view shares: {flat["id"]}')
    pano = bundle['panos']['panos'].get(tower_id, {}).get(str(flat['floor']), {}).get(flat['unit'])
    if pano and (not pano.startswith('data/' + bundle['id'] + '/panos/') or '..' in pano):
        raise ValueError('Unexpected panorama path')
    data = dict(project=bundle['id'], sourceUrl=url, sun=metrics['sun'], view=view, withFuture=metrics.get('withFuture'),
                living=model['living'], outline=model['outline'], floorMpd=floor['floorMpd'],
                panoramaUrl='https://lightview.app/' + pano if pano else None,
                dataDate=bundle['metrics']['dataDate'], sunConfidence=bundle['metrics']['sun']['confidence'],
                viewConfidence=bundle['metrics']['view']['confidence'])
    if old and old.get('coverage') == 'public' and all(old[k] == v for k, v in data.items()):
        captured_at = old['capturedAt']
    return dict(**data, coverage='public', capturedAt=captured_at), None


def run(source_dir: Path | None) -> None:
    inventory = json.loads((ROOT / 'data/inventory.json').read_text(encoding='utf-8'))
    target = ROOT / 'docs/data/lightview.json'
    previous = json.loads(target.read_text(encoding='utf-8')) if target.exists() else None
    if previous and previous['schemaVersion'] not in (1, 2):
        raise ValueError('Unknown previous Lightview schema')
    output = dict(schemaVersion=2, capturedAt=datetime.now(timezone.utc).isoformat(), attribution='光景 Lightview · JOL Studio Limited',
                  authorization='使用者於2026-11-13表示已取得授權並指示擷取及接入；不代表開放授權。',
                  disclaimer='日照及景觀為Lightview模擬，並非實景、官方售樓資料或可選狀態；不保證建成後情況。', flats={}, projects={})
    provenance, unmatched = [], []
    cache = ROOT / '.cache/lightview'
    cache.mkdir(parents=True, exist_ok=True)
    for estate, slug in PROJECTS.items():
        url = 'https://lightview.app/' + slug
        if source_dir:
            raw = (source_dir / (slug + '.html')).read_bytes()
        else:
            raw = fetch_bytes(urllib.request.Request(url), validate=lambda body: extract_bundle(body.decode('utf-8'), slug))
        bundle = extract_bundle(raw.decode('utf-8'), slug)
        validate_access(bundle, estate, legacy_replay=bool(source_dir and (not previous or previous['schemaVersion'] == 1)))
        (cache / (slug + '-bundle.json')).write_text(json.dumps(bundle, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        project_rows = [f for f in inventory if f['estate'] == estate]
        matched = historical = 0
        for flat in project_rows:
            old = previous['flats'].get(flat['id']) if previous else None
            if old and previous['schemaVersion'] == 1:
                old = {**old, 'capturedAt': previous['capturedAt']}
            extra, reason = enrich_flat(flat, bundle, old, output['capturedAt'])
            if extra:
                output['flats'][flat['id']] = extra
                if extra['coverage'] == 'public':
                    matched += 1
                else:
                    historical += 1
            else:
                if old:
                    raise ValueError(f'Unexplained loss of Lightview coverage: {flat["id"]} ({reason})')
                unmatched.append(dict(id=flat['id'], reason=reason))
        counts = dict(specialCount=len(project_rows), matched=matched, historical=historical,
                      unmatched=len(project_rows) - matched - historical)
        output['projects'][slug] = dict(estate=estate, sourceUrl=url, **counts,
                                       dataDate=bundle['metrics']['dataDate'], sunMethod=bundle['metrics']['sun'], viewMethod=bundle['metrics']['view'])
        provenance.append(dict(estate=estate, url=url, htmlSha256=hashlib.sha256(raw).hexdigest(), **counts,
                               open=bundle.get('open'), openFlats=bundle.get('openFlats', {})))
        print(f'{estate}: {matched} public, {historical} historical, {counts["unmatched"]} unmatched')
    assert set(output['flats']) <= {f['id'] for f in inventory}
    validate_refresh(output, previous)
    if previous and {k: v for k, v in output.items() if k != 'capturedAt'} == {k: v for k, v in previous.items() if k != 'capturedAt'}:
        output['capturedAt'] = previous['capturedAt']
    temporary = target.with_suffix('.tmp')
    temporary.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    temporary.replace(target)
    (ROOT / 'data/lightview/provenance.json').write_text(json.dumps(dict(sources=provenance, unmatched=unmatched), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Imported {len(output["flats"])} enrichments; master inventory unchanged ({len(inventory)} flats)')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, help='Replay captured public HTML pages')
    run(parser.parse_args().source_dir)
