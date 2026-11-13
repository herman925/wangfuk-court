import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from tools.update_snapshot import build_snapshot, import_sierra_pdf, parse_status, validate_snapshot


class StatusParserTests(unittest.TestCase):
    def test_all_statuses_read_without_duplicate_english_entries(self) -> None:
        text = '''宏福苑業主「特設銷售計劃」
最後更新日期: 2026年11月12日 18時09分
發展項目/屋苑: 啟陽苑 A座
剩餘單位數目: 2
以下為未售單位:
2樓單位4,
10樓單位12.
以下為已選單位:
3樓單位5.
以下為已售單位:
4樓單位6.
The following flats are available: Flat 4 2nd Floor.'''
        self.assertEqual(parse_status(text, '啟陽苑'), ({('A', 2, '4'): '未售', ('A', 10, '12'): '未售', ('A', 3, '5'): '已選', ('A', 4, '6'): '已售'}, '2026-11-12'))
        with self.assertRaises(ValueError):
            parse_status(text.replace('數目: 2', '數目: 3'), '啟陽苑')
        with self.assertRaises(ValueError):
            parse_status(text.replace('10樓單位12', '2樓單位4'), '啟陽苑')
        with self.assertRaises(ValueError):
            parse_status(text, '影輝苑')

    def test_single_building_and_zero_remaining(self) -> None:
        text = '最後更新日期: 2026年11月12日\n發展項目/屋苑: 欣雅苑 A座\n剩餘單位數目: 0\n以下為已售單位:\n2樓單位4.'
        self.assertEqual(parse_status(text, '欣雅苑'), ({('-', 2, '4'): '已售'}, '2026-11-12'))

    def test_status_conflict_rejected(self) -> None:
        text = '最後更新日期: 2026年11月12日\n發展項目/屋苑: 啟陽苑 A座\n剩餘單位數目: 1\n以下為未售單位:\n2樓單位4.\n以下為已選單位:\n2樓單位4.'
        with self.assertRaises(ValueError):
            parse_status(text, '啟陽苑')

    def test_full_inventory_required_and_source_exception_is_sierra_only(self) -> None:
        inventory = [dict(id='a', estate='啟陽苑', block='A', floor=1, unit='1', price=3000000, sqft=400, sqm=37)]
        config = dict(districts={'啟陽苑': '啟德'}, links=[])
        records = {'a': dict(status='available', source='official', sourceStatus='未售', asOf='2026-11-12')}
        snapshot = build_snapshot(inventory, config, records, '2026-11-12')
        self.assertEqual(snapshot['estates'][0]['available'], 1)
        snapshot['flats'][0]['source'] = 'user-pdf'
        with self.assertRaises(ValueError):
            validate_snapshot(snapshot)
        snapshot['flats'] = []
        with self.assertRaises(ValueError):
            validate_snapshot(snapshot)

    def test_user_pdf_import_is_limited_to_special_exercise_ids(self) -> None:
        inventory = [dict(id='樂嶺軒---4-A1', estate='樂嶺軒')]
        text = '11月12日 樂嶺軒 - 4 A1 463 3,662,000\n11月12日 啟陽苑 A 3 4 381 3,248,600'
        with patch.object(Path, 'read_bytes', return_value=b'PDF'), patch('tools.update_snapshot.pdfplumber.open') as pdf:
            pdf.return_value.__enter__.return_value.pages = [SimpleNamespace(extract_text=lambda: text)]
            source = import_sierra_pdf(Path('selected_20261112.pdf'), inventory)
            self.assertEqual(source['pickedIds'], ['樂嶺軒---4-A1'])
            self.assertEqual(source['asOf'], '2026-11-12')
            with self.assertRaises(ValueError):
                import_sierra_pdf(Path('selected.pdf'), inventory)
            text += '\n11月12日 樂嶺軒 - 5 A2 305 2,414,000'
            with self.assertRaises(ValueError):
                import_sierra_pdf(Path('selected_20261112.pdf'), inventory)


if __name__ == '__main__':
    unittest.main()
