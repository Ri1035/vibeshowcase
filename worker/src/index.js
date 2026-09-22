// ============================================================
// Cloudflare Worker 入口 · 作品 API
// ------------------------------------------------------------
// 路由（REST）：
//   GET    /api/projects?page=1&limit=9   分页列表（含总数）
//   GET    /api/projects/:id              单条
//   POST   /api/projects [ADMIN]          新增并自动检测部署
//   PUT    /api/projects/:id [ADMIN]      更新并自动检测部署
//   DELETE /api/projects/:id [ADMIN]      删除
//   POST   /api/projects/:id/detect [ADMIN] 触发部署检测并回写
//   GET    /api/health                    健康检查
//   GET    /api/export                    导出全部（JSON 备份）
//
// 写操作（POST/PUT/DELETE）需在请求头携带：
//   Authorization: Bearer <ADMIN_KEY>
// ADMIN_KEY 通过 `wrangler secret put ADMIN_KEY` 注入，不入库。
// ------------------------------------------------------------
// 前端通过 /api/* 同源或 CORS 访问；BYPASS_DB=1 时可内存模式本地演示。
// ============================================================

import { createStore } from "./storage.js";
import { probeUrl } from "./probe.js";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

// 简易内存存储（BYPASS_DB 本地演示）
const memStore = (() => {
  let rows = [];
  return {
    async list(p = {}) {
      let list = [...rows];
      const q = String(p.query || "").trim().toLowerCase();
      if (q) list = list.filter((r) => (r.title + " " + (r.description || "") + " " + (r.tags || []).join(" ")).toLowerCase().includes(q));
      const total = list.length;
      const page = Math.max(1, parseInt(p.page, 10) || 1);
      const pageSize = Math.min(50, Math.max(1, parseInt(p.limit, 10) || 9));
      const start = (page - 1) * pageSize;
      return { rows: list.slice(start, start + pageSize), total, page, pageSize };
    },
    async get(id) { return rows.find((r) => r.id === id) || null; },
    async create(p) {
      const id = p.id || slug(p.title || p.gh_url || "app");
      const row = { id, title: p.title || "", description: p.description || "", gh_url: p.gh_url || "", cf_url: p.cf_url || "", status: p.status || "source", preview: p.preview || "", tags: p.tags || [], language: p.language || "", sort_order: p.sort_order || 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      rows.push(row);
      return row;
    },
    async update(id, patch) { const r = rows.find((x) => x.id === id); if (!r) return null; Object.assign(r, patch, { updated_at: new Date().toISOString() }); return r; },
    async remove(id) { rows = rows.filter((r) => r.id !== id); },
    async markDetected(id, { status, preview, note }) { const r = rows.find((x) => x.id === id); if (!r) return null; r.status = status; r.preview = preview || ""; r.detect_note = note; r.detect_at = new Date().toISOString(); return r; },
  };
})();

function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS }); }
function error(msg, status = 400) { return json({ ok: false, error: msg }, status); }

// 管理鉴权：从 Authorization 头比对 ADMIN_KEY
function isAdmin(request, env) {
  const key = env.ADMIN_KEY;
  if (!key) return false;
  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${key}`;
}

// 从 GitHub 仓库 API 拉取默认描述（可选辅助）
async function githubDefaultDesc(ghUrl, env) {
  try {
    const m = /github\.com\/([^/]+)\/([^/]+?)(\.git)?$/.exec(ghUrl || "");
    if (!m) return "";
    const [owner, repo] = [m[1], m[2]];
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { "User-Agent": "vibeshowcase-api/1.0", Authorization: `Bearer ${(env.GITHUB_TOKEN || "").trim()}` },
    });
    if (!res.ok) return "";
    const d = await res.json();
    return d.description || "";
  } catch { return ""; }
}

async function readBody(request) {
  const ct = request.headers.get("content-type") || "";
  if (ct.includes("application/json")) return request.json();
  if (ct.includes("application/x-www-form-urlencoded")) {
    const f = await request.formData(); const o = {};
    for (const [k, v] of f.entries()) o[k] = v;
    return o;
  }
  return {};
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const store = env.BYPASS_DB === "1" || !env.DB ? memStore : createStore(env.DB);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

    const path = url.pathname;
    const m = path.match(/^\/api(?:\/(projects|export|health))?(?:\/([^/]+))?/);
    if (!m) return error("Not found", 404);
    const base = m[1] || "projects";
    let id = m[2] || null;
    // 管理员自检端点：GET /api/admin/_verify
    if (path === "/api/admin/_verify") {
      return isAdmin(request, env) ? json({ ok: true, admin: true }) : error("Forbidden", 403);
    }
    if (id && id.endsWith("/detect")) { id = id.slice(0, -7); const isDetect = true; /* 下分处理 */ }

    try {
      if (base === "health") return json({ ok: true, time: new Date().toISOString(), db: !!env.DB, admin: !!env.ADMIN_KEY });

      if (base === "export") { const all = await store.list({ limit: 1000 }); return json({ projects: all.rows, generatedAt: new Date().toISOString() }); }

      // ---------- GET（公开） ----------
      if (request.method === "GET") {
        if (id) { const row = await store.get(id); return row ? json(row) : error("not found", 404); }
        const page = url.searchParams.get("page") || "1";
        const limit = url.searchParams.get("limit") || "9";
        const query = url.searchParams.get("q") || "";
        const r = await store.list({ page, limit, query });
        return json({ projects: r.rows, total: r.total, page: r.page, pageSize: r.pageSize, totalPages: Math.ceil(r.total / r.pageSize) });
      }

      // ---------- detect 触发（需鉴权） ----------
      if (m[2] && m[2].endsWith("/detect")) {
        if (!isAdmin(request, env)) return error("Forbidden", 403);
        const realId = m[2].replace(/\/detect$/, "");
        const row = await store.get(realId);
        if (!row) return error("not found", 404);
        const pr = await probeUrl(row.cf_url);
        const updated = await store.markDetected(realId, { status: pr.ok ? "deployed" : "source", preview: pr.ok ? row.cf_url : "", note: pr.note });
        return json(updated);
      }

      // ---------- 写操作（需鉴权） ----------
      if (!isAdmin(request, env)) return error("Forbidden: 需要管理员密钥 (Authorization: Bearer <ADMIN_KEY>)", 403);

      if (request.method === "POST") {
        const body = await readBody(request);
        // 若未提供描述且给了 gh 链接，尝试自动拉取 GitHub 描述
        if (!body.description && body.gh_url) {
          const d = await githubDefaultDesc(body.gh_url, env);
          if (d) body.description = d;
        }
        // 自动探活判定部署状态
        const pr = await probeUrl(body.cf_url);
        body.status = pr.ok ? "deployed" : "source";
        body.preview = pr.ok ? (body.cf_url || "") : "";
        const created = await store.create(body);
        if (pr.status) created.detectStatus = pr.status;
        return json(created, 201);
      }

      if (request.method === "PUT" && id) {
        const body = await readBody(request);
        const pr = await probeUrl(body.cf_url !== undefined ? body.cf_url : (await store.get(id))?.cf_url);
        body.status = pr.ok ? "deployed" : "source";
        body.preview = pr.ok ? (body.cf_url || "").replace("/$", "") : "";
        const updated = await store.update(id, body);
        return updated ? json(updated) : error("not found", 404);
      }

      if (request.method === "DELETE" && id) {
        await store.remove(id);
        return json({ ok: true, deleted: id });
      }

      return error("Method not allowed", 405);
    } catch (e) {
      return error(e.message || "Server error", 500);
    }
  },
};

function slug(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || ("app-" + Date.now().toString(36));
}