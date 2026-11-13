# wangfuk-court

## 目的與邊界

供宏福苑居民及家人比較「特設銷售計劃」供選範圍內的全部單位及揀選狀態。**所有只指特設供選4,443伙，並非各屋苑全部單位**。以清晰、客觀、繁體中文（香港）呈現。這是民間參考工具，不是官方售樓平台。

原研究／信件工作區的 CLAUDE.md 中適用的語言及來源要求已遷移至本檔：用繁中、引用原始資料、不可把推算當確認。原址重建倡議、DOCX信件格式、OpenClaw語氣、舊 GSD 工作階段及個人設定不屬本專案範圍，不遷移。CLAUDE.md 僅保留本檔指引，避免兩份規則漂移。

## 技術及網站

- 純靜態 HTML/CSS/ES modules，無前端依賴、無帳戶、無分析追蹤。
- Pages 由 `.github/workflows/publish.yml` 發布 `main` 的 `docs/`（Pages設定為GitHub Actions）；所有資源使用相對路徑，必須在 `/wangfuk-court/` 子路徑正常運作。
- 修改介面及程式時，一併更新 `index.html` 的CSS／JS資源版本查詢字串，避免GitHub Pages及瀏覽器快取造成新HTML混用舊程式。正式站驗證可在頁面網址加版本查詢字串。
- `docs/model.js` 為篩選／排序／CSV邏輯，`docs/app.js` 為介面；金額資料一律用港元整數，輸入「最高售價」為萬港元。
- 畫面顯示基準日期，不可宣稱實時供應。綠色available＝未揀選，紅色picked＝已揀選（包含已選及已售）；文字標籤必須保留，不可只用顏色。其他九個項目採官方狀態，樂嶺軒用使用者PDF並逐伙明示來源。
- 使用者於2026-11-13明確要求自動更新官方揀選狀態及Lightview，已授權下述排程通過驗證後自動提交及發布。手動改程式仍先核對再提交。不要複製任何其他倉庫的 `.git`、`.env`、憑證、個人信件或原始第三方彙編。

## 核心資料與初始核對結果

初始快照日期為 **2026-11-12**。原始供選4,443伙，使用者彙編列已選1,318伙，剩餘3,125伙。

| 屋苑 | 原供選 | 排除已選／已售 | 剩餘 | 方法 |
|---|---:|---:|---:|---|
| 盛緻苑 | 610 | 242 | 368 | 官方同日未售表 |
| 匯熙苑 | 140 | 38 | 102 | 官方同日未售表 |
| 裕豐苑 | 140 | 21 | 119 | 官方同日未售表 |
| 朗風苑 | 140 | 13 | 127 | 官方同日未售表 |
| 啟陽苑 | 750 | 436 | 314 | 官方同日未售表 |
| 影輝苑 | 220 | 21 | 199 | 官方同日未售表 |
| 欣雅苑 | 920 | 161 | 759 | 官方同日未售表 |
| 曉雅苑 | 627 | 44 | 583 | 官方同日未售表 |
| 樂嶺軒 | 300 | 272 | 28 | 銷售安排減彙編，非完整獨立確認 |
| 灝然 | 596 | 70 | 526 | 官方同日未售表 |

房委會八個項目及灝然共1,046伙的單位身份與官方「已選＋已售」表逐伙完全一致（181伙已選、865伙已售），官方表更新至2026-11-12 18:09。已選不等於已簽正式合約，作剩餘數計算要同時排除已選及已售。

## 官方網站及獲取方式

### 總覽

