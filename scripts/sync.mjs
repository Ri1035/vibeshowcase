#!/usr/bin/env node
/* ============================================================
   SYNC · 多账号聚合同步脚本
   ------------------------------------------------------------
   读取 config/accounts.json（多 GitHub + 多 Cloudflare 账号），
   调用 GitHub 公开/API 与 Cloudflare API，抓取仓库与部署记录，
   合并去重并生成 data/projects.json（前端唯一数据源）。

   用法：
     node scripts/sync.mjs                # 使用 config/accounts.json
     node scripts/sync.mjs --config config/my.json
  也可配合环境变量注入令牌（见 accounts.example.json 说明）。
   ============================================================ */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const cfgArg = args[args.indexOf("--config") + 1];
const CONFIG_PATH = cfgArg
  ? resolve(process.cwd(), cfgArg)
  : resolve(__dirname, "../config/accounts.json");
const OUT_PATH = resolve(__dirname, "../data/projects.json");

const UA = "vibeshowcase-sync/1.0";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- 简单请求封装 ---------- */
async function ghFetch(path, token) {
  const headers = { "User-Agent": UA, Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0") {
    throw new Error("GitHub 限流。请为账号配置 GITHUB_TOKEN 或稍后再试。");
  }
  if (!res.ok) throw new Error(`GitHub ${path} -> HTTP ${res.status}`);
  return res.json();
}

async function cfFetch(path, cfg, token) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}${path}`,
    { headers }
  );
  const json = await res.json();
  if (!res.ok || !json.success) {
    const errs = (json.errors || []).map((e) => e.message).join("; ");
    throw new Error(`Cloudflare ${path} -> ${errs || ("HTTP " + res.status)}`);
  }
  return json.result;
}

/* ---------- 拉取 GitHub 仓库 ---------- */
async function fetchGitHubRepos(account) {
  const token = account.tokenEnv ? process.env[account.tokenEnv] : undefined;
  // 分页拉取（最多取最近的 100 个私有可读/公开仓库）
  const page = await ghFetch(
    `/users/${account.username}/repos?per_page=100&sort=updated&type=owner`,
    token
  );
  return (Array.isArray(page) ? page : []).map((r) => ({
    name: r.name,
    full: r.full_name,
    repo: r.html_url,
    description: r.description || "",
    homepage: r.homepage || "",
    topics: r.topics || [],
    language: r.language || "",
    pushed_at: r.pushed_at || "",
    updated_at: r.updated_at || "",
    account: account.name || account.username,
    accountUsername: account.username,
  }));
}

/* ---------- 拉取 Cloudflare Pages 部署 ---------- */
async function fetchCloudflare(cfConfig) {
  const out = new Map();
  for (const acc of cfConfig.accounts || []) {
    const token = acc.tokenEnv ? process.env[acc.tokenEnv] : undefined;
    if (!token) {
      console.warn(`[cf] ${acc.name}: 未提供 ${acc.tokenEnv}，跳过部署同步。`);
      continue;
    }
    try {
      const projects = await cfFetch("/pages/projects?per_page=50", acc, token);
      console.log(`[cf] ${acc.name}: 读取到 ${projects.length} 个 Pages 项目`);
      for (const p of projects) {
        // 取每个项目最新的 production deployment 的线上 URL
        let url = "";
        let status = "source";
        if (p.latest_deployment && p.latest_deployment.url) {
          url = p.latest_deployment.url.startsWith("http")
            ? p.latest_deployment.url
            : `https://${p.latest_deployment.url}`;
          status = "deployed";
        }
        const key = (p.name || "").toLowerCase();
        out.set(key, {
          cfName: p.name,
          cfProjectName: p.name,
          cfUrl: url,
          cfAccountId: acc.accountId,
          status,
        });
      }
    } catch (e) {
      console.error(`[cf] ${acc.name}: ${e.message}`);
    }
  }
  return out;
}

/* ---------- glob 匹配 ---------- */
function wildMatch(pattern, str) {
  const re = new RegExp(
    "^" + pattern
      .split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$"
  );
  return re.test(str);
}

