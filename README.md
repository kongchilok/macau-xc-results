# 澳門學界越野跑成績（非官方）

手機優先的靜態網站，整理教育及青年發展局公布的學界越野跑比賽成績。第一期收錄第 38–47 屆（2016/17–2025/26）。

## 結構

| 路徑 | 用途 |
|---|---|
| `scripts/sources.json` | 各屆官方檔案 id（新增一屆在此加一行） |
| `scripts/fetch.py` | 下載官方 xls／PDF 到指定資料夾（原始檔不入 repo） |
| `scripts/parse.py` | 解析 xls／PDF → `docs/data/results.json` |
| `scripts/enrich.py` | 統一校名、跨年同一人配對，輸出存疑清單 `review_persons.csv`（不入 repo） |
| `scripts/check.py` | 內部完整性檢查（人數、名次、時間、團體冠軍重算） |
| `scripts/preview.py` | 第 48 屆參賽名單配對往績 → `docs/data/preview48.json`（名單本身在 `private/`，不入 repo） |
| `scripts/redactions.json` | 應要求隱藏的學生編號 |
| `docs/data/race48.json` | 第 48 屆賽程、距離（秩序冊／章程）、各校人數 |
| `docs/data/crests.json` | 真校徽圖片對照（代碼 → `img/crest/…`），未登記者自動生成盾形徽章 |
| `docs/data/site.json` | 網站設定（移除申請渠道） |
| `docs/` | 網站本體（GitHub Pages 發布此資料夾） |

## 更新資料

```powershell
python -P -X utf8 scripts/fetch.py <暫存資料夾>
python -P -X utf8 scripts/parse.py <暫存資料夾> docs/data/results.json
python -P -X utf8 scripts/enrich.py docs/data/results.json review_persons.csv
python -P -X utf8 scripts/check.py docs/data/results.json
python -P -X utf8 scripts/preview.py docs/data/results.json docs/data/race48.json private/startlist48.csv docs/data/preview48.json private/preview48_review.csv
python -P -X utf8 scripts/predict.py docs/data/results.json docs/data/preview48.json   # 預測排名＋回測（須在 preview.py 之後）
```

學生編號（pid）固定為「第一次出賽的屆數＋組別＋名次」（如 `p47MB002`），重建資料不會改變，連結與隱藏清單長期有效。

需要：`pip install xlrd pdfplumber`

## 自動測試

```powershell
python -P -X utf8 -m pytest tests/
```

- `tests/test_data.py`：結構、名次、時間、團體冠軍按章程重算、已知值、跨年配對合理性
- `tests/test_ui.py`：Playwright＋本機 Chrome，手機 375×812，逐頁功能、無橫向捲動、觸控尺寸、語言切換
- 設 `XC_RAW=<原始檔資料夾>` 會再逐筆核對官方 xls／PDF（共 78 項）

需要：`pip install pytest playwright`

## 設計規則

- 深色底＋品牌綠（`--accent`）只用於操作及選取；金銀銅只表示名次；藍／粉只表示男子／女子組
- 圓角：容器 16px、小方塊 12px、可按的膠囊及圓鈕全圓
- 圖表配色已用 dataviz 驗證器在深色底驗證（`--series-1/2/3`）
- 介面不使用長破折號；數字用 Barlow Condensed，其餘用系統中文字體

## 本機預覽

```powershell
python -m http.server 8765 --directory docs
```

## 換卡片相片

首頁資訊卡目前用 CSS 圖形底紋。取得授權相片後，放入 `docs/img/`，在 `styles.css` 對應卡片加 `--photo: url(img/xxx.jpg);` 即可。

## 私隱

網站設 `noindex` 及 `robots.txt` 禁止搜尋引擎收錄，頁尾有非官方聲明及移除申請連結。

## 熱門人氣（Supabase）

- 資料庫結構：`supabase/001_xc_views.sql`（`xc_pids` 學生名單、`xc_views` 瀏覽次數、`xc_hit()` 唯一寫入函數，每次 +1、只接受名單內編號；公眾只可讀）
- 學生名單：`supabase/002_seed_pids.sql`（由 results.json 產生；新增屆數後重新產生並執行）
- 網站設定：`docs/data/site.json` 的 `views = { url, key }`（key 為公開的 publishable key，可放在前端）；未設定時網站自動用「示範模式」只計本機
- 只存學生編號及次數，不記錄瀏覽者身份