- [房屋局特設計劃：全部10個項目及原始供選數目](https://www.hb.gov.hk/wfc/tc/special-sales-exercise/index.html)
- [房委會特設計劃首頁](https://hos.housingauthority.gov.hk/mini-site/ssewfc/tc/index.html)
- [房委會特設價單（8個項目共3,547伙）](https://hos.housingauthority.gov.hk/mini-site/hos2025/common/pdf/Price-HOS-SSE.pdf)，價單編號1、2026-07-27。

### 房委會狀態表

完整確切網址已機器可讀地記於 `data/sources.json` 的 `statusSources`，不要靠猜網址。

基本形式：`https://www.housingauthority.gov.hk/mini-site/ssewfc/common/pdf/status/se1/status-{slug}-{block}-text.pdf`。

| 屋苑 | slug | URL座號 |
|---|---|---|
| 盛緻苑 | shing-chi | a,b |
| 匯熙苑 | wui-hei | a,b |
| 裕豐苑 | yu-fung | a,b,c,d |
| 朗風苑 | long-fung | a,b,c,d |
| 啟陽苑 | kai-yeung | a,b |
| 影輝苑 | ying-fai | a,b |
| 欣雅苑 | yan-nga | a（價單及資料內座號為 `-`） |
| 曉雅苑 | hiu-nga | a（價單及資料內座號為 `-`） |

查找更新網址時，開啟各屋苑官方頁面並找「宏福苑業主『特設銷售計劃』」區段，**不要拿『居屋2025』或『綠置居2025』一般銷售表代替**：

- 盛緻苑：`https://hos.housingauthority.gov.hk/mini-site/gsh2025/tc/shing-chi.html`
- 匯熙、裕豐、朗風、啟陽、影輝：`https://hos.housingauthority.gov.hk/mini-site/hos2025/tc/{slug}.html`
- 欣雅、曉雅：`https://hos.housingauthority.gov.hk/mini-site/ssewfc/tc/{slug}.html`

純文字PDF包含中英文重複內容，中文部分分為「未售」「已選」「已售」。同時解析三種狀態：未售→available，已選／已售→picked；從中文標題取得屋苑、座數、剩餘數及更新日期，英譯不得重複計入。全部原始供選鍵都必須出現且狀態不得衝突，不能把官方表沒有列出的單位直接當未售。

### 灝然（房協）

- 官網銷售資料：`https://hemmasapphire.hkhs.com/tc/index.php?page=salesinfo`
- [官方狀態PDF](https://hemmasapphire.hkhs.com/download/newest_sales_phase1/status-hemma-sapphire-text.pdf)：同一檔涵蓋1A、1B、2A、2B、3A、3B、4A、4B、5A、5B十座，每座分開核對。
- [價單編號1（2026-08-20）](https://hemmasapphire.hkhs.com/download/pricelist/Hemma%20Sapphire_PL_0820.pdf)：596伙。
- 初始彙編的3B座7/9/11/13/15樓C室售價與原始價單不符，均已排除，沒有影響剩餘名單。不要用彙編覆蓋官方價單售價；不宣稱彙編的估值及印花稅已核實。

### 樂嶺軒（房協）：必須保留不確定性

- [銷售安排第3號（2026-09-22）](https://sierraterrace.hkhs.com/uploads/Sierra-Terrace---SA3_20260922.pdf)：**只有列出的300伙可納入特設計劃**。
- [價單第1C號（2026-08-20）](https://sierraterrace.hkhs.com/uploads/PWR-PL1C_20260820.pdf)：亦載其他銷售安排的單位，不可把整份價單所有單位都計入。
- [2026-11-12官方成交冊](https://sierraterrace.hkhs.com/uploads/Sierra-Terrace_ROT_20261112.pdf)：更新至17:30；在特設供選300伙內有224伙記錄，全部在使用者彙編272伙之內；另48伙未能獨立確認。
- [最新銷售情況頁](https://sierraterrace.hkhs.com/sales-info/latest-sales-status/)：本次查找時沒有可下載的未售表。
- 官網 Nuxt 頁面的內容可能要由公開 GraphQL 端點獲取。只讀查詢方式：對 `https://sierraterrace.hkhs.com/api/` POST JSON，Header `Accept-Language: tc`，body：

```json
{"query":"query($type:String!){listDocs(type:$type){date url title}}","variables":{"type":"register-of-transactions"}}
```

`type` 可用 `price-list`、`sales-arrangements`、`register-of-transactions`、`latest-sales-status`。本次後者回傳空陣列。回傳的 `url` 為相對路徑，用官網根網址解析，先核對文件日期及標題再使用，不要憑日期拼造未發現的文件網址。

使用者最新指示：樂嶺軒使用其提供的《宏福苑特設銷售計劃已選單位(20261112).pdf》判定狀態，作為其他九個項目用官方狀態表的唯一例外。`data/sierra-selections.json`保存從PDF直接抽取的272個已選ID、日期、原始檔名及SHA-256；只在官方銷售安排第3號的300伙內扣除，餘28伙顯示未揀選。兩種狀態都標示source=user-pdf，切勿稱作官方確認。原價單及300伙供選範圍仍來自官方。完整原始PDF留在使用者下載／本機封存，不上傳到公開倉庫。

更新此PDF時，檔名須包含YYYYMMDD，執行：

```powershell
python tools/update_snapshot.py --sierra-pdf 'C:/path/宏福苑特設銷售計劃已選單位(YYYYMMDD).pdf'
```

程式僅抽取樂嶺軒的已選列，拒絕重複或不在特設300伙內的ID。沒有指定新PDF時維持已存來源及其日期；其他九個項目可更新，表內逐伙顯示各自來源日期。不得以成交紀錄冊沒有記錄推算未選；成交冊只作輔助核對。

## 更新程序

### 自動抓取（已獲使用者授權）

`.github/workflows/publish.yml` 每日UTC 16:00（翌日香港時間00:00）及手動 `workflow_dispatch` 執行三項獨立來源檢查：

1. `update_snapshot.py` 抓取19份官方狀態表，保留樂嶺軒PDF基線。
2. `import_lightview.py` 抓取三個公開項目包，重新配對及驗證。
3. `check_sierra.py` 查詢官網最新狀態文件及成交冊，僅作監察，不改PDF狀態。

每項失敗會還原該來源的生成檔，其他來源繼續；完整Python及Node測試通過後才提交明列的資料檔並在同一工作流程發布。來源失敗會在發布有效資料後把工作流程標成失敗，並保留紀錄。測試、提交或部署失敗則停止，不以force push處理衝突。並行鎖避免排程互相覆蓋。

`docs/data/update-status.json`保存每個來源最後嘗試、結果、最後成功時間及Actions連結；**檢查時間不等於來源公布日期**。網頁顯示兩者。`docs/data/sierra-audit.json`保存官方文件清單、成交冊網址／日期／SHA-256、供選範圍內曾出現的交易鍵及與PDF差異。成交記錄可能含終止或重售，不等於現時可售狀態。發現新狀態文件或PDF以外交易鍵會在Actions警示，待核對格式及適用範圍後才更換來源。

GitHub的`GITHUB_TOKEN`提交不會觸發另一個push工作流程，因此本流程直接發布已驗證的`docs/`，不依賴連鎖push，也不需要個人token。程式push只驗證及發布已提交資料；定時／手動執行才抓網絡來源。Actions排程可能延遲，公開倉庫60日沒有活動亦可能停用，須查看Actions執行記錄。

```powershell
gh workflow run publish.yml --ref main
gh run list --workflow publish.yml
```

Lightview拒絕覆蓋較新的模型日期或丟失既有配對的快照；此類變動須人工核對。內容沒有變更時保留`capturedAt`，成功檢查時間另記於`update-status.json`。官方混合日期及其餘驗證規則維持有效，不能為自動化而繞過。

### 手動抓取及重播

所有Python工具先啟用專案虛擬環境。首次：

```powershell
python -m venv .venv
. ./.venv/Scripts/Activate.ps1
python -m pip install -r tools/requirements.txt
```

下載最新19份官方狀態PDF並重建快照：

```powershell
python tools/update_snapshot.py
```

程式先完整驗證所有來源，才以暫存檔替換 `docs/data/snapshot.json`。拒絕非PDF、缺少日期、官方來源混合日期、錯屋苑、列數不符、重複／未知單位及比現有快照更舊的日期；任一來源失敗就不替換網站資料。不要在驗證失敗時手動繞過。若官方分批更新導致混合日期，待各檔完成更新後再試。顯示完整供選資料，並驗證snapshot.flats的鍵與inventory完全一致；不可僅保留未揀選單位。

亦可離線重播：

```powershell
python tools/update_snapshot.py --source-dir .cache/2026-11-12
```

此資料夾須放入 `data/sources.json` 的statusSources中每個file所命名的19份官方PDF；樂嶺軒從已存的使用者PDF抽取資料讀取，不需要成交冊。`.cache`不提交。`data/provenance.json`保存實際採用PDF的SHA-256、日期、數目及原始網址。

售價、面積及原始供選範圍由 `data/inventory.json` 提供，**狀態更新不會自動重定價或增加原供選範圍**。如官方新價單／撤回／新增安排涉及物業範圍或價格，須先從新官方價單抽取並核對 `inventory.json`，在本檔及README記錄改動；不可用估算價格補缺。

首次資料製作方式：房委會價單逐行讀取屋苑、座、樓層、單位、平方米、呎數、售價；房協價單用 `pdfplumber.extract_tables()` 讀取合併的座數儲存格，向下沿用座號；樂嶺軒先按銷售安排第3號擴展樓層範圍，篩出300個正確鍵。PDF須先讀成 `io.BytesIO(path.read_bytes())`，避免Google Drive遠端磁碟大量seek導致極慢。合併後原始鍵4,443個均唯一；未售鍵必須在原始範圍內。

驗證及提交：

```powershell
python -m unittest discover -s tests -p 'test_*.py'
npm run check
python -c "import json; from tools.update_snapshot import validate_snapshot; validate_snapshot(json.load(open('docs/data/snapshot.json', encoding='utf-8')))"
git diff --stat
```

同時在瀏覽器檢查桌面及手機、屋苑切換、組合篩選、數字排序、空結果、重設、分頁及CSV匯出全部結果。明顯大幅變動要回到原始來源檢查，不可只看測試通過。CI不在每次push抓網絡資料，避免因官方服務失常覆蓋快照。

## 清理規則

只清理本專案已確認的 `.cache`、測試截圖及程序產生的暫存檔。不要遞迴刪除父工作區、原始下載、信件及研究資料。刪除重複原始PDF前，先以SHA-256確認有另一份完整存檔。

## Lightview 日照及景觀增補

使用者於2026-11-13表示已取得授權並指示擷取及接入；此為本次操作依據，不代表第三方資料獲開放授權。保留「光景 Lightview · JOL Studio Limited」來源鳴謝及模擬限制，不更動官方供選範圍、售價或狀態。研究方法、REA靜態證據與實際瀏覽觀察見 [research/lightview-investigation.md](research/lightview-investigation.md)。

來源為以下三個公開項目頁，HTML的Next.js RSC資料含 `bundle.project`、`bundle.metrics`、`bundle.panos`；以JSON解碼，**不執行下載的JavaScript**。不是取得私人後端資料庫，也不是穩定的公開API。

- https://lightview.app/kai-yeung-court
- https://lightview.app/yu-fung-court
- https://lightview.app/hemma-sapphire

先啟用Python虛擬環境，再執行：

```powershell
python tools/import_lightview.py
# 重播已取得的三份 {slug}.html：
python tools/import_lightview.py --source-dir .cache/lightview
```

完整項目資料包存在 `.cache/lightview/*-bundle.json`，不提交。僅將與 `data/inventory.json` 身份相同且面積差不超過0.15平方米的供選單位增補至 `docs/data/lightview.json`；`data/lightview/provenance.json`保存來源HTML雜湊、匹配數及未配對原因。匹配以屋苑／座／樓層／室號為準，灝然1A對應T1A。不可從相鄰樓層推算或把缺值填零。

本次啟陽苑746/750、裕豐苑106/140、灝然559/596，共1,411伙；其餘75伙包括54伙缺少模型記錄及21伙面積不符，全部保留官方單位資料。其餘七個項目沒有本次Lightview增補。檢查schema、三季時數及早午後總和、景觀比例合計、全景路徑後才替換增補檔；任一解析錯誤應停止，保留前次快照。

日照為晴天模型，景觀為窗外120度模擬，未計天氣，不能稱實景或現時供應。城市模型及圖則日期須保留；未來建築物情境若來源有提供則保留原欄位，頁面目前展示基準情境，連結原站查看3D／全景。未下載全景圖片及政府3D圖磚，不複製未獲取的渲染引擎。

`model.js`負責坐向、最少冬至日照／天空／水面比例篩選及排序、CSV增補；缺值排序放最後，設定分析篩選（包括0）排除無資料單位。增補載入失敗時，官方單位清單仍可操作。驗證沿用上方Python及Node命令，另檢查手機抽屜、分析詳情及原站對應單位連結。

## Design Context

使用者為居民及家人，已指定清晰實用、繁中、淺色、大字易讀。保留緊湊比較表與手機完整篩選功能，日期及核實狀態要顯眼。設計原則見 `.impeccable.md`。

手機篩選採用右側抽屜及固定漢堡圖示按鈕，使用原生dialog提供背景隔離、焦點限制及Escape關閉；桌面仍是常駐側欄。非操作文案使用浪漫主義、日常意象及溫柔語氣；操作標籤、數據、狀態、錯誤和來源限制維持直接精確。

在已載入網頁、寬度650px或以下的瀏覽器中執行 `tests/mobile.browser.js` 可檢查抽屜、焦點隔離／返回、篩選及重設；另以實際鍵盤檢查Escape及Tab，並確認桌面切換回常駐側欄。此檔只在瀏覽器執行，不屬Node測試。

## 狀態介面

預設顯示全部特設供選單位，可篩選已揀選或未揀選。移除原「官方已核對」狀態、核對來源checkbox和面積快捷按鈕；數值面積篩選仍保留。匯出CSV要含揀選狀態、來源原始狀態、來源及日期，已揀選單位的價格只代表官方價單售價。
