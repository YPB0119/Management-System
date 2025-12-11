# 商品交易信息管理系统

## 项目简介
基于 Vercel Serverless Functions + Neon 数据库的前后端一体（HTML/CSS/JS）方案，支持商户 / 购物者双端：登录 / 注册、商品增删改查、下单与订单状态处理，UTF-8 全面适配中文。

## 快速开始
1. 安装依赖：`npm install`
2. 准备环境变量：本地 `.env`，Vercel 项目同名变量
   ```env
   DATABASE_URL=你的Neon连接串
   ```
3. 本地开发：`npm run dev`（需安装 Vercel CLI）
4. 部署：推送到 Vercel 即可，首次请求会自动建表并插入预设账号：
   - 商户：merchant / merchant
   - 购物者：buyer / buyer

## 目录结构
- `index.html` / `styles.css` / `app.js`：前端页面与交互逻辑
- `api/`：Vercel Serverless Functions
  - `auth/login.js`、`auth/register.js`：登录与注册
  - `products.js`：商品列表、增删改查
  - `orders.js`：下单、订单查询、状态更新
  - `upload.js`：商品图片上传（Vercel Blob，JPG/PNG，≤5MB）
  - `db.js`：数据库连接、建表与预置数据
  - `utils.js`：通用工具（JSON 解析、错误响应）

## 功能概览
- 商户：新增/编辑/删除商品（含图片上传）、查看全部订单、更新订单状态（待付款/待发货/已发货/已完成）
- 购物者：浏览商品（缩略图/详情）、下单、查看本人订单
- 安全：密码使用 `bcrypt` 哈希；连接通过 `DATABASE_URL` 环境变量，支持 Neon SSL。

## 注意事项
- Neon 为云端 Postgres，需在连接参数中启用 SSL（已在代码中配置 `rejectUnauthorized: false`）。
- 如需重置数据，可在数据库端清空表或删除后重新触发建表流程。
