# 宏福苑選樓參考 · wangfuk-court

[開啟選樓工具](https://herman925.github.io/wangfuk-court/)

宏福苑業主「特設銷售計劃」剩餘單位比較工具，繁體中文，手機及電腦可用。

- 選屋苑、座數，按面積、最高售價、樓層篩選。
- 按售價、面積、樓層排序；搜尋單位；匯出全部篩選結果 CSV。
- 明示資料日期及核實狀態，並附官方來源。

初始快照：**2026-11-12，原供選4,443伙，剩餘3,125伙**。房委會八個項目及灝然與官方同日未售表逐伙一致；樂嶺軒28伙屬按彙編推算，未獲完整官方未售表獨立確認。全部單位均為參考，實際供應以售樓處確認為準。

## 本機使用

網站只有 HTML、CSS、JavaScript 及 JSON，不需安裝前端套件或編譯。

```powershell
python -m http.server 8080 --directory docs --bind 127.0.0.1
```

開啟 <http://127.0.0.1:8080>。須經 HTTP 開啟，不能直接雙擊 HTML，因為網頁要讀取 JSON。

## 更新資料

完整網站來源、下載方式、核對規則及樂嶺軒處理方法見 [AGENTS.md](AGENTS.md)。

```powershell
python -m venv .venv
. ./.venv/Scripts/Activate.ps1
python -m pip install -r tools/requirements.txt
python tools/update_snapshot.py
python -m unittest discover -s tests -p 'test_*.py'
npm run check
```

更新程式不會自動 commit 或 push；先核對資料差異，再提交。網站由 `main` 分支的 `/docs` 發布到 GitHub Pages。

## 檔案

| 路徑 | 用途 |
|---|---|
| `docs/` | GitHub Pages 網頁及資料快照 |
| `data/inventory.json` | 原始供選4,443伙、面積及官方價單售價 |
| `data/sources.json` | 19份官方狀態 PDF 的網址及屋苑對應 |
| `data/sierra-baseline.json` | 樂嶺軒日期固定的28伙推算剩餘單位 |
| `data/provenance.json` | 本次實際採用來源的日期、剩餘數及 SHA-256 |
| `tools/update_snapshot.py` | 下載、解析、核對及輸出快照 |
| `tests/` | 篩選、排序、CSV、官方PDF解析及資料一致性檢查 |

只公開屋苑及單位資料，不收集使用者資料；原研究專案的信件、個人設定、PDF彙編及 Git 歷史不在此倉庫內。
