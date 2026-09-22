/* ============================================================
   CONFIG · 前端配置
   ------------------------------------------------------------
   API_BASE  后端地址（Cloudflare Worker）。
   - 默认指向已部署的 vibeshowcase-api Worker。
   - 若 WorkerAPI 不可用，前端会自动回退读取本地 data/projects.json 展示，
     不会白屏。
   ============================================================ */
window.VIBE_CONFIG = {
  API_BASE: "https://vibeshowcase-api.koka2996978242.workers.dev",
  // 分页每页条数
  PAGE_SIZE: 9,
};