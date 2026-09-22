/* ============================================================
   THEME MANAGER · 主题管理器
   ------------------------------------------------------------
   全站风格切换的唯一入口。要换风格：
   1. 在 styles/themes/ 下新增 xxx.css（用 data-theme="xxx" 覆盖变量）
   2. 在下方 THEMES 注册表中加一项
   组件代码完全不动。
   ============================================================ */

const THEMES = [
  {
    id: "playful",
    label: "趣味插画",
    desc: "活泼角色 + 鲜明配色 + 圆润造型",
    file: "styles/themes/playful.css",
  },
  // —— 以后新增主题就在这里追加，例如：
  // {
  //   id: "minimal",
  //   label: "极简素净",
  //   desc: "安静、留白、克制",
  //   file: "styles/themes/minimal.css",
  // },
];

const storageKey = "vibeshowcase-theme";

/* 加载主题 CSS 文件（幂等，切换时移除旧文件） */
function loadThemeFile(href) {
  const existing = document.querySelector('link[data-theme-file]');
  if (existing) existing.remove();
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.themeFile = "true";
  document.head.appendChild(link);
}

/* 应用主题：写入 data-theme 属性（CSS 变量切换）+ 缓存 */
function applyTheme(id) {
  const theme = THEMES.find((t) => t.id === id) || THEMES[0];
  document.documentElement.setAttribute("data-theme", theme.id);
  loadThemeFile(theme.file);
  try {
    localStorage.setItem(storageKey, theme.id);
  } catch (e) {
    /* 隐私模式等场景忽略 */
  }
  window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
  return theme;
}

/* 初始化主题：优先 localStorage，否则默认第一项 */
function initTheme() {
  let id = THEMES[0].id;
  try {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem(storageKey);
      if (saved && THEMES.some((t) => t.id === saved)) id = saved;
    }
  } catch (e) {
    /* ignore */
  }
  return applyTheme(id);
}

/* 渲染主题切换弹层选项（供 UI 调用） */
function renderThemeOptions() {
  return THEMES.map((t) => ({
    ...t,
  }));
}

if (typeof window !== "undefined") {
  window.VibeShowcaseTheme = { THEMES, applyTheme, initTheme, renderThemeOptions };
}