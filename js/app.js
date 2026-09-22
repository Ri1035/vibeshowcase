/* ============================================================
   APP · 主逻辑
   - 数据：优先调用 D1 API（分页），失败回退本地 data/projects.json
   - 渲染卡片网格 + 分页控件
   - 状态筛选（全部 / 已部署 / 仅源码）
   - 预览 iframe 弹窗
   - 管理：输入密钥 → 录入/编辑/删除/发布（写入 D1）
   ============================================================ */

(function () {
  const API = window.VibeShowcaseTheme;
  const CFG = window.VIBE_CONFIG || {};
  const API_BASE = CFG.API_BASE || "";
  const PAGE_SIZE = CFG.PAGE_SIZE || 9;
  const statusAll = "all";

  let meta = { projects: [], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 0 };
  let activeStatus = statusAll;
  let usingApi = false;
  let adminKey = localStorage.getItem("vibe_admin_key") || "";

  const $ = (sel, root = document) => root.querySelector(sel);

  function debounce(fn, ms = 200) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  /* ---------- 数据加载：优先 D1 API，回退本地 ---------- */
  async function loadFromApi(page) {
    const p = Math.max(1, page || 1);
    const q = encodeURIComponent($("#search")?.value.trim() || "");
    const url = `${API_BASE}/api/projects?page=${p}&limit=${PAGE_SIZE}&q=${q}`;
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error("api " + res.status);
    return await res.json();
  }
  async function loadFromLocal() {
    const res = await fetch("data/projects.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.projects || [];
    return {
      projects: list,
      total: list.length,
      page: 1,
      pageSize: list.length || 1,
      totalPages: 1,
      source: "local",
    };
  }

  async function loadProjects(page) {
    const targetPage = page || meta.page || 1;
    try {
      const d = await loadFromApi(targetPage);
      meta = {
        projects: d.projects || [],
        total: d.total || 0,
        page: d.page || 1,
        pageSize: d.pageSize || PAGE_SIZE,
        totalPages: d.totalPages || 1,
      };
      usingApi = true;
    } catch (e) {
      try {
        const d = await loadFromLocal();
        meta = { ...meta, projects: d.projects, total: d.total, page: 1, pageSize: d.pageSize, totalPages: 1 };
        usingApi = false;
      } catch (e2) {
        $("#grid").innerHTML = emptyState("数据加载失败：后端 API 与本地 data/projects.json 均不可用。");
        console.error(e2);
        return;
      }
    }
    renderStats();
    renderFilters();
    renderGrid();
    renderPagination();
  }

  /* ---------- 统计 ---------- */
  function renderStats() {
    const deployed = meta.projects.filter((p) => p.status === "deployed").length;
    const source = meta.projects.filter((p) => p.status === "source").length;
    $("#stat-total").textContent = meta.total;
    $("#stat-deployed").textContent = deployed;
    $("#stat-source").textContent = source;
  }

  /* ---------- 筛选（重新拉数据） ---------- */
  let filtersBound = false;
  function renderFilters() {
    const chips = ["all", "deployed", "source"];
    const labels = { all: "全部作品", deployed: "已部署", source: "仅源码" };
    $("#filters").innerHTML = chips
      .map((s) => `<button class="chip ${activeStatus === s ? "active" : ""}" data-status="${s}">${labels[s]}</button>`)
      .join("");
    if (filtersBound) return;
    filtersBound = true;
    $("#filters").addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      activeStatus = chip.dataset.status;
      renderFilters();
      loadProjects(1);
    });
  }

  /* ---------- 图标 ---------- */
  const webIcon = `<svg class="icon thumb-icon" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>`;
  const gitIcon = `<svg class="icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.5c-2.24.49-2.71-.95-2.71-.95-.37-.93-.9-1.18-.9-1.18-.73-.5.06-.49.06-.49.81.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.51-1.07-1.78-.2-3.65-.89-3.65-3.97 0-.88.31-1.59.83-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.22 2.2.82a7.66 7.66 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.1-1.87 3.77-3.66 3.97.29.25.54.74.54 1.49v2.21c0 .21.15.46.55.38A8 8 0 0 0 8 0z"/></svg>`;
  const gitIconBig = `<svg class="icon" width="44" height="44" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.5c-2.24.49-2.71-.95-2.71-.95-.37-.93-.9-1.18-.9-1.18-.73-.5.06-.49.06-.49.81.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.51-1.07-1.78-.2-3.65-.89-3.65-3.97 0-.88.31-1.59.83-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.22 2.2.82a7.66 7.66 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.1-1.87 3.77-3.66 3.97.29.25.54.74.54 1.49v2.21c0 .21.15.46.55.38A8 8 0 0 0 8 0z"/></svg>`;
  const extIcon = `<svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>`;
  const editIcon = `<svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;

  function statusBadge(p) {
    return p.status === "deployed"
      ? `<span class="badge deployed"><span class="dot"></span>已部署</span>`
      : `<span class="badge source"><span class="dot"></span>仅源码</span>`;
  }
  function previewUrl(p) {
    if (p.status === "deployed" && p.preview) return p.preview;
    if (p.homepage) return p.homepage;
    return p.ghPages || "";
  }

  /* ---------- 卡片 ---------- */
  function projectCard(p) {
    const url = previewUrl(p);
    const deployed = p.status === "deployed";
    const thumb = deployed
      ? `<span class="thumb-glyph" style="color:var(--color-primary)">${webIcon}</span>`
      : `<span class="thumb-glyph" style="color:var(--color-accent)">${gitIconBig}</span>`;
    const tags = (p.tags || []).slice(0, 3).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("");
    return `
      <article class="card" data-id="${escapeAttr(p.id || "")}" data-status="${p.status}" data-openurl="${escapeAttr(url)}">
        <div class="card-top" style="align-items:center">
          <div class="card-thumb">${thumb}</div>
          <div style="flex:1;min-width:0">
            <h3 class="card-title">${escapeHtml(p.title)}</h3>
            ${tags ? `<div class="card-meta">${tags}</div>` : ""}
          </div>
        </div>
        <p class="card-desc">${escapeHtml(p.desc || p.description || "")}</p>
        ${adminKey ? `<div class="card-admin"><button class="btn-admin-edit" data-edit-id="${escapeAttr(p.id || "")}">${editIcon}编辑</button></div>` : ""}
        <div class="card-actions">
          ${deployed && url ? `<button class="btn btn-primary btn-sm" data-preview>${extIcon}在线预览</button>` : ""}
          ${p.repo || p.gh_url ? `<a class="btn ${deployed ? "btn-ghost" : "btn-accent"} btn-sm" href="${escapeAttr(p.repo || p.gh_url)}" target="_blank" rel="noopener">${gitIcon}${deployed ? "查看源码" : "前往 GitHub"}</a>` : ""}
        </div>
      </article>`;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function escapeAttr(s) { return escapeHtml(s); }
  function emptyState(msg) { return `<div class="empty"><span class="big">🫙</span><p>${escapeHtml(msg)}</p></div>`; }

  /* ---------- 网格 + 本地搜索（API 已按 q 过滤；本地模式再兜底） ---------- */
  function renderGrid() {
    let list = meta.projects;
    if (!usingApi && activeStatus !== statusAll) list = list.filter((p) => p.status === activeStatus);
    const box = $("#grid");
    box.innerHTML = list.length
      ? list.map(projectCard).join("")
      : emptyState(activeStatus === statusAll ? "没有匹配的作品" : "该分类下暂无作品");
  }

  function bindSearch() {
    const searchBox = $("#search");
    if (!searchBox) return;
    searchBox.addEventListener("input", debounce(() => loadProjects(1), 300));
  }

  /* ---------- 分页控件 ---------- */
  function renderPagination() {
    const nav = $("#pagination");
    const tp = meta.totalPages;
    if (!nav || tp <= 1) { if (nav) nav.innerHTML = ""; return; }
    const cur = meta.page;
    const btn = (p, label, cls = "", disabled = false) =>
      `<button class="page-btn ${cls}" data-page="${p}" ${disabled ? "disabled" : ""} ${p === cur ? 'aria-current="page"' : ""}>${label}</button>`;
    let html = btn(cur - 1, "‹", "prev", cur <= 1);
    const delta = 2;
    for (let p = 1; p <= tp; p++) {
      if (p === 1 || p === tp || Math.abs(p - cur) <= delta) html += btn(p, p, p === cur ? "active" : "");
      else if (Math.abs(p - cur) === delta + 1) html += `<span class="page-ellipsis">…</span>`;
    }
    html += btn(cur + 1, "›", "next", cur >= tp);
    nav.innerHTML = html;
  }

  let paginationBound = false;
  function bindPagination() {
    const nav = $("#pagination");
    if (!nav || paginationBound) return;
    paginationBound = true;
    nav.addEventListener("click", (e) => {
      const b = e.target.closest("[data-page]");
      if (!b || b.disabled) return;
      loadProjects(parseInt(b.dataset.page, 10));
    });
  }

  /* ---------- 预览弹窗 ---------- */
  function bindPreview() {
    const backdrop = $("#backdrop");
    const frame = $("#frame");
    const modalTitle = $("#modal-title");
    function open(url, title) { frame.src = url; modalTitle.textContent = title; backdrop.classList.add("open"); document.body.style.overflow = "hidden"; }
    function close() { backdrop.classList.remove("open"); frame.src = "about:blank"; document.body.style.overflow = ""; }

    document.addEventListener("click", (e) => {
      const card = e.target.closest(".card");
      if (card && !e.target.closest("a, button")) {
        if (e.target.closest(".btn-admin-edit")) return;
        const url = card.dataset.openurl;
        const title = card.querySelector(".card-title").textContent;
        if (url) open(url, title);
        return;
      }
      const previewBtn = e.target.closest("[data-preview]");
      if (previewBtn) {
        const c = previewBtn.closest(".card");
        open(c.dataset.openurl, c.querySelector(".card-title").textContent);
        return;
      }
      // 编辑按钮
      const editBtn = e.target.closest("[data-edit-id]");
      if (editBtn) { openAdminEdit(editBtn.dataset.editId); return; }
      if (backdrop.classList.contains("open")) {
        if (e.target.closest("[data-close]")) close();
        if (e.target === backdrop) close();
      }
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") { close(); if ($("#admin-modal").classList.contains("open")) closeAdmin(); } });
    $("#open-now").addEventListener("click", () => {
      const url = frame.src;
      if (url && url !== "about:blank") window.open(url, "_blank", "noopener");
    });
  }

  /* ---------- 主题 ---------- */
  function bindTheme() {
    const btn = $("#theme-btn");
    const panel = $("#theme-panel");
    const list = $("#theme-list");
    function renderOptions(activeId) {
      list.innerHTML = API.renderThemeOptions()
        .map((t) => `<button class="theme-option ${t.id === activeId ? "active" : ""}" data-theme-id="${t.id}"><span class="theme-swatch" aria-hidden="true"></span><span><strong>${t.label}</strong><br><small style="color:var(--color-text-soft)">${t.desc}</small></span></button>`).join("");
    }
    btn.addEventListener("click", (e) => { e.stopPropagation(); const open = panel.classList.toggle("open"); if (open) renderOptions(document.documentElement.getAttribute("data-theme")); });
    document.addEventListener("click", (e) => {
      if (!panel.classList.contains("open")) return;
      if (!panel.contains(e.target) && !btn.contains(e.target)) panel.classList.remove("open");
    });
    list.addEventListener("click", (e) => {
      const opt = e.target.closest("[data-theme-id]");
      if (!opt) return;
      API.applyTheme(opt.dataset.themeId);
      renderOptions(opt.dataset.themeId);
      panel.classList.remove("open");
    });
    panel.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) panel.classList.remove("open"); });
  }

  /* ============================================================
     管理：登录 / 录入 / 编辑 / 删除 / 发布
     ============================================================ */
  const modal = () => $("#admin-modal");

  function openAdmin() {
    modal().classList.add("open");
    document.body.style.overflow = "hidden";
    if (adminKey) { showAdminTools(); renderAdminList(); }
    else { show(adminLogin, true); hide(adminTools); hide(form); }
  }
  function closeAdmin() {
    modal().classList.remove("open");
    document.body.style.overflow = "";
    show(adminLogin, true); hide(adminTools); hide(form);
    resetForm();
  }
  const show = (el, on) => { if (el) el.hidden = !on; };
  const hide = (el) => show(el, false);

  function showAdminTools() { show(adminLogin, false); show(adminTools, true); show(form, false); }

  let editingId = null;
  const adminLogin = () => $("#admin-login");
  const adminTools = () => $("#admin-tools");
  const form = () => $("#project-form");

  async function login(ev) {
    ev?.preventDefault();
    const key = $("#admin-key-input").value.trim();
    if (!key) { msg("#admin-login-msg", "请输入管理密钥", true); return; }
    $("#admin-login-btn").disabled = true;
    msg("#admin-login-msg", "正在校验…");
    try {
      await fetchWithAuth(`${API_BASE}/api/admin/_verify`, { method: "GET" });
      localStorage.setItem("vibe_admin_key", key);
      adminKey = key;
      $("#admin-login-btn").disabled = false;
      msg("#admin-login-msg", "✅ 已解锁。可录入、编辑、发布作品。");
      showAdminTools();
      renderAdminList();
      renderGrid();
    } catch (err) {
      $("#admin-login-btn").disabled = false;
      msg("#admin-login-msg", `解锁失败：${err.message}`, true);
    }
  }

  async function renderAdminList() {
    const box = $("#admin-list");
    box.innerHTML = '<p class="field-hint">加载中…</p>';
    try {
      const d = await fetchWithAuth(`${API_BASE}/api/export`);
      const list = (d.projects || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      box.innerHTML = list.length
        ? list.map((p) => `<div class="admin-item" data-id="${escapeAttr(p.id)}"><span class="admin-item-title">${escapeHtml(p.title)}</span><span class="badge ${p.status === "deployed" ? "deployed" : "source"}">${p.status === "deployed" ? "已部署" : "仅源码"}</span></div>`).join("")
        : `<p class="field-hint">暂无作品，点击「添加作品」新增。</p>`;
    } catch (e) {
      box.innerHTML = `<p class="field-msg err">加载失败：${escapeHtml(e.message)}</p>`;
    }
  }

  function beginCreate() {
    editingId = null;
    resetForm();
    $("#admin-modal-title").textContent = "添加作品";
    $("#btn-delete").hidden = true;
    show(adminLogin, false); show(adminTools, false); show(form, true);
  }

  function openAdminEdit(id) {
    const p = meta.projects.find((x) => x.id === id) || { id };
    editingId = id;
    $("#admin-modal-title").textContent = "编辑作品";
    $("#f-title").value = p.title || "";
    $("#f-gh").value = p.gh_url || p.repo || "";
    $("#f-cf").value = p.cf_url || "";
    $("#f-desc").value = p.desc || p.description || "";
    $("#f-tags").value = (p.tags || []).join(", ");
    $("#btn-delete").hidden = false;
    show(adminLogin, false); show(adminTools, false); show(form, true);
    msg("#form-msg", "");
  }

  function resetForm() {
    ["#f-title", "#f-gh", "#f-cf", "#f-desc", "#f-tags"].forEach((s) => { const el = $(s); if (el) el.value = ""; });
    msg("#form-msg", "");
  }

  async function saveProject(ev) {
    ev.preventDefault();
    const title = $("#f-title").value.trim();
    const gh = $("#f-gh").value.trim();
    const cf = $("#f-cf").value.trim();
    const desc = $("#f-desc").value.trim();
    const tags = $("#f-tags").value.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    if (!title || !gh) { msg("#form-msg", "作品名称与 GitHub 链接为必填", true); return; }
    $("#btn-save").disabled = true;
    msg("#form-msg", editingId ? "正在更新并重新检测部署…" : "正在保存并自动检测部署（需几秒）…");
    const payload = { title, gh_url: gh, cf_url: cf || "", description: desc, tags, language: "" };
    try {
      let d;
      if (editingId) d = await apiFetch(`${API_BASE}/api/projects/${encodeURIComponent(editingId)}`, { method: "PUT", body: JSON.stringify(payload) });
      else d = await apiFetch(`${API_BASE}/api/projects`, { method: "POST", body: JSON.stringify(payload) });
      msg("#form-msg", `已保存「${d.title}」，状态：${d.status === "deployed" ? "已部署" : "仅源码"}。`);
      if (d.status === "deployed" && d.detectStatus) msg("#form-msg", `已保存并发布：在线 (HTTP ${d.detectStatus})`);
      $("#btn-save").disabled = false;
      setTimeout(() => { closeAdmin(); loadProjects(1); }, 900);
    } catch (err) {
      $("#btn-save").disabled = false;
      msg("#form-msg", `保存失败：${err.message}。密钥可能无效。`, true);
    }
  }

  async function delProject() {
    if (!editingId) return;
    if (!confirm("确定删除该作品吗？此操作不可撤销。")) return;
    try {
      await apiFetch(`${API_BASE}/api/projects/${encodeURIComponent(editingId)}`, { method: "DELETE" });
      closeAdmin();
      loadProjects(1);
    } catch (err) {
      msg("#form-msg", `删除失败：${err.message}`, true);
    }
  }

  /* 带鉴权头的请求；403 时抛出明确错误 */
  async function fetchWithAuth(url, opts = {}) {
    const res = await fetch(url, {
      ...opts,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminKey}`, ...(opts.headers || {}) },
    });
    if (!res.ok) {
      if (res.status === 403) throw new Error("管理密钥无效或未授权");
      throw new Error("HTTP " + res.status);
    }
    return res.json();
  }
  const apiFetch = (url, opts) => fetchWithAuth(url, opts);

  function msg(sel, text, isErr = false) {
    const el = $(sel);
    if (el) { el.textContent = text; el.className = "field-msg" + (isErr ? " err" : ""); }
  }

  function bindAdmin() {
    $("#admin-btn").addEventListener("click", openAdmin);
    modal().addEventListener("click", (e) => {
      if (e.target.closest("[data-admin-close]")) closeAdmin();
      if (e.target === modal()) closeAdmin();
    });
    $("#admin-login-btn").addEventListener("click", login);
    $("#admin-key-input").addEventListener("keydown", (e) => { if (e.key === "Enter") login(e); });
    $("#btn-new").addEventListener("click", beginCreate);
    $("#btn-logout").addEventListener("click", () => {
      adminKey = ""; localStorage.removeItem("vibe_admin_key");
      show(adminLogin, true); hide(adminTools); hide(form);
      msg("#admin-login-msg", "已退出管理。"); renderGrid();
    });
    $("#admin-list").addEventListener("click", (e) => {
      const item = e.target.closest(".admin-item");
      if (item) openAdminEdit(item.dataset.id);
    });
    $("#project-form").addEventListener("submit", saveProject);
    $("#btn-cancel").addEventListener("click", () => { show(adminTools, true); hide(form); renderAdminList(); });
    $("#btn-delete").addEventListener("click", delProject);
  }

  function updateAfterMount() {
    // renderGrid 里已处理编辑按钮
  }

  /* ---------- 版本号显示（读 build 生成的 version.json） ---------- */
  function bindVersion() {
    const chip = $("#version-chip");
    if (!chip) return;
    fetch("data/version.json", { cache: "no-cache" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d && d.version) {
          chip.textContent = "v" + d.version;
          chip.title = "当前版本 v" + d.version;
        }
      })
      .catch(() => {});
  }

  // renderGrid 依赖 adminKey 变量，闭包内可访问
  /* ---------- 启动 ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    API.initTheme();
    bindTheme();
    bindSearch();
    bindPreview();
    bindPagination();
    bindAdmin();
    bindVersion();
    loadProjects(1);
  });
})();