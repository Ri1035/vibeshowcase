// ============================================================
// STORAGE · 存储层抽象（D1 当前实现）
// ------------------------------------------------------------
// 这是后端工作的"数据接口"。所有 API 路由只依赖本模块的
// 方法，不直接碰 SQL。未来要换存储（Postgres、其他服务等）
// 只需替换本文件实现，路由无需改动。
// ============================================================

/**
 * @param {import("@cloudflare/workers-types").D1Database} db
 */
export function createStore(db) {
  return {
    // 分页 + 关键词过滤。返回 { rows, total, page, pageSize }
    async list(p = {}) {
      const q = String(p.query || "").trim();
      const page = Math.max(1, parseInt(p.page, 10) || 1);
      const limit = parseInt(p.limit, 10) || 9;
      const pageSize = Math.min(50, Math.max(1, limit));
      const offset = (page - 1) * pageSize;

      const where = q
        ? `WHERE title LIKE ? OR description LIKE ? OR tags LIKE ?`
        : "";
      const binds = q
        ? [`%${q}%`, `%${q}%`, `%${q}%`]
        : [];

      // 总数
      const countRes = await db
        .prepare(`SELECT COUNT(*) AS n FROM projects ${where}`)
        .bind(...binds)
        .first();
      const total = (countRes ? countRes.n : 0) || 0;

      const { results } = await db
        .prepare(
          `SELECT * FROM projects ${where} ORDER BY sort_order ASC, updated_at DESC LIMIT ? OFFSET ?`
        )
        .bind(...binds, pageSize, offset)
        .all();
      return { rows: (results || []).map(hydrate), total, page, pageSize };
    },

    async get(id) {
      const row = await db.prepare(`SELECT * FROM projects WHERE id = ?`).bind(id).first();
      return row ? hydrate(row) : null;
    },

    async create(project) {
      const id = project.id || slugify(project.title || project.gh_url || "app");
      await db
        .prepare(
          `INSERT INTO projects (id, title, description, gh_url, cf_url, status, preview, tags, language, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        )
        .bind(
          id,
          project.title,
          project.description || "",
          project.gh_url || "",
          project.cf_url || "",
          project.status || "source",
          project.preview || "",
          JSON.stringify(project.tags || []),
          project.language || "",
          project.sort_order || 0
        )
        .run();
      return this.get(id);
    },

    async update(id, patch) {
      const { dynamic, values } = buildUpdate(patch);
      if (dynamic.length === 0) return this.get(id);
      dynamic.push("updated_at = datetime('now')");
      await db
        .prepare(`UPDATE projects SET ${dynamic.join(", ")} WHERE id = ?`)
        .bind(...values, id)
        .run();
      return this.get(id);
    },

    async remove(id) {
      await db.prepare(`DELETE FROM projects WHERE id = ?`).bind(id).run();
    },

    // 探活结果回写
    async markDetected(id, { status, preview, note }) {
      await db
        .prepare(
          `UPDATE projects SET status=?, preview=?, detect_at=datetime('now'), detect_note=?, updated_at=datetime('now') WHERE id=?`
        )
        .bind(status || "source", preview || "", note || "", id)
        .run();
      return this.get(id);
    },
  };
}

/* ---------- 工具 ---------- */
function hydrate(row) {
  let tags = [];
  try { tags = JSON.parse(row.tags || "[]"); } catch (e) { tags = []; }
  return { ...row, tags };
}

function slugify(s) {
  const base = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
  return base || ("app-" + Date.now().toString(36));
}

// 白名单化更新字段，防止 SQL 注入
const ALLOWED = new Map([
  ["title", "title"], ["description", "description"],
  ["gh_url", "gh_url"], ["cf_url", "cf_url"],
  ["status", "status"], ["preview", "preview"],
  ["language", "language"], ["sort_order", "sort_order"],
]);
function buildUpdate(patch) {
  const dynamic = [];
  const values = [];
  for (const [k, col] of ALLOWED) {
    if (patch[k] !== undefined) {
      dynamic.push(`${col} = ?`);
      values.push(typeof patch[k] === "string" ? patch[k] : JSON.stringify(patch[k]));
    }
  }
  if (patch.tags !== undefined) {
    dynamic.push("tags = ?");
    values.push(JSON.stringify(patch.tags));
  }
  return { dynamic, values };
}