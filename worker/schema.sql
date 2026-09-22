-- ============================================================
-- Cloudflare D1 Schema · 作品数据表
-- 应用方式：npx wrangler d1 execute vibeshowcase --file=worker/schema.sql
-- 或使用本地/远程 D1 控制台执行。
-- ============================================================

DROP TABLE IF EXISTS projects;

CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,              -- 稳定 id（如仓库名或随机 slug）
  title       TEXT NOT NULL,
  description TEXT,
  gh_url      TEXT,                          -- GitHub 仓库链接
  cf_url      TEXT,                          -- Cloudflare 部署链接
  status      TEXT NOT NULL DEFAULT 'source',-- deployed / source
  preview     TEXT,                          -- 在线预览地址（部署时）
  tags        TEXT,                          -- JSON 数组字符串
  language    TEXT,
  sort_order  INTEGER DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  detect_at   TEXT,                          -- 最近一次部署检测时间
  detect_note TEXT                           -- 最近一次检测说明
);

-- 便于按状态/时间排序
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at DESC);

-- ============================================================
-- 说明：
-- tags 以 JSON 数组字符串存储（如 '["工具","效率"]'），
-- 由 Worker 负责序列化/反序列化，保持 schema 简单。
-- 未来如需接入其他后端服务，id 字段可作为稳定标识对外暴露。
-- ============================================================