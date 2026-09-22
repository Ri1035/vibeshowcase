# vibeshowcase-api · Cloudflare Worker 后端

基于 Cloudflare D1 的作品数据 API，作为展示站的**后端地基**。
当前用 D1 持久化，存储层抽象在 `src/storage.js`，未来换其他服务只需替换该文件。

## 目录
```
worker/
├── wrangler.toml      # Worker + D1 绑定配置
├── schema.sql         # D1 建表 SQL（一次性初始化）
└── src/
    ├── index.js       # API 路由（REST）+ CORS
    ├── storage.js     # 存储层抽象（当前 D1 实现）
    └── probe.js       # 部署探活（HEAD→GET）
```

## API
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects` | 全部作品 |
| GET | `/api/projects/:id` | 单条 |
| POST | `/api/projects` | 新增 |
| PUT | `/api/projects/:id` | 更新 |
| DELETE | `/api/projects/:id` | 删除 |
| POST | `/api/projects/:id/detect` | 探活 cf_url 并回写 status |
| GET | `/api/export` | 导出全量（回退缓存） |
| GET | `/api/health` | 健康检查 |

## 开始使用
```bash
cd worker
npx wrangler d1 create vibeshowcase          # 创建数据库（复制 database_id）
# 编辑 wrangler.toml 填入 database_id
npx wrangler d1 execute vibeshowcase --file=schema.sql   # 建表
npx wrangler dev --config worker/wrangler.toml           # 本地调试
npx wrangler deploy --config worker/wrangler.toml        # 部署
```

> 本地无 D1 时，设置环境变量 `BYPASS_DB=1` 会退回内存存储，便于先调通路由。

## 与前端对接
前端已内置数据适配器：部署 Worker 后，前端优先请求 `/api/projects`，
请求失败自动回退到本地 `data/projects.json`。见根目录 README「前端接入」。