# 宏福苑選樓參考 · wangfuk-court

[開啟選樓工具](https://herman925.github.io/wangfuk-court/)

宏福苑業主「特設銷售計劃」供選單位及揀選狀態比較工具，繁體中文，手機及電腦可用。

- 只列特設計劃供選範圍；可選屋苑、座數、已揀選／未揀選狀態，再按面積、最高售價、樓層篩選。
- 按售價、面積、樓層排序；搜尋單位；匯出全部篩選結果 CSV。
- 按「♡ 心許」把單位加入「心許之所」，儲存在此瀏覽器；篩選可只看收藏。展開「分享／匯入」可複製適合WhatsApp閱讀的完整清單，或直接開啟WhatsApp預填文字；家人把同一份文字貼回即可匯入，會合併並保留原收藏。
- 明示資料日期及核實狀態，並附官方來源。
- 啟陽苑、裕豐苑及灝然共1,411伙另有Lightview坐向、三季日照及景觀模擬；支援篩選、排序、CSV及原站對應單位3D／全景連結。缺少或面積不符的資料不套用，亦不改動供選範圍或揀選狀態。

初始核對快照（最新數字見網站）：**2026-11-12，只含特設計劃供選4,443伙：3,125伙未揀選、1,318伙已揀選**。不包括各屋苑在其他銷售安排下的單位。其他九個項目採用官方未售／已選／已售表；樂嶺軒依使用者指定，採用其提供的已選PDF（300伙內272伙已選，28伙未選），表內明示來源。紅色已揀選包含官方已選及已售；綠色為未揀選。

## 本機使用

收藏只留在本機瀏覽器，清除網站資料或私人瀏覽可能令清單消失；跨裝置請分享並匯入。收藏不是預留單位，也不會改變官方揀選狀態；匯入後採用網站目前的售價及狀態。

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

現已由GitHub Actions每日香港時間 **00:00** 自動抓取官方揀選狀態及Lightview，驗證後更新網站。亦可在 [Actions](https://github.com/herman925/wangfuk-court/actions/workflows/publish.yml) 按「Run workflow」立即執行。來源失敗時保留該來源上次有效快照，其他來源繼續；頁面顯示最後檢查結果，表內仍保留來源公布日期。排程可能受GitHub延遲，並非實時資料。

樂嶺軒每日同步監察[官方銷售情況](https://sierraterrace.hkhs.com/sales-info/latest-sales-status/)及[成交紀錄冊](https://sierraterrace.hkhs.com/sales-info/register-of-transactions/)。2026-11-13查核仍沒有完整已揀選／未售表；成交冊只涵蓋特設供選範圍內224伙記錄，無法取代使用者PDF的272伙已選狀態。詳見 [來源調查](research/sierra-status-sources.md)。

手動執行以上工具不會自行提交；Actions工作流程會在全部驗證通過後，自動提交資料並發布`docs/`。Pages由GitHub Actions發布，不需要個人token。

Lightview增補獨立更新：啟用相同虛擬環境後執行 `python tools/import_lightview.py`。原始完整項目包只存本機`.cache/lightview`；公開檔僅包含已配對的供選單位。來源、使用者授權說明及重播方法見 [AGENTS.md](AGENTS.md#lightview-日照及景觀增補)，功能及資料管線研究見 [Lightview調查](research/lightview-investigation.md)。模擬並非實景、天氣預報或官方資料。

## 檔案

| 路徑 | 用途 |
|---|---|
| `docs/` | GitHub Pages 網頁及資料快照 |
| `data/inventory.json` | 原始供選4,443伙、面積及官方價單售價 |
| `data/sources.json` | 19份官方狀態 PDF 的網址及屋苑對應 |
| `data/sierra-selections.json` | 從使用者PDF抽取的樂嶺軒已選ID、日期、檔名及SHA-256 |
| `data/provenance.json` | 本次實際採用來源的日期、剩餘數及 SHA-256 |
| `tools/update_snapshot.py` | 下載、解析、核對及輸出快照 |
| `tools/import_lightview.py` | 擷取公開項目包，按身份及面積配對供選單位 |
| `tools/check_sierra.py` | 發現最新官方文件並核對成交冊，保留PDF選樓基線 |
| `docs/data/update-status.json` | 每項來源最後嘗試／成功檢查時間及執行連結 |
| `docs/data/sierra-audit.json` | 樂嶺軒官方文件及成交冊與PDF的差異 |
| `.github/workflows/publish.yml` | 定時抓取、驗證、自動提交及發布 |
| `docs/data/lightview.json` | 1,411伙日照、景觀、坐向、幾何及全景索引增補 |
| `data/lightview/provenance.json` | Lightview來源雜湊、涵蓋數及排除原因 |
| `research/lightview-investigation.md` | 功能、資料結構、靜態／瀏覽證據及未確認部分 |
| `tests/` | 篩選、排序、CSV、官方PDF解析及資料一致性檢查 |

只公開屋苑及單位資料，不收集使用者資料；原研究專案的信件、個人設定、PDF彙編及 Git 歷史不在此倉庫內。
