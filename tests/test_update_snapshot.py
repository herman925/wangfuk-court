import unittest

from tools.update_snapshot import parse_status


class StatusParserTests(unittest.TestCase):
    def test_chosen_sold_and_english_are_excluded(self) -> None:
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
        self.assertEqual(parse_status(text, '啟陽苑'), ({('A', 2, '4'), ('A', 10, '12')}, '2026-11-12'))
        with self.assertRaises(ValueError):
            parse_status(text.replace('數目: 2', '數目: 3'), '啟陽苑')
        with self.assertRaises(ValueError):
            parse_status(text.replace('10樓單位12', '2樓單位4'), '啟陽苑')
        with self.assertRaises(ValueError):
            parse_status(text, '影輝苑')

    def test_single_building_and_zero_remaining(self) -> None:
        text = '最後更新日期: 2026年11月12日\n發展項目/屋苑: 欣雅苑 A座\n剩餘單位數目: 0\n以下為已售單位:\n2樓單位4.'
        self.assertEqual(parse_status(text, '欣雅苑'), (set(), '2026-11-12'))


if __name__ == '__main__':
    unittest.main()
