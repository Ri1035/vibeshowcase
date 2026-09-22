/* ============================================================
   APP · 主逻辑
   - 加载 data/projects.json（单一数据源，由 sync 脚本生成）
   - 渲染卡片网格
   - 状态筛选（全部 / 已部署 / 仅源码）
   - 预览 iframe 弹窗
   - 主题切换
   ============================================================ */

(function () {
  const API = window.VibeShowcaseTheme;
  const statusAll = "all";
  let projects = [];
  let activeStatus = statusAll;

  /* ---------- 工具 ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);

  function debounce(fn, ms = 200) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  /* ---------- 数据加载（适配器：优先 D1 API，回退本地 JSON） ---------- */
  async function loadFromApi() {
    const res = await fetch("/api/projects", { cache: "no-cache" });
    if (!res.ok) throw new Error("api " + res.status);
    return await res.json();
  }
  async function loadFromLocal() {
    const res = await fetch("data/projects.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    return Array.isArray(data) ? data : data.projects || [];
  }
  async function loadProjects() {
    let data;
    let source;
    try {
      data = await loadFromApi();
      source = "api";
    } catch (e) {
      try {
        data = await loadFromLocal();
        source = "local";
      } catch (e2) {
        $("#grid").innerHTML = emptyState("数据加载失败：未部署后端且缺少本地 data/projects.json。");
        console.error(e2);
        return;
      }
    }
    projects = Array.isArray(data) ? data : data.projects || [];
    console.log(`[vibeshowcase] 数据来源：${source}（${projects.length} 条）`);
    renderStats();
    renderFilters();
    renderGrid();
  }

  /* ---------- 统计条 ---------- */
  function renderStats() {
    const deployed = projects.filter((p) => p.status === "deployed").length;
    const source = projects.filter((p) => p.status === "source").length;
    $("#stat-total").textContent = projects.length;
    $("#stat-deployed").textContent = deployed;
    $("#stat-source").textContent = source;
  }

  /* ---------- 筛选栏 ---------- */
  function renderFilters() {
    const chips = [statusAll, "deployed", "source"];
    const labels = { all: "全部作品", deployed: "已部署", source: "仅源码" };
    $("#filters").innerHTML = chips
      .map(
        (s) =>
          `<button class="chip ${activeStatus === s ? "active" : ""}" data-status="${s}">${labels[s]}</button>`
      )
      .join("");
    $("#filters").addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      activeStatus = chip.dataset.status;
      renderFilters();
      renderGrid();
    });
  }

  /* ---------- 图标 ---------- */
  const webIcon = `<svg class="icon thumb-icon" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>`;
  const gitIcon = `<svg class="icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.5c-2.24.49-2.71-.95-2.71-.95-.37-.93-.9-1.18-.9-1.18-.73-.5.06-.49.06-.49.81.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.51-1.07-1.78-.2-3.65-.89-3.65-3.97 0-.88.31-1.59.83-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.22 2.2.82a7.66 7.66 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.1-1.87 3.77-3.66 3.97.29.25.54.74.54 1.49v2.21c0 .21.15.46.55.38A8 8 0 0 0 8 0z"/></svg>`;
  const gitIconBig = `<svg class="icon" width="44" height="44" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.5c-2.24.49-2.71-.95-2.71-.95-.37-.93-.9-1.18-.9-1.18-.73-.5.06-.49.06-.49.81.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.51-1.07-1.78-.2-3.65-.89-3.65-3.97 0-.88.31-1.59.83-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.22 2.2.82a7.66 7.66 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.1-1.87 3.77-3.66 3.97.29.25.54.74.54 1.49v2.21c0 .21.15.46.55.38A8 8 0 0 0 8 0z"/></svg>`;
  const extIcon = `<svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>`;

  function statusBadge(p) {
    if (p.status === "deployed") {
      return `<span class="badge deployed"><span class="dot"></span>已部署</span>`;
    }
    return `<span class="badge source"><span class="dot"></span>仅源码</span>`;
  }

  function previewUrl(p) {
    if (p.status === "deployed" && p.preview) return p.preview;
    if (p.homepage) return p.homepage;
    return p.ghPages || "";
  }

  /* ---------- 卡片渲染 ---------- */
  function projectCard(p) {
    const url = previewUrl(p);
    const deployed = p.status === "deployed";
    // 有部署 → web 图标缩略；无部署 → GitHub 图标缩略（默认强调）
    const thumb = deployed
      ? `<span class="thumb-glyph" style="color:var(--color-primary)">${webIcon}</span>`
      : `<span class="thumb-glyph" style="color:var(--color-accent)">${gitIconBig}</span>`;
    const tags = (p.tags || []).slice(0, 3).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("");
    return `
      <article class="card" data-status="${p.status}" data-keywords="${escapeAttr(((p.title||"") + " " + (p.desc||"") + " " + (p.tags||[]).join(" ")).toLowerCase())}" data-openurl="${escapeAttr(url)}">
        <div class="card-top" style="align-items:center">
          <div class="card-thumb">${thumb}</div>
          <div style="flex:1;min-width:0">
            <h3 class="card-title">${escapeHtml(p.title)}</h3>
            ${tags ? `<div class="card-meta">${tags}</div>` : ""}
          </div>
        </div>
        <p class="card-desc">${escapeHtml(p.desc || "")}</p>
        <div class="card-actions">
          ${deployed && url ? `<button class="btn btn-primary btn-sm" data-preview>${extIcon}在线预览</button>` : ""}
          ${p.repo ? `<a class="btn ${deployed ? "btn-ghost" : "btn-accent"} btn-sm" href="${escapeAttr(p.repo)}" target="_blank" rel="noopener">${gitIcon}${deployed ? "查看源码" : "前往 GitHub"}</a>` : ""}
        </div>
      </article>`;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function escapeAttr(s) { return escapeHtml(s); }

  function emptyState(msg) {
    return `<div class="empty"><span class="big">🫙</span><p>${escapeHtml(msg)}</p></div>`;
  }

  /* ---------- 网格渲染 + 搜索 ---------- */
  function renderGrid() {
    const searchBox = $("#search");
    const kw = (searchBox && searchBox.value || "").trim().toLowerCase();
    const box = $("#grid");

    let list = projects;
    if (activeStatus !== statusAll) {
      list = list.filter((p) => p.status === activeStatus);
    }
    if (kw) {
      list = list.filter((p) =>
        ((p.title || "") + " " + (p.desc || "") + " " + (p.tags || []).join(" ")).toLowerCase().includes(kw)
      );
    }

    box.innerHTML = list.length
      ? list.map(projectCard).join("")
      : emptyState(activeStatus === statusAll ? "没有匹配的作品" : "该分类下暂无作品");
  }

  /* ---------- 搜索 ---------- */
  function bindSearch() {
    const searchBox = $("#search");
    if (searchBox) searchBox.addEventListener("input", debounce(() => {
      const total = projects.filter((p) =>
        ((p.title || "") + " " + (p.desc || "") + " " + (p.tags || []).join(" ")).toLowerCase().includes(searchBox.value.trim().toLowerCase())
      ).length;
      renderGrid();
    }));
  }

  /* ---------- 预览弹窗 ---------- */
  function bindPreview() {
    const backdrop = $("#backdrop");
    const frame = $("#frame");
    const modalTitle = $("#modal-title");

    function open(url, title) {
      frame.src = url;
      modalTitle.textContent = title;
      backdrop.classList.add("open");
      document.body.style.overflow = "hidden";
    }
    function close() {
      backdrop.classList.remove("open");
      frame.src = "about:blank";
      document.body.style.overflow = "";
    }

    // 事件委托：卡片点击 / 全景打开
    document.addEventListener("click", (e) => {
      // 卡片主体点击（避开按钮链接）
      const card = e.target.closest(".card");
      if (card && !e.target.closest("a, button")) {
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
      // 仅在预览弹窗打开时响应关闭
      if (backdrop.classList.contains("open")) {
        if (e.target.closest("[data-close]")) close();
        if (e.target === backdrop) close();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });

    /* 预览实际打开新窗口按钮（避免某些站点拒绝 iframe） */
    $("#open-now").addEventListener("click", () => {
      const url = frame.src;
      if (url && url !== "about:blank") window.open(url, "_blank", "noopener");
    });
  }

  /* ---------- 主题切换弹层 ---------- */
  function bindTheme() {
    const btn = $("#theme-btn");
    const panel = $("#theme-panel");
    const list = $("#theme-list");

    function renderOptions(activeId) {
      list.innerHTML = API.renderThemeOptions()
        .map((t) => `
          <button class="theme-option ${t.id === activeId ? "active" : ""}" data-theme-id="${t.id}">
            <span class="theme-swatch" aria-hidden="true"></span>
            <span>
              <strong>${t.label}</strong><br>
              <small style="color:var(--color-text-soft)">${t.desc}</small>
            </span>
          </button>`)
        .join("");
    }

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = panel.classList.toggle("open");
      if (open) renderOptions(document.documentElement.getAttribute("data-theme"));
    });

    // 点击浮层外部关闭（浮层打开时有效，不影响预览弹窗）
    document.addEventListener("click", (e) => {
      if (!panel.classList.contains("open")) return;
      if (!panel.contains(e.target) && !btn.contains(e.target)) {
        panel.classList.remove("open");
      }
    });

    list.addEventListener("click", (e) => {
      const opt = e.target.closest("[data-theme-id]");
      if (!opt) return;
      API.applyTheme(opt.dataset.themeId);
      renderOptions(opt.dataset.themeId);
      panel.classList.remove("open");
    });

    // 浮层内关闭按钮（不会误触预览弹窗）
    panel.addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) panel.classList.remove("open");
    });
  }

  /* ---------- 启动 ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    API.initTheme();
    bindTheme();
    bindSearch();
    bindPreview();
    loadProjects();
  });
})();