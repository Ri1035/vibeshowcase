// ============================================================
// Cloudflare Worker 入口 · 作品 API
// ------------------------------------------------------------
// 路由（REST）：
//   GET    /api/projects           列全部
//   GET    /api/projects/:id       单条
//   POST   /api/projects           新增（body: {title,gh_url,cf_url,description,...}）
//   PUT    /api/projects/:id       更新
//   DELETE /api/projects/:id       删除
//   POST   /api/projects/:id/detect 触发部署检测（探活 cf_url 回写）
//   GET    /api/health             健康检查
//   GET    /api/export             导出全部（JSON，用于前端回退缓存）
// ------------------------------------------------------------
// 通过环境变量 BYPASS_DB=1 可在无 D1 时用内存存储演示（本地试用）。
// ============================================================

import { createStore } from "./storage.js";
import { probeUrl } from "./probe.js";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

// 简易内存存储，方便没有 D1 时本地演示
const memStore = (() => {
  let rows = [];
  return {
    async list() { return rows; },
    async get(id) { return rows.find((r) => r.id === id) || null; },
    async create(p) {
      const id = p.id || "app-" + Date.now().toString(36);
      const row = { id, title: p.title || "", description: p.description || "", gh_url: p.gh_url || "", cf_url: p.cf_url || "", status: p.status || "source", preview: p.preview || "", tags: p.tags || [], language: p.language || "", sort_order: p.sort_order || 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      rows.push(row);
      return row;
    },
    async update(id, patch) {
      const r = rows.find((x) => x.id === id);
      if (!r) return null;
      Object.assign(r, patch, { updated_at: new Date().toISOString() });
      return r;
    },
    async remove(id) { rows = rows.filter((r) => r.id !== id); },
    async markDetected(id, { status, preview, note }) {
      const r = rows.find((x) => x.id === id);
      if (!r) return null;
      r.status = status; r.preview = preview || ""; r.detect_note = note; r.detect_at = new Date().toISOString();
      return r;
    },
  };
})();

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}
function error(msg, status = 400) {
  return json({ ok: false, error: msg }, status);
}

// 解析 body（支持 JSON 或 form）
async function readBody(request) {
  const ct = request.headers.get("content-type") || "";
  if (ct.includes("application/json")) return request.json();
  if (ct.includes("application/x-www-form-urlencoded")) {
    const f = await request.formData();
    const o = {};
    for (const [k, v] of f.entries()) o[k] = v;
    return o;
  }
  return {};
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const store = env.BYPASS_DB === "1" || !env.DB ? memStore : createStore(env.DB);

    // ---------- CORS ----------
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // ---------- 路由匹配 ----------
    // 支持 /api/... 或有界路径
    const m = url.pathname.match(/^\/api(?:\/(projects|export|health))?(?:\/([^/]+))?/);
    if (!m) {
      return error("Not found", 404);
    }
    const base = m[1] || "projects";
    const id = m[2];
    if (!id) {
      m[1] = null;
    }

    try {
      // 健康检查
      if (base === "health") return json({ ok: true, time: new Date().toISOString(), db: !!env.DB });

      // 导出（前端回退缓存 / 备份）
      if (base === "export") {
        const all = await store.list();
        return json({ projects: all, generatedAt: new Date().toISOString() });
      }

      // ---------- /api/projects ----------
      if (request.method === "GET") {
        if (id) {
          const row = await store.get(id);
          return row ? json(row) : error("not found", 404);
        }
        return json(await store.list());
      }

      if (request.method === "POST") {
        if (id && id.endsWith("/detect")) { /* 上文正则会把 detect 作 id */ }
        const body = await readBody(request);
        const created = await store.create(body);
        return json(created, 201);
      }

      if (request.method === "PUT" && id) {
        const body = await readBody(request);
        const updated = await store.update(id, body);
        return updated ? json(updated) : error("not found", 404);
      }

      if (request.method === "DELETE" && id) {
        await store.remove(id);
        return json({ ok: true, deleted: id });
      }

      if (request.method === "POST" && id && id.endsWith("detect")) {
        const realId = id.replace(/\/detect$/, "");
        const row = await store.get(realId);
        if (!row) return error("not found", 404);
        const pr = await probeUrl(row.cf_url);
        const updated = await store.markDetected(realId, {
          status: pr.ok ? "deployed" : "source",
          preview: pr.ok ? row.cf_url : "",
          note: pr.note,
        });
        return json(updated);
      }

      return error("Method not allowed", 405);
    } catch (e) {
      return error(e.message || "Server error", 500);
    }
  },
};