import copy
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from tools.import_lightview import ROOT, enrich_flat, extract_bundle, is_public, run, validate_access, validate_refresh


class LightviewTests(unittest.TestCase):
    def test_automatic_refresh_rejects_lost_coverage_and_older_models(self):
        previous = dict(flats={'a': {}}, projects={'project': dict(matched=1, dataDate={'cityModel': '2026-11-12'})})
        validate_refresh(previous, previous)
        with self.assertRaises(ValueError):
            validate_refresh({**previous, 'flats': {}}, previous)
        with self.assertRaises(ValueError):
            validate_refresh({**previous, 'flats': {'b': {}}}, previous)
        with self.assertRaises(ValueError):
            validate_refresh({**previous, 'projects': {'project': dict(matched=1, dataDate={'cityModel': '2026-11-11'})}}, previous)

    def setUp(self):
        self.flat = dict(id='fixture', estate='灝然', block='1A', floor=2, unit='A', sqm=40)
        season = dict(hours=0, morningHours=0, afternoonHours=0, sunlit=[])
        self.bundle = dict(id='hemma-sapphire', open={'T1A': ['2']}, openFlats={},
            project=dict(schema=1, site={'nameZh': '灝然'}, towers=[dict(
            id='T1A', flats=[dict(id='A', saleableAreaSqm=40, living={}, outline=[])],
            floors=[dict(label='2', floorMpd=12, plan='typical')])]),
            metrics=dict(schema=1, windows={'T1A': {'2': {'A': dict(
                sun={s: copy.deepcopy(season) for s in ('summer', 'equinox', 'winter')},
                view=dict(skyPct=0, waterPct=0, greeneryPct=0, buildingPct=100, otherPct=0))}}},
                dataDate={}, sun=dict(confidence='medium'), view=dict(confidence='medium')),
            panos=dict(panos={}))

    def test_stream_decode_and_identity_gate(self):
        stream = 'record: {"bundle":' + json.dumps(self.bundle) + ',"other":1}'
        chunks = [stream[:30], stream[30:]]
        html = '<script>unrelated()</script>' + ''.join(
            '<script>self.__next_f.push(' + json.dumps([1, chunk]) + ')</script>' for chunk in chunks)
        self.assertEqual(extract_bundle(html, 'hemma-sapphire'), self.bundle)
        with self.assertRaises(ValueError):
            extract_bundle(html, 'different-project')
        with self.assertRaises(ValueError):
            extract_bundle('<script>malicious()</script>', 'hemma-sapphire')
        with self.assertRaises(ValueError):
            extract_bundle(html.replace('"schema\\\": 1', '"schema\\\": 2'), 'hemma-sapphire')

    def test_exact_identity_area_gate_and_zero(self):
        data, reason = enrich_flat(self.flat, self.bundle)
        self.assertIsNone(reason)
        self.assertEqual(data['sun']['winter']['hours'], 0)
        self.assertEqual(data['floorMpd'], 12)
        self.assertIn('?t=T1A&f=2&u=A', data['sourceUrl'])
        self.assertEqual(enrich_flat({**self.flat, 'floor': 3}, self.bundle)[0], None)
        self.assertIn('面積', enrich_flat({**self.flat, 'sqm': 41}, self.bundle)[1])

    def test_reject_inconsistent_metrics_and_external_panorama(self):
        metrics = self.bundle['metrics']['windows']['T1A']['2']['A']
        metrics['sun']['winter']['hours'] = 2
        with self.assertRaises(ValueError):
            enrich_flat(self.flat, self.bundle)
        metrics['sun']['winter']['hours'] = 0
        metrics['view']['waterPct'] = 5
        with self.assertRaises(ValueError):
            enrich_flat(self.flat, self.bundle)
        metrics['view']['waterPct'] = 0
        self.bundle['panos']['panos'] = {'T1A': {'2': {'A': 'https://other.invalid/pano'}}}
        with self.assertRaises(ValueError):
            enrich_flat(self.flat, self.bundle)

    def test_access_maps_must_agree_with_model_and_each_other(self):
        bundle = self.bundle
        for change in (dict(open={}), dict(open={'T1A': ['9']}), dict(openFlats=[]),
                       dict(openFlats={'wrong': ['A']}), dict(openFlats={'T1A': ['A@9']}),
                       dict(openFlats={'T1A': ['B']}), dict(open={'T1A': []})):
            with self.subTest(change=change), self.assertRaises(ValueError):
                validate_access({**bundle, **change}, '灝然')
        for field in ('open', 'openFlats'):
            with self.assertRaises(ValueError):
                validate_access({k: v for k, v in bundle.items() if k != field}, '灝然')
        with self.assertRaises(ValueError):
            validate_access(bundle, '啟陽苑')
        for entry in ('A@2', 'A'):
            scope = {**bundle, 'open': {'T1A': []}, 'openFlats': {'T1A': [entry]}}
            validate_access(scope, '灝然')
            self.assertTrue(is_public(scope, 'T1A', '2', 'A'))
            self.assertEqual(is_public(scope, 'T1A', '3', 'A'), entry == 'A')
            self.assertFalse(is_public(scope, 'T1A', '2', 'B'))
        validate_access({**bundle, 'open': None}, '灝然')

    def test_refresh_migrates_retains_and_reopens_only_explained_rows(self):
        with (
            TemporaryDirectory() as tmp,
            patch('tools.import_lightview.ROOT', Path(tmp)),
            patch('tools.import_lightview.PROJECTS', {'灝然': 'hemma-sapphire'}),
        ):
            root = Path(tmp)
            (root / 'data/lightview').mkdir(parents=True)
            (root / 'docs/data').mkdir(parents=True)
            target = root / 'docs/data/lightview.json'
            provenance = root / 'data/lightview/provenance.json'
            inventory = [self.flat, {**self.flat, 'id': 'closed', 'floor': 3}]
            (root / 'data/inventory.json').write_text(json.dumps(inventory), encoding='utf-8')
            bundle = self.bundle
            tower = bundle['project']['towers'][0]
            tower['floors'].append(dict(label='3', plan='typical', floorMpd=15))
            windows = bundle['metrics']['windows']['T1A']
            saved_metrics = copy.deepcopy(windows['2'])
            windows['3'] = saved_metrics
            original, _ = enrich_flat(inventory[1], {**bundle, 'open': None})
            del original['coverage'], original['capturedAt'], windows['3']
            date = '2026-11-13T03:45:53+00:00'
            target.write_text(json.dumps(dict(schemaVersion=1, capturedAt=date, flats={'closed': original},
                                              projects={'hemma-sapphire': {'dataDate': {}}})), encoding='utf-8')

            def replay():
                stream = '"bundle":' + json.dumps(bundle)
                html = '<script>self.__next_f.push(' + json.dumps([1, stream]) + ')</script>'
                (root / 'hemma-sapphire.html').write_text(html, encoding='utf-8')
                run(root)
                return json.loads(target.read_text(encoding='utf-8'))

            first = replay()
            self.assertEqual(first['flats']['closed'], {**original, 'coverage': 'historical', 'capturedAt': date})
            self.assertEqual(first, replay())
            stable = target.read_bytes(), provenance.read_bytes()
            # Neither missing public metrics (including exceptions) nor a changed model can be archived.
            for change in (dict(openFlats={'T1A': ['A@3']}), dict(openFlats={'T1A': ['A']}),
                           dict(open={'T1A': ['2', '3']})):
                with patch.dict(bundle, change), self.assertRaisesRegex(ValueError, 'Unexplained loss'):
                    replay()
            for change in (dict(plan='3F'), dict(floorMpd=16)):
                with patch.dict(tower['floors'][1], change), self.assertRaises(ValueError):
                    replay()
            with patch.dict(tower['flats'][0], saleableAreaSqm=42), self.assertRaises(ValueError):
                replay()
            self.assertEqual(stable, (target.read_bytes(), provenance.read_bytes()))
            bundle['openFlats'] = {'T1A': ['A@3']}
            windows['3'] = saved_metrics
            saved_metrics['A']['sun']['winter'].update(hours=2, morningHours=2)
            reopened = replay()['flats']['closed']
            self.assertEqual(reopened['coverage'], 'public')
            self.assertEqual(reopened['sun']['winter']['hours'], 2)
            self.assertNotEqual(reopened['capturedAt'], date)
            del windows['3']
            bundle['openFlats'] = {}
            self.assertEqual(replay()['flats']['closed'], {**reopened, 'coverage': 'historical'})

    def test_published_enrichment_stays_inside_special_inventory(self):
        inventory = {f['id'] for f in json.loads((ROOT / 'data/inventory.json').read_text(encoding='utf-8'))}
        published = json.loads((ROOT / 'docs/data/lightview.json').read_text(encoding='utf-8'))
        provenance = json.loads((ROOT / 'data/lightview/provenance.json').read_text(encoding='utf-8'))
        self.assertLessEqual(set(published['flats']), inventory)
        for slug, project in published['projects'].items():
            rows = [row for row in published['flats'].values() if row['project'] == slug]
            self.assertEqual(sum(r['coverage'] == 'public' for r in rows), project['matched'])
            self.assertEqual(sum(r['coverage'] == 'historical' for r in rows), project['historical'])
            self.assertEqual(len(rows) + project['unmatched'], project['specialCount'])
            self.assertTrue(all(r['capturedAt'] and r['sourceUrl'] for r in rows))
        self.assertFalse(set(published['flats']) & {f['id'] for f in provenance['unmatched']})
        self.assertEqual(len(published['flats']) + len(provenance['unmatched']),
                         sum(p['specialCount'] for p in published['projects'].values()))
