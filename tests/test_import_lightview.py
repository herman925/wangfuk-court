import copy
import json
import unittest

from tools.import_lightview import ROOT, enrich_flat, extract_bundle


class LightviewTests(unittest.TestCase):
    def setUp(self):
        self.flat = dict(id='fixture', estate='灝然', block='1A', floor=2, unit='A', sqm=40)
        season = dict(hours=0, morningHours=0, afternoonHours=0, sunlit=[])
        self.bundle = dict(id='hemma-sapphire', project=dict(schema=1, towers=[dict(
            id='T1A', flats=[dict(id='A', saleableAreaSqm=40, living={}, outline=[])],
            floors=[dict(label='2', floorMpd=12)])]),
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

    def test_published_enrichment_stays_inside_special_inventory(self):
        inventory = {f['id'] for f in json.loads((ROOT / 'data/inventory.json').read_text(encoding='utf-8'))}
        published = json.loads((ROOT / 'docs/data/lightview.json').read_text(encoding='utf-8'))
        provenance = json.loads((ROOT / 'data/lightview/provenance.json').read_text(encoding='utf-8'))
        self.assertLessEqual(set(published['flats']), inventory)
        self.assertEqual(len(published['flats']), sum(p['matched'] for p in published['projects'].values()))
        self.assertFalse(set(published['flats']) & {f['id'] for f in provenance['unmatched']})
        self.assertEqual(len(published['flats']) + len(provenance['unmatched']),
                         sum(p['specialCount'] for p in published['projects'].values()))
