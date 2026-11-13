"""Check official Sierra publications without inferring unsold flats from transactions."""

import hashlib
import io
import json
import re
import urllib.request
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin, urlparse

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://sierraterrace.hkhs.com'
HEADERS = {'Content-Type': 'application/json', 'Accept-Language': 'tc',
           'User-Agent': 'Mozilla/5.0', 'Origin': BASE,
           'Referer': BASE + '/sales-info/latest-sales-status/'}


def list_documents(kind: str) -> list:
    body = json.dumps({'query': 'query($type:String!){listDocs(type:$type){date url title}}',
                       'variables': {'type': kind}}).encode()
    request = urllib.request.Request(BASE + '/api/', data=body, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.load(response)
    if payload.get('errors') or not isinstance(payload.get('data', {}).get('listDocs'), list):
        raise ValueError('Invalid Sierra document listing')
    docs = payload['data']['listDocs']
    for doc in docs:
        datetime.strptime(doc['date'], '%Y-%m-%d')
        url = urljoin(BASE, doc['url'])
        parsed = urlparse(url)
        if parsed.scheme != 'https' or parsed.netloc != 'sierraterrace.hkhs.com' or not parsed.path.startswith('/uploads/') or not parsed.path.lower().endswith('.pdf'):
            raise ValueError('Unexpected Sierra document URL')
        doc['url'] = url
    return docs


def inspect_register(text: str, allowed: set[str]) -> tuple[set[str], str]:
    if '樂嶺軒' not in text or 'Date & Time of Update:' not in text:
        raise ValueError('Unexpected Sierra register')
    date = re.search(r'Date & Time of Update:[^\n]*?(\d{2}-\d{2}-\d{4})', text)
    if not date:
        raise ValueError('Missing register date')
    # Records may include terminated/resold contracts; presence is audit evidence only.
    rows = re.findall(r'^(?:\d{2}-\d{2}-\d{4}\s+){1,3}樂嶺軒\s+(\d+)\s+([ABC]\d+)\s+\$', text, re.M)
    if not rows:
        raise ValueError('No recognizable transaction rows')
    ids = {f'樂嶺軒---{int(floor)}-{unit}' for floor, unit in rows} & allowed
    return ids, datetime.strptime(date[1], '%d-%m-%Y').date().isoformat()


def run() -> None:
    status_docs = list_documents('latest-sales-status')
    registers = list_documents('register-of-transactions')
    if not registers:
        raise ValueError('No official Sierra transaction register found')
    latest = max(registers, key=lambda doc: doc['date'])
    with urllib.request.urlopen(urllib.request.Request(latest['url'], headers=HEADERS), timeout=30) as response:
        raw = response.read()
    if not raw.startswith(b'%PDF'):
        raise ValueError('Sierra register is not a PDF')
    with pdfplumber.open(io.BytesIO(raw)) as pdf:
        text = '\n'.join(page.extract_text() or '' for page in pdf.pages)
    inventory = json.loads((ROOT / 'data/inventory.json').read_text(encoding='utf-8'))
    allowed = {flat['id'] for flat in inventory if flat['estate'] == '樂嶺軒'}
    recorded, as_of = inspect_register(text, allowed)
    if as_of != latest['date']:
        raise ValueError('Register date disagrees with official document listing')
    baseline = json.loads((ROOT / 'data/sierra-selections.json').read_text(encoding='utf-8'))
    picked = set(baseline['pickedIds'])
    report = dict(latestSalesStatusDocuments=status_docs, register=dict(**latest, asOf=as_of,
                  sha256=hashlib.sha256(raw).hexdigest(), recordedSpecialIds=sorted(recorded)),
                  userPdfAsOf=baseline['asOf'], userPickedWithoutRegister=sorted(picked - recorded),
                  registerOutsideUserPicked=sorted(recorded - picked),
                  note='成交冊包含交易及可能終止的記錄，不是完整已揀選表；不得用沒有記錄推算未售。不更改使用者PDF狀態。')
    target = ROOT / 'docs/data/sierra-audit.json'
    if target.exists() and as_of < json.loads(target.read_text(encoding='utf-8'))['register']['asOf']:
        raise ValueError('Refusing an older Sierra register')
    temporary = target.with_suffix('.tmp')
    temporary.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(target)
    print(f'Sierra: {len(status_docs)} status documents; register {as_of}: {len(recorded)} special IDs; {len(picked - recorded)} PDF-picked IDs absent')
    if status_docs or recorded - picked:
        print('::warning::New Sierra evidence needs review; user-PDF selection statuses were retained.')


if __name__ == '__main__':
    run()
