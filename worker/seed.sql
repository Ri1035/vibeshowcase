-- ============================================================
-- 预填：把 Ri1035 真实 12 个作品写入 D1（幂等：id 冲突则忽略，可重跑）
-- 用 INSERT OR IGNORE 以 id 为主键去重
-- ============================================================
INSERT OR IGNORE INTO projects (id, title, description, gh_url, cf_url, status, preview, tags) VALUES
('photo-toolkit', '泡泡图片工坊', '纯本地图片工具箱：压缩到指定KB、格式转换、修改尺寸与DPI、GIF压缩。浏览器内 WebAssembly 处理，图片不上传。', 'https://github.com/Ri1035/photo-toolkit', 'https://photo-toolkit.pages.dev', 'deployed', 'https://photo-toolkit.pages.dev', '["图片工具","WebAssembly"]'),
('vectorkit', 'VectorKit 矢量转换器', '纯前端矢量转换器：位图⇄SVG、CMYK EPS 导出、SVG 优化压缩、去背景，全部在浏览器本地完成。', 'https://github.com/Ri1035/vectorkit', 'https://vectorkit.pages.dev', 'deployed', 'https://vectorkit.pages.dev', '["矢量","设计工具"]'),
('pdd-workbench', '拼多多履约工作台', '拼多多开放平台能力分析 + 履约工作台（纯前端原型 + OpenAPI 契约）。', 'https://github.com/Ri1035/pdd-workbench', 'https://pdd-workbench-9of.pages.dev', 'deployed', 'https://pdd-workbench-9of.pages.dev', '["拼多多","工作台"]'),
('rainy-magic-street', '雨夜魔法街区', '雨夜魔法街区街角 · 三渲二微缩三维场景（three.js 单文件 / 自由拖拽旋转缩放）。', 'https://github.com/Ri1035/rainy-magic-street', 'https://rainy-magic-street.pages.dev', 'deployed', 'https://rainy-magic-street.pages.dev', '["Three.js","3D","三渲二"]'),
('rainy-convenience-store', '雨夜便利店', '雨夜便利店街角 - 三渲二微缩3D场景 (Three.js)。', 'https://github.com/Ri1035/rainy-convenience-store', 'https://rainy-convenience-store.pages.dev', 'deployed', 'https://rainy-convenience-store.pages.dev', '["Three.js","3D","三渲二"]'),
('rainy-konbini', '雨夜便利店（konbini）', '雨夜便利店街角 · 三渲二微缩三维场景（three.js 单文件 / 自由拖拽旋转缩放）。', 'https://github.com/Ri1035/rainy-konbini', 'https://rainy-konbini.pages.dev', 'deployed', 'https://rainy-konbini.pages.dev', '["Three.js","3D","三渲二"]'),
('box-wms', 'BOX WMS 仓库管理系统', 'BOX WMS - 仓库管理系统 (Warehouse Management System)。', 'https://github.com/Ri1035/box-wms', 'https://box-wms.pages.dev', 'deployed', 'https://box-wms.pages.dev', '["WMS","管理系统"]'),
('pingtu', '拼图编辑器', 'mergeimage.org 复刻版在线图片合并/拼图编辑器（图片多选 + 文字叠加 + 系统字体）。', 'https://github.com/Ri1035/pingtu', 'https://pingtu-ch8.pages.dev', 'deployed', 'https://pingtu-ch8.pages.dev', '["拼图","图片工具"]'),
('tag-pricing-calculator-vpro', 'tag-pricing-calculator-vpro', '标签定价计算器 VPro 版。', 'https://github.com/Ri1035/tag-pricing-calculator-vpro', '', 'source', '', '["计算器"]'),
('tag-pricing-calculator', 'tag-pricing-calculator', '标签定价计算器。', 'https://github.com/Ri1035/tag-pricing-calculator', '', 'source', '', '["计算器"]'),
('pdd-sku-monitor', '拼多多 SKU 监控', '拼多多商家自研 SKU 库存监控工作台（官方合规，区分现货/定制，库存预警）。', 'https://github.com/Ri1035/pdd-sku-monitor', '', 'source', '', '["拼多多","库存监控"]'),
('koka-family-website', 'KOKA FAMILY 官网', 'KOKA FAMILY 品牌官网 · 奶油糖果风单页站点。', 'https://github.com/Ri1035/koka-family-website', '', 'source', '', '["品牌官网","落地页"]');