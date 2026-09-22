#!/usr/bin/env node
/* ============================================================
   BUILD · 构建版本数据
   ------------------------------------------------------------
   读取单一版本来源（VERSION）+ CHANGELOG 首个版本条目 + 日志摘要，
   生成 data/version.json，供前端"开发者主页"展示。
   用法： node scripts/build.mjs
   （可加入 package.json 的 predeploy 钩子，部署前自动生成）
   ============================================================ */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function readVERSION() {
  try { return (readFileSync(join(ROOT, "VERSION"), "utf8") || "").trim().replace(/^v/i, ""); }
  catch { return "0.0.0"; }
}

function readChangelogTop(version) {
  try {
    const md = readFileSync(join(ROOT, "CHANGELOG.md"), "utf8");
    const m = md.match(new RegExp(`## \\[${version.replace(".", "\\.")}[^\\n]*\\n([\\s\\S]*?)(?=\\n## [\\[]|$)`));
    return m ? m[1].trim().split("\n").map((l) => l.replace(/^[#-]\s*/, "").trim()).filter(Boolean) : [];
  } catch { return []; }
}

function readLogSummary() {
  try {
    const dir = join(ROOT, "logs");
    const files = readdirSync(dir).filter((f) => f.endsWith(".log")).sort().reverse();
    const out = [];
    for (const f of files.slice(0, 3)) {
      const p = join(dir, f);
      const lines = readFileSync(p, "utf8").split("\n").filter(Boolean);
      if (lines.length) out.push({ file: f, entries: lines.length, last: lines[lines.length - 1] });
    }
    return out;
  } catch { return []; }
}

const version = readVERSION();
const data = {
  name: "vibeshowcase",
  version,
  generatedAt: new Date().toISOString(),
  changelog: readChangelogTop(version),
  recentLogs: readLogSummary(),
};

mkdirSync(join(ROOT, "data"), { recursive: true });
writeFileSync(join(ROOT, "data/version.json"), JSON.stringify(data, null, 2) + "\n", "utf8");
console.log(`build: version.json 已生成 (v${data.version}, ${data.changelog.length} 条变更)`);