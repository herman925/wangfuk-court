# Lightview 功能與資料調查

調查日期：2026-11-13。目標：了解 [光景 Lightview](https://lightview.app/) 的資料及功能，供宏福苑特設銷售計劃比較工具使用。**本專案供選範圍維持原有4,443伙**；Lightview 的屋苑目錄及模擬單位數不能代替官方供選名單、售價或揀選狀態。

## 授權與資料性質

使用者在本次工作中明確表示已取得擷取及使用授權；本次依該使用者陳述執行，沒有另行索取證明或聯絡網站營運者。這不是聲稱網站採用開放資料授權：[使用條款](https://lightview.app/terms)第3、5節分別訂明擷取須事先書面同意，以及軟件、模擬畫面、重繪圖則與第三方資料的權利歸屬。

首頁及條款說明，模擬以售樓說明書及地政總署三維地圖為基礎；數字不是賣方或政府提供／認可的售樓資料。整合時保留 Lightview 來源、模擬標示、資料日期及限制。取得本網站內容的授權，不代表取得第三方政府資料的所有權。

## 證據與分析邊界

本機證據位置：`%TEMP%/wangfuk-lightview-analysis/`。完整資料只作本機研究快取；本報告不附上整份原始彙編。

| 證據 | 內容及用途 |
|---|---|
| `public-js/`、`script-urls.json` | 從公開頁面取得的18個已發布 JavaScript 檔，合共1,021,000 bytes；Next.js／Turbopack 發布產物 |
| `rea-analysis.json` | REA 靜態分析完整 Evidence；約197 MB，未作原文大量轉載 |
| 三個 `*-bundle.json` | 啟陽苑、裕豐苑、灝然頁面攜帶的結構化資料 |
| 主工作階段瀏覽器觀察 | 實際選樓、看景觀及資源載入；與靜態分析分開記錄，見下文 |

REA Evidence ID：`ev_4855aa4f1a6a0e9174f429cd3c962c2206c8e74119904d1227b37eb95e6731d4`。

分析器：`rea-javascript-application` v1；operation：`analyze_javascript_application`；authority：`shipped-artifact`；confidence：`derived`。輸入目錄 SHA-256：`3dd8ce1d4699ee03f5b61f759ab83aecaf5397c9a6381d30f3ec9bf8307bc937`。

`JavaScriptApplicationGraph` 共295個節點、388條邊：250個 JavaScript module、18個 asset、18個 endpoint、6個 storage，以及各1個 artifact、service-worker、unknown。這些是分析器識別的靜態關係，**不表示所有端點、儲存或功能已實際執行**。未發現 integrity contradictions。

覆蓋限制：17個 JavaScript 檔完成解析；`3n7zfry7sjo-4.js` 因分析 worker 用盡1,024 MiB V8 old-space heap 而略過。別名展開亦達512個額外 selector states 上限。圖譜不完整；動態載入、混淆及未解析路徑仍可能未知。REA 把 JavaScript／HTML 當靜態文字，沒有執行 bootstrap。工具摘要中的 Electron 專用零值不能用來否定網站功能。

## 頁面資料結構及覆蓋

三個頁面均攜帶 `{id, project, metrics, panos, text, kind, stage}`。這是發送至瀏覽器的資料包，並非取得了營運者的後端資料庫。

| 網站項目 | 樓座數 | `metrics.windows` 記錄 | 全景索引記錄 | 售樓書日期 | 三維城市模型日期 |
|---|---:|---:|---:|---|---|
| [啟陽苑](https://lightview.app/kai-yeung-court) | 2 | 1,794 | 1,794 | 2026-04-23 | 2026-10-26 |
| [裕豐苑](https://lightview.app/yu-fung-court) | 4 | 1,775 | 1,775 | 2026-07-21 | 2026-11-12 |
| [灝然](https://lightview.app/hemma-sapphire) | 10 | 1,241 | 1,241 | 2026-09-21 | 2026-10-11 |

「記錄」是 Lightview 的樓座／樓層／單位鍵數，不是宏福苑原供選或剩餘伙數。上述三項是本次取得及核對的範圍，不能據此聲稱另外七個項目永久沒有資料。

資料包 SHA-256：

| 檔案 | SHA-256 |
|---|---|
| `kai-yeung-court-bundle.json` | `18732fca16fa8a951739c84cf62d3d99cd2bdcbf5a6db1c801def0164388130c` |
| `yu-fung-court-bundle.json` | `d5225bd25dd62485c3119c04ccbfdc2417c6dfee401131263960a164a7c6f8c3` |
| `hemma-sapphire-bundle.json` | `931dbc48db1fddbf172ff624baa6f7a107f6eb9fb0b4cc927b11cd47734eb3c8` |

## 功能如何運作

以下靜態觀察來自主資料包及[已發布的應用程式 chunk](https://lightview.app/_next/static/immutable/chunks/1e2x3kzc3ppgu.js)，以人工追查補充上述 REA 圖譜。

| 功能 | 已觀察的機制 | 限制／未確認事項 |
|---|---|---|
| 圖則、樓座、樓層 | `project.site` 包含原點、地界及方向；`towers` 包含 footprint、walls、樓層 mPD、逐室 outline、實用面積及房數。`flatOn`／`planOn` 按樓層取圖則 | 不能假定每層均採標準層平面；`representativeFloors` 並不一定包括全部樓層 |
| 客廳方向及觀景點 | `flat.living` 有 lat、lon、`facingDeg`、方向文字及露台／開口尺寸；啟陽苑A座1室例為314.7°、西北 | 應按樓座及單位精確配對，不能由室號猜方向 |
| 日照 | `metrics.windows[towerId][floorLabel][flatId].sun` 預存夏至、春分、冬至的總時數、上午／下午時數及 `sunlit` 時段 | 是預計算模擬，不是現場量測或天氣預報 |
| 景觀比例 | 同一單位記錄的 `view` 有 sky／water／greenery／building／other 百分比 | 標準120°水平視野，向下20°至向上40°；不是整間屋的景觀或採光比例 |
| 未來建築物 | 有變化的單位可附 `withFuture`；開關切換至相應 sun／view，其他情況用原值 | 只涵蓋模型列出的未來建築物；不能等同所有已批或未知發展 |
| 全景預覽 | `panos.panos[tower][floor][flat]` 提供 JPG 路徑；預覽按 facingDeg 及 leftEdgeBearingDeg 裁切約120°範圍 | 本次取得索引，不等於下載或驗證全部全景圖片 |
| 日照時間滑桿 | `sunPosition` 依經緯度、季節及時刻計算太陽方向；畫面光感隨太陽高度變化；直接日照則查預存時段 | 滑桿15分鐘步距與離線5分鐘採樣是兩個不同層次 |
| 迎風提示 | 以月度盛行風方向與 facingDeg 比較的門檻規則，部分標籤亦依日照時數門檻生成 | 不是流體動力學／室內通風模擬，附近樓宇遮風沒有納入該提示 |
| 比較 | 最多3個 `{towerId,floorLabel,flatId}`，去除重複，再讀相應幾何及 metrics | 已追到客戶端比較狀態，不代表有跨屋苑後端資料庫 |
| 分享 | URL 編碼 tower、floor、flat、season、hour、future、view、compare；程式約300 ms 後 `history.replaceState`。可用 `navigator.share` 或剪貼簿 | 程式另有受條件控制的 `POST /api/share`，本次沒有呼叫或驗證其服務端行為；普通 URL 已可保存選樓狀態 |
| 離線保存 | 有 Cache API 讀取及向 service worker 發送 `save`、URL清單和進度通訊的程式 | 靜態程式不證明離線保存已在本次成功執行 |

`project.generatedBy` 明示 `pipeline/build_project.py (do not edit by hand)`；`metrics.generatedBy` 明示 `pipeline/build_metrics.py (do not edit by hand)`。**觀察**是資料標記及預存結果；**推論**是圖則／三維資料先由離線管線產生幾何、日照及景觀指標，再由網頁讀取。原始 Python 管線、完整重建算法及誤差驗證並未取得。

日照設定每5分鐘採樣，計及城市模型、項目樓座及上層露台；量度點在客廳開口、樓面以上1米。模型註記為 `medium` 信心，未計雲霧、窗框及露台側牆。三維觀景 eyeHeightM 可為1.5米，與日照量度點不能混用。綠化分類依三維影像色彩，水面亦有高度分類門檻，因此百分比仍有模型誤差。

## 三維場景：靜態與實際觀察

**靜態觀察：**主程式以 `e.A(22654).then(({SceneController}) => …)` 延遲載入場景控制器，傳入 canvas、地標及目前選樓狀態，並提供更新及 dispose。該控制器實作未包含在本次完整解析的範圍；不能只因資料採 Cesium 3D Tiles 格式便聲稱前端使用 CesiumJS，也未確認其他渲染引擎。

**主工作階段實際觀察（人工證據，並非 REA 靜態結果）：**在自有瀏覽器頁面 `fdfea40c-5d41-4955-9888-4ad09fd5a96c` 選啟陽苑A座20樓1室後，URL 為 `?t=A&f=20&u=1&s=summer&h=15`；按「看景觀」增加 `v=1`，顯示三季選項、時間滑桿、未來建築物開關及比較按鈕。資源觀察確認瀏覽器實際請求 `https://data.map.gov.hk/api/3d-data/3dtiles/…` 下的 `.json`／`.b3dm` tiles。沒有擷取或重用帶憑證端點。

因此可確認實際三維政府圖磚載入；仍未完整追查攝影機飛行、地形遮擋、光照與 ray casting 引擎內部實作。

## 本專案整合結果及更新原則

主工作階段使用 `tools/import_lightview.py` 以官方供選名單為主表，按屋苑／座／樓層／室號匹配，再核對面積。安全匹配合共1,411伙：

| 屋苑 | 供選數 | 納入模擬資料 | 排除／缺資料原因 |
|---|---:|---:|---|
| 啟陽苑 | 750 | 746 | 4伙沒有可用匹配資料 |
| 裕豐苑 | 140 | 106 | 13伙缺模擬記錄；21伙面積不符，已排除 |
| 灝然 | 596 | 559 | 37伙缺模擬記錄 |

上述是主工作階段匯入結果，與三個完整 Lightview 資料包的記錄數用途不同。保留其餘供選單位並顯示資料未提供；不以相鄰樓層填補，不以模擬資料覆寫官方售價或揀選狀態。公開網站只發佈已匹配供選單位所需的增補資料，原始完整資料包留在本機快取。

後續更新應重新取得同一公開頁面的結構化資料，核對 schema、資料日期、雜湊及單位身份／面積，重新產生匹配及排除統計。Lightview 網頁不是承諾穩定的公開 API，chunk 名稱及資料結構可能改變；匹配失敗應保留缺值。

## 可直接使用的官方來源

| 需求 | 官方來源與適用範圍 |
|---|---|
| 供選及揀選狀態 | [房屋局特設計劃](https://www.hb.gov.hk/wfc/tc/special-sales-exercise/index.html)及本專案 `AGENTS.md`／`data/sources.json` 列出的房委會、房協文件；樂嶺軒按使用者指示採用其PDF狀態來源 |
| 自建三維場景 | [地政總署3D Visualisation Map API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/3d-visualisation-map-api)：WGS84、Cesium 3D Tiles；按該頁條款保留政府來源及權利鳴謝 |
| 離線城市模型 | [DATA.GOV.HK 三維可視化地圖模型](https://data.gov.hk/en-data/dataset/hk-landsd-openmap-3d-visualisation-map-tile-based-models)：以斜攝影像建立的全港模型，提供OBJ、OSGB、Cesium 3D Tiles等途徑 |
| 盛行風參考 | [香港天文台每日盛行風方向資料](https://data.gov.hk/en-data/dataset/hk-hko-rss-daily-prevailing-wind-direction)；可作地區風向參考，不能直接推出單位風速或通風量 |

這些官方開放來源能支援另行建立模型；不會直接提供 Lightview 的逐伙客廳方向、重繪圖則、預計算日照／景觀或全景成品。
