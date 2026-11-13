"""Import authorized public Lightview project bundles without expanding our inventory."""

import argparse
import hashlib
import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECTS = {'啟陽苑': 'kai-yeung-court', '裕豐苑': 'yu-fung-court', '灝然': 'hemma-sapphire'}


def validate_refresh(output: dict, previous: dict | None) -> None:
    if not output['flats'] or any(project['matched'] == 0 for project in output['projects'].values()):
        raise ValueError('Empty Lightview coverage; inspect changed source format')
    if previous and not set(previous['flats']) <= set(output['flats']):
        raise ValueError('Lightview coverage decreased; review removed or changed flat models')
    for slug, project in output['projects'].items():
        for name, value in project['dataDate'].items():
            datetime.strptime(value, '%Y-%m-%d')
            old = previous.get('projects', {}).get(slug, {}).get('dataDate', {}).get(name) if previous else None
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


def enrich_flat(flat: dict, bundle: dict) -> tuple[dict | None, str | None]:
    tower_id = 'T' + flat['block'] if flat['estate'] == '灝然' else flat['block']
    tower = next((t for t in bundle['project']['towers'] if t['id'] == tower_id), None)
    model = next((f for f in tower['flats'] if f['id'] == flat['unit']), None) if tower else None
    metrics = bundle['metrics']['windows'].get(tower_id, {}).get(str(flat['floor']), {}).get(flat['unit'])
    if not model or not metrics:
        return None, 'Lightview未涵蓋此單位或樓層'
    # shortcut: use the typical-flat geometry only when its area agrees; review floor-specific models before relaxing this gate.
    if abs(flat['sqm'] - model['saleableAreaSqm']) > 0.15:
        return None, 'Lightview面積與官方價單不符'
    for season in ('summer', 'equinox', 'winter'):
        sun = metrics['sun'][season]
        if not all(isinstance(sun[k], (int, float)) and 0 <= sun[k] <= 24 for k in ('hours', 'morningHours', 'afternoonHours')):
            raise ValueError(f'Invalid sun values: {flat["id"]}')
        if abs(sun['hours'] - sun['morningHours'] - sun['afternoonHours']) > 0.21:
            raise ValueError(f'Inconsistent sun totals: {flat["id"]}')
    view = metrics['view']
    keys = ('skyPct', 'waterPct', 'greeneryPct', 'buildingPct', 'otherPct')
    if not all(isinstance(view[k], (int, float)) and 0 <= view[k] <= 100 for k in keys) or abs(sum(view[k] for k in keys) - 100) > 0.6:
        raise ValueError(f'Invalid view shares: {flat["id"]}')
    floor = next((f for f in tower['floors'] if str(f['label']) == str(flat['floor'])), None)
    pano = bundle['panos']['panos'].get(tower_id, {}).get(str(flat['floor']), {}).get(flat['unit'])
    if pano and (not pano.startswith('data/' + bundle['id'] + '/panos/') or '..' in pano):
        raise ValueError('Unexpected panorama path')
    url = f'https://lightview.app/{bundle["id"]}?t={tower_id}&f={flat["floor"]}&u={flat["unit"]}'
    return dict(project=bundle['id'], sourceUrl=url, sun=metrics['sun'], view=view, withFuture=metrics.get('withFuture'),
                living=model['living'], outline=model['outline'], floorMpd=floor['floorMpd'] if floor else None,
                panoramaUrl='https://lightview.app/' + pano if pano else None,
                dataDate=bundle['metrics']['dataDate'], sunConfidence=bundle['metrics']['sun']['confidence'],
                viewConfidence=bundle['metrics']['view']['confidence']), None


def run(source_dir: Path | None) -> None:
    inventory = json.loads((ROOT / 'data/inventory.json').read_text(encoding='utf-8'))
    output = dict(schemaVersion=1, capturedAt=datetime.now(timezone.utc).isoformat(), attribution='光景 Lightview · JOL Studio Limited',
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
            with urllib.request.urlopen(url, timeout=30) as response:
                raw = response.read()
        bundle = extract_bundle(raw.decode('utf-8'), slug)
        (cache / (slug + '-bundle.json')).write_text(json.dumps(bundle, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        project_rows = [f for f in inventory if f['estate'] == estate]
        matched = 0
        for flat in project_rows:
            extra, reason = enrich_flat(flat, bundle)
            if extra:
                output['flats'][flat['id']] = extra
                matched += 1
            else:
                unmatched.append(dict(id=flat['id'], reason=reason))
        output['projects'][slug] = dict(estate=estate, sourceUrl=url, specialCount=len(project_rows), matched=matched,
                                       dataDate=bundle['metrics']['dataDate'], sunMethod=bundle['metrics']['sun'], viewMethod=bundle['metrics']['view'])
        provenance.append(dict(estate=estate, url=url, htmlSha256=hashlib.sha256(raw).hexdigest(), matched=matched, specialCount=len(project_rows)))
        print(f'{estate}: {matched}/{len(project_rows)} special-exercise flats matched')
    assert set(output['flats']) <= {f['id'] for f in inventory}
    target = ROOT / 'docs/data/lightview.json'
    previous = json.loads(target.read_text(encoding='utf-8')) if target.exists() else None
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
