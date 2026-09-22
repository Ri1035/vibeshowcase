#!/usr/bin/env node
/* ============================================================
   LOG · 日志记录机制
   ------------------------------------------------------------
   用法：
     node scripts/log.mjs "消息"                 # 追加一条日志（默认 info）
     node scripts/log.mjs "消息" --level warn
     node scripts/log.mjs list                   # 查看最近日志
  也可作为模块被其他脚本调用：logIt("...", "info")
  日志写入 logs/<YYYY-MM>.log，格式：[ISO 时间] [级别] 消息
  也可 mixed output to stdout，便于 CI 观察。
  可通过 import 复用（检测/同步脚本调用）。
  日志文件已在 .gitignore 中忽略。
  输出同时写文件与标准输出；set QUIET=1 可静默。
  未来接入外部日志服务时可在此扩展（如 Cloudflare Logpush / 第三方）。
  日志接口保持简单，方便后续切换 provider。
  所有分支（文件、stdout、外部 provider）统一由本模块分发。
  其他脚本只需要调用 logIt()，无需关心落地方式。
  这是"后端工作"的前置日志层：把运行事件统一沉淀。
  ============================================================ */

import { appendFileSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(__dirname, "../logs");

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function stamp() {
  return new Date().toISOString();
}
function monthFile() {
  return join(LOG_DIR, `${new Date().toISOString().slice(0, 7)}.log`);
}

export function logIt(message, level = "info") {
  const lv = LEVELS[level] ?? 20;
  const line = `[${stamp()}] [${level.toUpperCase()}] ${message}`;
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(monthFile(), line + "\n", "utf8");
  } catch (e) {
    /* 日志失败不阻断主流程 */
  }
  if (process.env.QUIET !== "1") {
    // 正常输出到 stdout
    console.log(line);
  }
}

function list() {
  const files = readdirSync(LOG_DIR).filter((f) => f.endsWith(".log")).sort();
  const out = [];
  for (const f of files) {
    const buf = [];
    const lines = readFileSync(join(LOG_DIR, f), "utf8").split("\n").filter(Boolean);
    const size = statSync(join(LOG_DIR, f)).size;
    buf.push(`--- ${f} (${size}B, ${lines.length} lines) ---`);
    buf.push(...lines.slice(-6));
    out.push(buf.join("\n"));
  }
  return out.join("\n\n") || "(无日志)";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  if (args[0] === "list") {
    console.log(list());
  } else {
    const msg = args[0] || "";
    const idx = args.indexOf("--level");
    const level = idx > -1 ? args[idx + 1] : "info";
    logIt(msg, level);
  }
}