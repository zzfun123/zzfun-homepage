# zzfun.cc — 个人主页项目结构与功能索引

基于 **Vite + Three.js + GSAP + Lenis** 构建的 WebGL 3D 交互个人主页。

---

## 1. 项目目录结构

```text
github个人网页11/
├── index.html                  # 页面 HTML 结构、导航西红柿 SVG 图标、社交入口卡片与文案
├── package.json                # 项目依赖与脚本配置 (three, gsap, lenis, vite)
├── vite.config.js              # Vite 构建配置（已设置 base: './'，支持直接部署至 GitHub Pages）
├── README.md                   # 项目结构与功能索引说明（本文件）
└── src/
    ├── main.js                 # 前端总入口：Lenis 平滑滚动、预载器动画、自定义弹簧光标、章节进入触发
    ├── style.css               # 全局设计变量、排版、卡片交互与响应式样式
    └── three/
        ├── stage.js            # WebGL 核心舞台：渲染管线、白->绿喷枪颗粒渐变 Shader、拖拽旋转、首屏滚动收起
        ├── glassMaterial.js    # 3D 玻璃立方体材质：6 波段色散折射 (R/Y/G/C/B/P)、菲涅尔彩边与双光源高光
        ├── floatingToys.js     # 3D 悬浮物体系统：立体 3D 西红柿 + 几何玩具、环绕公转/自转、悬停放大與点击脉冲
        └── headlineTexture.js  # 首屏背景大字纹理：离屏 2D Canvas 绘制 "ZZFUN." 供玻璃立方体实时折射
```

---

## 2. 各文件核心功能与常用修改指南

### `index.html` — 页面内容与链接入口
- **左上角 Logo 与网页图标（Favicon）**：内嵌手绘风西红柿矢量 SVG。
- **第一幕 `#hero`**：首屏标语（`造点好玩的 / Making the web a playground`）与 3D 拖拽热区 `#dragZone`。
- **第二幕 `#about`**：个人介绍文案。
- **第三幕 `#links`**：社交与作品入口卡片（`GitHub`、`Bilibili`、`Email`），将 `<a class="link-card" href="#">` 中的 `#` 替换为你的真实地址即可。
- **第四幕 `#contact`**：底部联系邮箱按钮与巨型描边页脚 `ZZFUN.CC`。

### `src/style.css` — 样式与配色系统
- **设计 Token（`:root`）**：
  - `--paper: #FFFFFF`（纯白底色）
  - `--blue: #0E7FD8`（晴空蓝主色）
  - `--ink: #0C3B66`（深墨蓝文字与描边色）
  - `--lemon: #FFC940`（柠檬黄硬阴影与高亮色）
  - `--ribbon: #FF6154`（西红柿/丝带红点缀色）
- 包含预载器（`.preloader`）、自定义光标（`.cursor`）、导航栏（`.nav`）、入口卡片（`.link-card`）及移动端响应式断点。

### `src/main.js` — 交互与滚动控制
- **平滑滚动**：初始化 `Lenis` 并与 `GSAP ScrollTrigger` 同步，支持点击顶部导航平滑滚动至对应章节。
- **预载器揭幕**：等待 WebGL 舞台准备就绪后，读数走满 `100` 并向上拉起帷幕，同时触发首屏 3D 立方体与 3D 西红柿的登场脉冲。
- **自定义弹簧光标**：跟随鼠标平滑插值，悬停在链接、按钮或首屏 3D 物体上时自动放大变为柠檬黄。
- **章节入场揭示**：滚动到各章节时为 `.scene` 添加 `.in-view` 类，触发 `.rise` 元素的弹性上浮动画。

### `src/three/stage.js` — WebGL 渲染管线与背景渐变 Shader
- **白 → 绿喷枪颗粒弥散渐变（`bgMat`）**：
  - 使用 GLSL 片元着色器实时生成**顶部 100% 纯白 → 下方嫩黄绿 / 鲜草绿 / 斜向深翠绿叶片弧块**的喷枪散点（Airbrush Stipple）过渡效果。
