# 日語時事 × ぶいすぽっ！每日學習誌

整合日本每日新聞（N3–N1 生詞解析）與 ぶいすぽっ！（VSPO!）過去 24 小時切り抜き聽力訓練的個人日語學習網頁（繁體中文介面）。

## 功能模組
- **每日日本新聞學習區**：從 NHK NEWS WEB（備援 Google News JP）RSS 抓取政治、經濟、民生・社會新聞，由 Gemini API 生成 100–150 字繁中重點概要、原文連結與 5–8 個 N3–N1 核心生詞解析（自動過濾 N5–N4）。
- **VSPO! 每日切り抜き學習區**：從 YouTube Data API v3 與／或 Holodex API v2 搜尋過去 24 小時 ぶいすぽっ！日文切り抜き候選池，依據前端成員權重抽籤選出 1 部並提供 5 個口語／VTuber 常用語與 3 個口語文法解析。
- **成員偏好權重設定抽屜**：涵蓋 25 位 ぶいすぽっ！JP 成員、代表色標記、0～10 滑桿調權，設定儲存於本機 `localStorage`。

## 本機指令
```powershell
npm.cmd install
npm.cmd run dev          # 啟動開發伺服器
npm.cmd test             # 執行單元測試
npm.cmd run update-daily # 抓取真實 RSS / YouTube 並更新 public/data/daily-content.json
npm.cmd run build        # 建置靜態網站至 dist/
```

### 本機手動測試真實 API 抓取
1. 複製 `.env.example` 為 `.env`，填入 `GEMINI_API_KEY` 與 `YOUTUBE_API_KEY`（選填 `HOLODEX_API_KEY`）。
2. 執行 `npm.cmd run update-daily`，將會更新 `public/data/daily-content.json`。

## GitHub Actions 自動排程與 GitHub Pages 部署
1. 將本專案推播至 GitHub Repository（預設主分支為 `main`）。
2. 至 Repository 的 **Settings → Pages → Build and deployment**，將 **Source** 改為 **GitHub Actions**。
3. 至 **Settings → Secrets and variables → Actions → Repository secrets** 新增：
   - `GEMINI_API_KEY`（必填）：Google AI Studio 申請之免費 API Key。
   - `YOUTUBE_API_KEY`（必填）：Google Cloud Console 申請之 YouTube Data API v3 Key。
   - `HOLODEX_API_KEY`（選填）：若同時設定可合併強化 ぶいすぽっ！成員標記。
4. 排程腳本（`.github/workflows/daily-update.yml`）將於每天台灣時間 `08:30`（`30 0 * * *` UTC）自動執行抓取並 Commit & Push `public/data/daily-content.json`，同時重新建置部署至 GitHub Pages；亦可隨時於 Actions 頁籤使用 `workflow_dispatch` 手動觸發。
