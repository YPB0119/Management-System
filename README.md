# 商品交易信息管理系統

## 專案簡介
基於 Vercel Serverless Functions + Neon 資料庫的全靜態前端 (HTML/CSS/JS) 解決方案，提供商戶與購物者雙端體驗：登入 / 註冊、商品增刪改查、下單與訂單狀態處理。所有介面與資料均採 UTF-8，保證中文無亂碼。

## 快速開始
1. 安裝相依：`npm install`
2. 準備環境變量：在本地建立 `.env`，於 Vercel 專案設定同名環境變量
   ```env
   DATABASE_URL=你的Neon連線字串
   ```
3. 本地開發：`npm run dev`（需安裝 Vercel CLI）
4. 部署：將專案推送至 Vercel，serverless API 會自動連上 Neon；初次請求時自動建表並插入預設帳號：
   - 商戶：merchant / merchant
   - 購物者：buyer / buyer

## 目錄結構
- `index.html` / `styles.css` / `app.js`：前端頁面與互動邏輯
- `api/`：Vercel Serverless Functions
  - `auth/login.js`、`auth/register.js`：登入與註冊
  - `products.js`：商品列表、增刪改查
  - `orders.js`：下單、訂單查詢、狀態更新
  - `db.js`：資料庫連線、建表與預置資料
  - `utils.js`：通用工具（JSON 解析、錯誤回應）

## 功能概覽
- 商戶：新增/編輯/刪除商品、查看全部訂單、更新訂單狀態（待付款/待發貨/已發貨/已完成）
- 購物者：瀏覽商品並下單、查看本人訂單
- 安全：密碼使用 `bcrypt` 雜湊；連線透過 `DATABASE_URL` 環境變量，支援 Neon SSL。

## 注意事項
- Neon 為雲端 Postgres，需在連線參數中啟用 SSL（已在程式碼中設定 `rejectUnauthorized: false`）。
- 若要重置資料，可在資料庫端自行清空表或刪除後重新觸發建表流程。