/* ---------- 归并成最终 projects 列表 ---------- */
function buildProjects(repos, cfMap, cfg) {
  const overrides = new Map();
  for (const o of cfg.overrides || []) overrides.set(o.name.toLowerCase(), o);

  const items = new Map();

  // 1) 从 GitHub 仓库建立条目
  for (const r of repos) {
    const name = r.name.toLowerCase();
    // 排除过滤
    const incl = cfg.github.include || ["*"];
    if (!incl.some((p) => wildMatch(p, r.name))) continue;
    if ((cfg.github.exclude || []).some((p) => wildMatch(p, r.name))) continue;

    // 能否关联 CF 部署：按相同项目名
    const cf = cfMap.get(name);
    let status = "source";
    let preview = "";
    let cfUrl = "";
    if (cf && cf.status === "deployed") {
      status = "deployed";
      preview = cf.cfUrl;
      cfUrl = cf.cfUrl;
    } else if (r.homepage) {
      // 仓库声明了 homepage，视为已部署（可能是 gh-pages 或 CF）
      status = "deployed";
      preview = r.homepage;
    }

    items.set(name, {
      title: r.name,
      desc: r.description,
      repo: r.repo,
      homepage: r.homepage || "",
      preview: preview || r.homepage || "",
      status,
      tags: r.topics.slice(0, 5),
      account: r.account,
      accountUsername: r.accountUsername,
      language: r.language,
      updated_at: r.updated_at,
      cfUrl,
      // 提交超给前端预览缩略图
      thumbnailSvg: null,
    });
  }

  // 2) 关联到 CF 但没有对应 GitHub 仓库的（可能仓库在私有，或仅部署）
  for (const [name, cf] of cfMap) {
    if (!items.has(name) && cf.cfUrl) {
      items.set(name, {
        title: cf.cfProjectName,
        desc: "Cloudflare Pages 部署的项目（未匹配到公开 GitHub 仓库）",
        repo: "",
        homepage: cf.cfUrl,
        preview: cf.cfUrl,
        status: "deployed",
        tags: ["pages"],
        account: cf.cfAccountId ? "cloudflare" : "cloudflare",
        accountUsername: "",
        language: "",
        updated_at: "",
        cfUrl: cf.cfUrl,
        thumbnailSvg: null,
      });
    }
  }

  // 3) 应用手动覆盖
  const result = [];
  for (const item of items.values()) {
    const ov = overrides.get(item.title.toLowerCase());
    let final = item;
    if (ov) final = { ...item, ...stripMeta(ov) };
    if (final.hide) continue;
    // 清理空描述
    delete final.thumbnailSvg;
    delete final.bypass;
    result.push(final);
  }

  result.sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
  return result;
}

function stripMeta(o) {
  const { _匹配, name, ...rest } = o;
  void _匹配;
  return rest;
}

/* ---------- 主流程 ---------- */
console.log(`配置: ${CONFIG_PATH}`);
if (!existsSync(CONFIG_PATH)) {
  console.error(
    "未找到 accounts.json。请复制 config/accounts.example.json 为 config/accounts.json 并填写账号。"
  );
  process.exit(1);
}

const cfg = JSON.parse(
  readFileSync(CONFIG_PATH, "utf8").replace(/^\s*\/\/.*$/gm, "").replace(/,\s*([}\]])/g, "$1")
);

async function main() {
  // GitHub
  const repoList = [];
  for (const acc of cfg.github.accounts || []) {
    try {
      const repos = await fetchGitHubRepos(acc);
      console.log(`[gh] ${acc.username}: ${repos.length} 仓库`);
      repoList.push(...repos);
    } catch (e) {
      console.error(`[gh] ${acc.username}: ${e.message}`);
    }
    await sleep(150);
  }

  // Cloudflare
  const cfMap = await fetchCloudflare(cfg.cloudflare);

  const projects = buildProjects(repoList, cfMap, cfg);
  writeFileSync(OUT_PATH, JSON.stringify({ projects, generatedAt: new Date().toISOString() }, null, 2), "utf8");
  console.log(`\n已生成 ${OUT_PATH}，共 ${projects.length} 个作品（部署 ${projects.filter(p=>p.status==="deployed").length} / 源码 ${projects.filter(p=>p.status==="source").length}）`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});