# 日語時事 × ぶいすぽっ！每日學習誌

這是一個繁體中文介面的個人日語學習網頁，結合每日日本時事新聞閱讀與ぶいすぽっ！（VSPO!）過去 24 小時日文精華剪輯（切り抜き）聽力練習。網站以 React 與 Vite 建置為純靜態前端，每日藉由 GitHub Actions 自動抓取最新新聞與影片資料並生成學習筆記，目前同步部署於 [Vercel](https://vspo-jp-news-study.vercel.app/) 與 [GitHub Pages](https://shineharumi0918.github.io/vspo-jp-news-study/)，在電腦與手機瀏覽器皆可直接開啟。

## 功能說明

### 每日日本新聞學習區

每日排程會優先從 NHK NEWS WEB 的 RSS 來源抓取 4 篇日本時事新聞，涵蓋政治 1 篇、經濟 1 篇與民生社會 2 篇，若 NHK 來源暫時無法連線則改由 Google News 日本版備援，過程中也會略過「【動画】Pickup NEWS」這類純影音導覽標題與每日例行的「首相動静」行程紀錄，並比對近 7 天的歷史紀錄檔，避免近期出現過的新聞重複入選。

取得新聞與內文摘錄後，腳本會將當日篇目批次送交 Gemini API，為每篇新聞整理約 110 至 140 字的繁體中文重點概要、標題平假名讀音、原文來源連結，以及 6 個 JLPT N3 至 N1 程度的新聞生詞解析，並排除 N5 與 N4 基礎單字。新聞卡片的標題、生詞與例句皆附有日語朗讀按鈕，生詞例句也會自動標示出該單字的出現位置，方便對照上下文閱讀。

學完的單字可一鍵標記為已熟記，系統會連同讀音、詞性、例句與用法說明跨日儲存在瀏覽器本機的 `localStorage`，不會因隔天更新新聞而遺失，點選頁首的「已熟記」計數就能開啟側邊複習本。複習本採用與新聞區一致的單字卡排版，支援搜尋單字、依 JLPT 等級篩選、單字與例句分別朗讀、調整語速與單筆移除，也能匯出含 UTF-8 BOM 編碼的 CSV 檔，直接匯入 Anki 持續複習。

### ぶいすぽっ！每日剪輯聽力區

剪輯學習區可查詢 YouTube Data API v3 與 Holodex API v2，蒐集過去 24 小時內發布的ぶいすぽっ！日文剪輯影片，若同一支影片同時出現在兩處來源，會自動合併 Holodex 的成員標記與 YouTube 的完整說明欄，排除近 7 天已出現過的影片後，挑選最多 8 部涵蓋不同成員的候選影片組成當日候選池。辨識出場成員時，程式會先比對影片標題與 Holodex 成員標籤，兩者皆無結果才檢查影片說明欄，並預先移除說明欄常見的全體成員連結區塊，藉此降低誤判機率。

接著由 Gemini API 為候選池內的每部影片建立聽力輔助筆記，包含情境看點介紹、5 個遊戲或 VTuber 圈常用的口語詞彙，以及 3 個實況對話常見的口語文法說明。口語詞彙與文法例句皆附有發音按鈕，詞彙另提供可點擊的時間標記，按下即可讓內嵌的 YouTube 播放器跳轉至對應秒數，方便搭配畫面反覆練習聽力。

### 全域顯示設定與成員權重抽籤

頁首的「顯示與設定」收合面板整合了顯示模組切換、全域學習開關與剪輯抽選設定，其中「假名讀音、閃卡測驗、語速 1.0x／0.8x」三項開關會自動記憶於本機 `localStorage`，並同步套用至每日新聞、VSPO 剪輯聽力區與跨日生詞複習本。開啟閃卡測驗時，新聞生詞、複習本單字以及剪輯區的口語詞彙與文法解析都會先遮蔽中文說明，點擊後才逐一揭曉，適合用來自我檢測閱讀與聽力理解。

點選面板內的「成員權重設定」即可開啟側邊抽屜，當中完整收錄 25 位ぶいすぽっ！日本成員與各自代表色，使用者可利用 0 至 10 的滑桿或加減微調按鈕設定出現權重，設為 0 則代表暫不抽選該成員。前端會依權重從當日候選池抽出 1 部影片作為今日推薦，並將抽籤結果與成員權重儲存在本機 `localStorage`，除了支援隨時手動重新抽籤，若使用者將目前影片所屬成員的權重調降為 0，關閉抽屜時系統也會自動改抽其他正權重成員的影片。

## 系統架構與每日更新流程

專案採用「靜態前端搭配每日排程 JSON」的架構，前端載入頁面時會先顯示載入骨架畫面，待成功讀取 `public/data/daily-content.json` 後才渲染當日內容，僅在資料讀取失敗時動態載入備用範例資料，避免首屏閃爍或覆寫本機抽籤紀錄，而後端更新腳本會將近 7 天的已出現新聞連結、新聞標題與影片 ID 寫入 `public/data/history.json` 供隔日去重使用。

自動化流程由兩支 GitHub Actions 工作流程銜接執行，其中 `.github/workflows/daily-update.yml` 會在每天台灣時間 08:30（UTC `30 0 * * *`）定時啟動，也可隨時手動觸發 `workflow_dispatch`，執行 `scripts/update-daily.mjs` 後將變動的 `public/data/daily-content.json` 與 `public/data/history.json` 提交回 `main` 分支。每日更新完成後，`.github/workflows/deploy-pages.yml` 會依 `workflow_run` 事件接力執行單元測試與建置，將 `dist/` 發布至 GitHub Pages，而 `main` 分支的新提交也會同步觸發 Vercel 自動重新建置。

| 路徑 | 用途說明 |
| --- | --- |
| `src/` | React 19 前端元件、全域朗讀與無障礙抽屜 Hook、跨日生詞儲存與權重抽籤邏輯 |
| `src/styles/` | 依區塊拆分的樣式表，包含基底排版、頁首、新聞卡片、剪輯區與側邊抽屜 |
| `scripts/` | 每日資料更新主腳本 `update-daily.mjs`，以及 RSS 解析、成員比對、去重與 Gemini 批次呼叫模組 |
| `public/data/` | 靜態前端讀取的 `daily-content.json` 與近 7 天去重紀錄 `history.json` |
| `tests/` | 使用 Node 內建測試執行器的單元測試，驗證去重、成員比對、權重抽籤與生詞儲存 |
| `.github/workflows/` | 每日資料更新排程 `daily-update.yml` 與 GitHub Pages 部署設定 `deploy-pages.yml` |

## 本機開發與手動更新

本機環境建議安裝與 GitHub Actions 一致的 Node.js 22，安裝相依套件後即可啟動開發伺服器、執行測試或建置靜態網頁，若在 Windows PowerShell 遇到指令碼執行原則限制，只要將下方指令中的 `npm` 改為 `npm.cmd` 就能正常執行。

```bash
npm install
npm run dev          # 啟動 Vite 開發伺服器
npm test             # 執行單元測試
npm run update-daily # 抓取真實 RSS、YouTube／Holodex 並由 Gemini 更新每日資料
npm run seed-mock    # 寫入範例資料至 public/data/daily-content.json（不呼叫外部 API）
npm run build        # 建置靜態網站至 dist/
npm run preview      # 預覽 dist/ 建置結果
```

若要在本機手動測試真實 API 抓取，先將 `.env.example` 複製為 `.env` 並填入對應金鑰，再執行 `npm run update-daily`，腳本就會更新 `public/data/daily-content.json` 與 `public/data/history.json`。

| 環境變數 | 必要性 | 說明 |
| --- | --- | --- |
| `GEMINI_API_KEY` | 必填 | 於 Google AI Studio 申請的 Gemini API 金鑰，負責生成新聞與剪輯解析 |
| `YOUTUBE_API_KEY` | 二擇一（建議填寫） | 於 Google Cloud Console 申請的 YouTube Data API v3 金鑰，用以搜尋近 24 小時剪輯 |
| `HOLODEX_API_KEY` | 二擇一（選填） | 於 Holodex 帳號設定取得的 API 金鑰，與 YouTube 併用可提高成員識別準確度 |
| `GEMINI_MODEL` | 選填 | 指定優先使用的 Gemini 模型，未設定時依序嘗試 `gemini-3.1-flash-lite` 等 Flash-Lite 備援清單 |

日語朗讀功能採用瀏覽器內建的 Web Speech API，程式會嚴格挑選 `ja-JP` 日語語音（例如 Microsoft Nanami、Google 日本語或 macOS Kyoko），避免系統誤用中文語音唸出日文漢字。若本機作業系統尚未安裝日語語音包，點擊朗讀時頁面會顯示提醒並附上 Google 翻譯發音連結作為替代，Windows 使用者可前往「設定 → 時間與語言 → 語言與地區」新增日文語言套件中的文字轉語音功能，安裝後即可在 Chrome 或 Edge 直接發音。

## 部署與自動化設定

若要將本專案部署至自己的 GitHub 帳號與 Vercel，先將程式碼推送至 GitHub 儲存庫的 `main` 分支，再依序完成下列設定即可讓每日排程與靜態網站自動運作。

1. 前往儲存庫的 Settings → Pages → Build and deployment，將 Source 切換為 GitHub Actions。
2. 前往 Settings → Secrets and variables → Actions，在 Repository secrets 新增 `GEMINI_API_KEY`、`YOUTUBE_API_KEY` 與選填的 `HOLODEX_API_KEY`，若有需要自訂模型則在 Variables 新增 `GEMINI_MODEL`。
3. 確認 Actions 頁籤已啟用工作流程，之後每天台灣時間 08:30 便會自動更新資料並發布新版網站，也能隨時點選「每日日本新聞與 VSPO 剪輯更新排程」手動觸發測試。
4. 若希望同步部署至 Vercel，直接於 Vercel 匯入同一個 GitHub 儲存庫並選擇 Vite 框架（輸出目錄為 `dist`），每當排程將新資料推送至 `main` 分支時，Vercel 就會自動完成建置與上線。

## 授權條款與免責聲明

本專案的原始碼採用 [MIT License](LICENSE) 釋出，僅涵蓋此儲存庫中自行撰寫的程式、腳本與版面樣式。本站屬於個人日語學習用途的非官方工具，與ぶいすぽっ！（VSPO!）、NHK、Google News、YouTube 或 Holodex 並無官方關聯，頁面引用與整理的新聞來源、影片內嵌內容及相關商標、角色與影音著作權皆歸原權利人所有。
