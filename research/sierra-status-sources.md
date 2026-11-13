# 樂嶺軒揀選狀態來源查核

查核日期：2026-11-13。只研究宏福苑特設計劃供選300伙，不擴展至樂嶺軒整幢696伙。

| 來源 | 本次結果 | 適用範圍 |
|---|---|---|
| [房屋局特設計劃](https://www.hb.gov.hk/wfc/tc/special-sales-exercise/index.html) | 列明樂嶺軒供選300伙 | 供選總數，沒有逐伙最新狀態 |
| [房委會房協項目頁](https://hos.housingauthority.gov.hk/mini-site/ssewfc/tc/hkhs-ssf-projects.html) | 樂嶺軒連結回房協項目官網 | 沒有另附獨立完整狀態表 |
| [房協最新銷售情況](https://sierraterrace.hkhs.com/sales-info/latest-sales-status/) | 頁面顯示「即將推出」；公開文件查詢回傳空清單 | 本次沒有找到可取代PDF的完整已選／未售名單 |
| [房協成交紀錄冊](https://sierraterrace.hkhs.com/sales-info/register-of-transactions/) | 公開文件清單提供2026-11-12版，更新至17:30 | 可靠的交易記錄，含臨時／正式合約及可能終止的交易；不涵蓋所有預留／已揀選 |
| [成交紀錄冊PDF](https://sierraterrace.hkhs.com/uploads/Sierra-Terrace_ROT_20261112.pdf) | 特設供選300伙內有224個單位鍵出現，全部在使用者PDF的272伙已選之內；另48伙沒有記錄 | 用作核對，不從沒有記錄推算未選 |
| 使用者提供的2026-11-12已選PDF | 272伙已選，300伙內餘28伙 | 按使用者指示維持為樂嶺軒狀態基線，兩種狀態均明示來源 |

官方文件發現方法：POST `https://sierraterrace.hkhs.com/api/`，JSON如下，分別以 `latest-sales-status` 及 `register-of-transactions` 查詢：

```json
{"query":"query($type:String!){listDocs(type:$type){date url title}}","variables":{"type":"register-of-transactions"}}
```

需帶 `Content-Type: application/json`、`Accept-Language: tc`、一般瀏覽器User-Agent、官網Origin及Referer；沒有這些標頭時，本次測試曾回傳403。不要由日期猜PDF檔名；從官網清單取最新文件，限制為同一官方網域的`/uploads/*.pdf`並核對清單及PDF內日期。沒有查詢帳戶或私人端點。

`tools/check_sierra.py`已納入每日排程，生成`docs/data/sierra-audit.json`，保留文件清單、雜湊、日期及範圍內交易鍵。交易鍵去重但不自行認定合約是否仍有效；成交冊存在終止／重售的情況，更不能以「300減成交冊」稱為剩餘供選。發現新銷售狀態文件或使用者已選名單以外的交易鍵會在Actions警示，待驗證來源格式及完整性。

本次結論：找到可靠的官方交易來源，仍未找到足以完整自動更新全部300伙已揀選／未售狀態的公開來源。保留PDF來源及日期，不把每日檢查時間寫成選樓狀態的更新日期。未聯絡房協或索取非公開資料。
