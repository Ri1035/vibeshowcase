# 🧑‍💻 作品集中台 · vibecoding 创意工坊

汇聚你所有 **vibecoding Web 应用** 的一站式展示站。你只需填入 GitHub 仓库链接与 Cloudflare 部署链接，系统自动检测部署状态并智能展示，随时可换整站皮肤风格。

## ✨ 特性

- **网页管理端（录入/编辑/发布）**：点顶栏「管理」，输入密钥即可在浏览器直接添加、编辑、删除作品，保存时自动探活判定部署状态，写入 Cloudflare D1。
- **分页浏览**：作品按每页 9 条分页展示，含页码导航，不需滚动到底。
- **手动录入 + 自动检测**：填 gh 链接 / cf 链接 / 描述，自动对 CF 地址探活，**有部署 → 在线预览**，**无部署 → GitHub 图标跳转**。
- **Cloudflare D1 后端**：独立 Worker API（分页 CRUD + 管理鉴权 + 部署检测），存储层抽象，未来无缝换其他存储/服务。
- **前端数据适配器**：优先请求 D1 API，失败自动回退本地 `data/projects.json`（不白屏）。
- **趣味插画主题 + 可换皮肤**：设计令牌收敛到 CSS 变量 + 主题注册表，换皮肤不改组件代码。
- **透明底品牌图标**：站点头像、favicon 均使用你上传的透明底 SVG。
- **版本管理与日志**：git + 语义化版本 + `logs/` 运行日志沉淀。

## 📁 两种工作流

### 方式 A：纯静态（无后端，最快上手）
```
1. cp config/entries.example.json data/entries.json   # 填 gh/cf/描述
2. node scripts/detect.mjs                            # 自动检测部署 → 生成 data/projects.json
3. python3 -m http.server 8080                        # 本地预览
4. npx wrangler pages deploy . --project-name vibeshowcase   # 部署 CF Pages
```
前端读取本地 `data/projects.json`（无后端时会自动回退到它）。

### 方式 B：D1 管理后台 API（已部署启用 ✅）
线上已启用独立 Worker `vibeshowcase-api`（绑定 D1 库 `vibeshowcase`），前端指向它加载数据并支持网页管理。

```
# 前端配置 API 地址：编辑 js/config.js 的 API_BASE（默认已指向生产的 Worker）
# Worker API 端点（/api/...）：
#   GET    /api/projects?page=1&limit=9&q=关键词  分页列表
#   POST   /api/projects [ADMIN]                  新增并自动检测部署
#   PUT    /api/projects/:id [ADMIN]              更新
#   DELETE /api/projects/:id [ADMIN]              删除
#   GET    /api/admin/_verify [ADMIN]             校验管理密钥
#   GET    /api/health /api/export                健康检查 / 导出
```

管理密钥注入（不入库、不提交仓库）：
```
cd worker
npx wrangler secret put ADMIN_KEY     # 输入密钥，例如 vs_xxxxxxxx
```

重新部署 Worker / 建表：
```
npx wrangler deploy --config worker/wrangler.toml
npx wrangler d1 execute vibeshowcase --remote --file=worker/schema.sql   # 建表
npx wrangler d1 execute vibeshowcase --remote --file=worker/seed.sql     # 可选：预填示例
```

## 📝 手动录入格式（data/entries.json）

```jsonc
{
  "projects": [
    {
      "ghUrl": "https://github.com/用户名/仓库",
      "cfUrl": "https://应用.pages.dev",   // 可选；填了会自动探活
      "desc": "一句话描述",
      "tags": ["工具", "效率"]
    },
    {
      "ghUrl": "https://github.com/用户名/另一仓库",
      "cfUrl": "",                          // 不填 → 判定为仅源码，显示 GitHub 图标
      "desc": "还没部署，只显示 GitHub 入口"
    }
  ]
}
```

## 🎨 换风格（个性化接口）

整站视觉由 **设计令牌（CSS 变量，`styles/tokens.css`）** 驱动，组件不写死任何值。换风格三步：

1. `styles/themes/` 新建 `<名字>.css`，用 `:root[data-theme="<id>"]` 覆盖 tokens 变量。
2. `js/themeManager.js` 的 `THEMES` 数组注册新主题。
3. 顶栏「换肤」即可切换，选择自动存入 `localStorage`。

> 参考 `styles/themes/playful.css`。变量按 `色彩`/`字体`/`圆角`/`间距`/`阴影`/`动效`/`吉祥物`/`贴纸` 分组。

## 🔐 凭据说明

- token 一律放 `.env`（已 gitignore，绝不提交），或环境变量注入。
- 若 token 曾在聊天/日志中明文出现，请尽快在 GitHub 与 Cloudflare 后台**轮换**。

## 🗂 目录结构

```
vibeshowcase/
├── index.html                     # 单页入口
├── styles/  tokens.css/main.css/themes/playful.css
├── js/      themeManager.js / app.js
├── data/    entries.json(录入) / projects.json(生成) 
├── config/  entries.example.json
├── scripts/ detect.mjs / log.mjs / sync.mjs
├── worker/  wrangler.toml / schema.sql / src/ (D1 后端地基)
├── assets/  logo.svg（透明底品牌图标）
├── logs/    运行日志
├── VERSION / CHANGELOG.md / package.json
```

## ⚙️ 部署判定逻辑

`scripts/detect.mjs` + Worker `probe.js`：对 `cfUrl` 做 HEAD 探索（失败退化 GET）。
- 可达（2xx/3xx）→ `status=deployed`，`preview=cfUrl`
- 不可达或无 cfUrl → `status=source`，仅 GitHub 图标入口