#!/usr/bin/env node
/* ============================================================
   DETECT · 部署自动检测
   ------------------------------------------------------------
   读取 data/entries.json —— 你手动维护的条目：
       [{ "ghUrl":.., "cfUrl":.., "desc":.., "title":..(可选), "tags":[] }]

   对每个条目的 cfUrl 做 HTTP 探活：
     - 可达(2xx/3xx) → status="deployed"，preview=cfUrl
     - 不可达/无cfUrl → status="source"，仅 GitHub 图标
   结果合并进 data/projects.json（前端唯一数据源）。

   用法：
     node scripts/detect.mjs
   entries.json 结构：
     { "projects": [ {ghUrl, cfUrl, desc, title, tags, repoName} ] }
   ghUrl 必需，cfUrl 可选。cfUrl 缺失或探不通即为"仅源码"。
   探活用 HEAD，退化用 GET，避免下载大体积内容。
   每个请求默认 6s 超时；--timeout 可调。
   探活结果写入 projects.json，一行条目标记 detect 时间。
   同时调用 scripts/log.mjs 记录运行事件。
   ============================================================ */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { logIt } from "./log.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRIES = join(__dirname, "../data/entries.json");
const OUT = join(__dirname, "../data/projects.json");

const args = process.argv.slice(2);
const toIdx = args.indexOf("--timeout");
const TIMEOUT_MS = (toIdx > -1 ? parseInt(args[toIdx + 1], 10) : 6000) || 6000;

// 从 ghUrl 提取仓库名
function repoName(ghUrl) {
  const m = /github\.com\/[^/]+\/([^/]+?)(\.git)?$/.exec(ghUrl || "");
  return m ? m[1] : "";
}

// 探活单个 URL：HEAD 优先，失败退化 GET
async function probe(url) {
  if (!url) return { ok: false, status: 0, finalUrl: "" };
  const controllers = [];
  const attempt = async (method) => {
    const c = new AbortController();
    controllers.push(c);
    const t = setTimeout(() => c.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { method, redirect: "follow", signal: c.signal, headers: { "User-Agent": "vibeshowcase-detect/1.0" } });
      return { ok: res.ok || res.status < 400, status: res.status, finalUrl: res.url || url };
    } finally {
      clearTimeout(t);
    }
  };
  let r = await attempt("HEAD");
  if (!r.ok) r = await attempt("GET");
  controllers.forEach((c) => c.abort());
  return r;
}

async function main() {
  if (!existsSync(ENTRIES)) {
    const msg = "未找到 data/entries.json，请先手动录入条目（参见 README 数据录入一节）。";
    logIt(msg, "warn");
    console.error(msg);
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(ENTRIES, "utf8"));
  const entries = Array.isArray(raw) ? raw : raw.projects || [];
  logIt(`detect 开始：${entries.length} 条目`);

  const results = [];
  let deployed = 0;
  for (const e of entries) {
    const name = repoName(e.ghUrl);
    const title = e.title || name || e.ghUrl;
    const pr = await probe(e.cfUrl);
    const isDeployed = pr.ok;
    if (isDeployed) deployed++;

    results.push({
      title,
      desc: e.desc || "",
      repo: e.ghUrl || "",
      homepage: e.cfUrl || e.homepage || "",
      preview: isDeployed ? (e.cfUrl || "") : "",
      status: isDeployed ? "deployed" : "source",
      tags: e.tags || [],
      account: e.account || "手动录入",
      accountUsername: "",
      language: e.language || "",
      updated_at: new Date().toISOString(),
      cfUrl: e.cfUrl || "",
      detectAt: new Date().toISOString(),
      detectStatus: pr.status,
    });
  }

  writeFileSync(OUT, JSON.stringify({ projects: results, generatedAt: new Date().toISOString() }, null, 2), "utf8");
  logIt(`detect 完成：${results.length} 条目，部署 ${deployed} / 源码 ${results.length - deployed}`);
  console.log(`\n已更新 ${OUT}：部署 ${deployed} / 源码 ${results.length - deployed}`);
}

main().catch((e) => {
  logIt(`detect 失败: ${e.message}`, "error");
  console.error(e);
  process.exit(1);
});