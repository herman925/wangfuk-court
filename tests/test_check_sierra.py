import io
import json
import unittest
from unittest.mock import patch

from tools.check_sierra import inspect_register, list_documents


class SierraAuditTests(unittest.TestCase):
    def test_register_presence_is_limited_to_special_scope_and_deduplicated(self) -> None:
        text = '''樂嶺軒
01-11-2026 06-11-2026 樂嶺軒 4 A1 $3,000,000
01-11-2026 06-11-2026 10-11-2026 樂嶺軒 4 A1 $3,000,000
01-11-2026 樂嶺軒 5 B2 $3,000,000
01-11-2026 樂嶺軒 6 C3 $3,000,000
Date & Time of Update: 05:30 PM, 12-11-2026'''
        allowed = {'樂嶺軒---4-A1', '樂嶺軒---5-B2', '樂嶺軒---7-C4'}
        ids, date = inspect_register(text, allowed)
        self.assertEqual(ids, {'樂嶺軒---4-A1', '樂嶺軒---5-B2'})
        self.assertEqual(date, '2026-11-12')
        self.assertNotIn('樂嶺軒---7-C4', ids)
        with self.assertRaises(ValueError):
            inspect_register(text.replace('Date & Time of Update:', 'changed'), allowed)
        with self.assertRaises(ValueError):
            inspect_register('樂嶺軒 Date & Time of Update: 12-11-2026', allowed)

    def test_document_listing_rejects_errors_and_foreign_urls(self) -> None:
        for payload in [{'errors': ['failed']}, {'data': {'listDocs': None}},
                        {'data': {'listDocs': [dict(date='2026-11-12', url='https://other.invalid/file.pdf')]}}]:
            with patch('tools.check_sierra.urllib.request.urlopen', return_value=io.BytesIO(json.dumps(payload).encode())):
                with self.assertRaises(ValueError):
                    list_documents('latest-sales-status')
        with patch('tools.check_sierra.urllib.request.urlopen', return_value=io.BytesIO(b'{"data":{"listDocs":[]}}')):
            self.assertEqual(list_documents('latest-sales-status'), [])
