# Changelog

本项目采用语义化版本（SemVer）。

## [1.1.0] - 2026-09-22
### 新增
- 手动录入模式：由用户填写 GitHub 仓库链接、Cloudflare 链接、描述，进入 `data/entries.json`
- 部署自动检测脚本 `scripts/detect.mjs`：对 CF 链接探活，自动判定 `deployed` / `source`
- 卡片区分展示：**有部署 → 内嵌预览**，**无部署 → 显示 GitHub 图标并跳转仓库**
- 统一品牌图标（透明底 SVG logo）作为站点头像与 favicon
- 版本管理：`VERSION`、`package.json`、`.gitignore`、git init
- 日志机制：`scripts/log.mjs`，运行记录写入 `logs/`
- 后端地基：Cloudflare D1 worker（CRUD API + schema），为后续服务预留

### 变更
- 数据模型重心从「自动抓取多账号仓库」转向「手动维护 + 自动检测」

## [1.0.0] - 2026-09-22
- 初始版本：趣味插画主题静态展示站、主题切换系统、多账号同步脚本原型