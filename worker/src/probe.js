// ============================================================
// PROBE · 部署探活（Worker 内复用）
// 对 cf_url 做 HEAD（退化 GET），返回是否在线。
// 未来可扩展为：调用 CF Pages API 查真实部署状态 + 健康检查。
// ============================================================

/**
 * @param {string} url
 * @returns {Promise<{ok: boolean, status: number, note: string}>}
 */
export async function probeUrl(url) {
  if (!url || !/^https?:\/\//i.test(url)) {
    return { ok: false, status: 0, note: "无 cf_url" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  const headers = { "User-Agent": "vibeshowcase-api/1.0" };
  let res;
  try {
    res = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal, headers });
  } catch (e) {
    // HEAD 失败退化 GET
    try {
      res = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal, headers });
    } catch (e2) {
      clearTimeout(timer);
      return { ok: false, status: 0, note: "探活失败" };
    }
  } finally {
    clearTimeout(timer);
  }
  const ok = (res.ok || res.status < 400);
  return { ok, status: res.status, note: `HTTP ${res.status}` };
}