- **双通道实时折射管线**：
  - `Pass 1`：渲染背景画布 + 位于立方体后方（`z < 0`）的 3D 悬浮物体至 `rtBack`。
  - `Pass 2`：叠加渲染玻璃立方体背面（`backMat`）至 `rtFront`。
  - `Pass 3`：将背景、全部 3D 悬浮物体与玻璃立方体正面（`frontMat`）渲染至屏幕。
- **仅限首屏动效控制**：
  - 随页面向下滚动，3D 舞台与首屏同步上移滚出视口；当完全滚出首屏后自动停止渲染 3D 物体，保证下方阅读区清爽无干扰。

### `src/three/glassMaterial.js` — 6 波段色散光学玻璃材质
- 自定义 GLSL 顶点与片元着色器，通过红、黄、绿、青、蓝、紫 6 个不同折射率（`uIorR` ~ `uIorP`）分通道采样背景，实现棱镜色散彩边、Blinn-Phong 双光源镜面高光与晴空蓝/柠檬黄菲涅尔边缘光。

### `src/three/floatingToys.js` — 3D 西红柿与悬浮几何体微交互
- **`createTomatoMeshGroup`**：程序化构建 3D 饱满西红柿（6 瓣微棱红果体 + 顶部凹窝 + 5 片五角绿萼叶 + 弯曲果蒂）。
- **环绕公转与折射**：3D 西红柿一边自转，一边环绕中央玻璃立方体做 3D 轨道公转（转到立方体背后时会被玻璃实时色散折射）。
- **交互响应**：支持鼠标视差跟随、悬停 Q 弹放大，点击任意 3D 物体会触发弹性缩放与加速旋转脉冲。

### `src/three/headlineTexture.js` — 首屏巨型标题画布
- 使用离屏透明 2D Canvas 绘制首屏背景巨字 `"ZZFUN."`（柠檬黄阴影 + 晴空蓝主体 + 红句点），随首屏滚动自然上移淡出。

---

## 3. 常用命令

```bash
# 启动本地开发服务器（支持热更新）
npm run dev

# 打包生成生产环境静态文件（输出至 dist/ 目录）
npm run build

# 本地预览打包后的生产版本
npm run preview
```

---

## 4. 以后如何修改并更新线上网站（`zzfun.cc`）

因为你的 Cloudflare 已经和 GitHub 仓库（`zzfun123/zzfun-homepage`）绑定了**全自动同步**，以后只要 GitHub 里的文件一变，`zzfun.cc` 就会在 30 秒内自动重新打包上线（完全不需要再去打开 Cloudflare）。

### 标准三步曲（零命令行）：

1. **第一步：在本地改代码并预览**
   - 双击文件夹里的 **`启动网页.bat`**，浏览器会自动打开本地预览页面。
   - 修改你需要改的文件（比如打开 `index.html` 改文字或把 `#` 换成真实链接；或者让 AI 帮你改 `src/` 里的效果），本地浏览器会实时看到修改后的效果。

2. **第二步：把改好的文件拖进 GitHub**
   - 在浏览器打开你的 GitHub 仓库上传地址：
     👉 **https://github.com/zzfun123/zzfun-homepage/upload/main**
   - 如果你只改了 `index.html`，就把新的 `index.html` 拖进去；如果改了 `src` 里的文件，就把整个 **`src` 文件夹**（连同 `index.html`）一起拖进去（它会自动覆盖旧文件）。
   - 点击页面最底部绿色的 **`Commit changes`** 按钮。

3. **第三步：等待 30 秒自动生效**
   - 点完 `Commit changes` 后什么都不用管，Cloudflare 会自动检测到 GitHub 更新并后台重新打包，约 30 秒后刷新 **https://zzfun.cc** 即可看到最新网页！

