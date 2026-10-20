# 本地小说阅读器（novel-reader）

一个**本地运行、纯前端、无云端依赖**的 TXT / Markdown 小说阅读器。
基于 Electron + React 18 + Zustand 构建，支持 **Windows 与 macOS**，
内置桌面宠物、TTS 朗读、全文搜索、书签笔记等完整阅读体验。

> 协议：MIT。欢迎 Fork / 提 PR（合并到 `main` 需经过仓库所有者审核）。

## 功能总览

### 📖 阅读核心

| 功能 | 说明 |
|---|---|
| 文件导入 | 拖拽到窗口 / 按钮选择 / 双击 `.txt` 文件关联，支持 `.txt` 与 `.md` |
| 编码识别 | UTF-8 / GBK / GB2312 / Big5 / UTF-16 自动检测（BOM → UTF-8 校验 → GBK/Big5 打分），无乱码 |
| 章节识别 | 正则识别「第X章 / 第X回 / 卷X / 序章 / 楔子 / 番外…」；`.md` 文件按 `#` / `##` / `###` 标题切章 |
| 目录导航 | 左侧章节目录（大目录虚拟滚动，数千章不卡），点击跳转、当前章高亮、上一章/下一章 |
| 进度续读 | 按书自动记录阅读位置与全书进度百分比，重开自动定位 |
| 大文件流畅 | 按章懒加载切段 + CSS `content-visibility: auto`，仅渲染视口附近内容（15MB+ 样本验证） |

### 🔍 搜索与书签

| 功能 | 说明 |
|---|---|
| 全文搜索 | 300ms 防抖、缓存优化；结果显示所属章节，支持「上一处 / 下一处」循环导航 |
| 书签笔记 | 一键添加（自动以所在章节命名，可附文字笔记）；面板显示原文摘录预览 |
| 导出笔记 | 书签 / 笔记一键导出为 Markdown 文件 |

### 🎧 朗读与阅读辅助

| 功能 | 说明 |
|---|---|
| TTS 朗读 | 系统 Web Speech API，播放 / 暂停 / 继续 / 停止；长段落按句切分；朗读段落高亮并自动滚入视野；跨章续读 |
| TTS 设置 | 0.5x–2x 语速、嗓音选择，均持久化保存 |
| 自动滚屏 | 开关 + 0.5–5x 速度调节，滚到章底自动进入下一章 |
| 阅读统计 | 累计阅读时长统计（持久化）、本章剩余预计阅读时间（约 500 字/分钟） |
| 阅读设置 | 字号、行高、段距、边距、字体（宋体/雅黑/楷体等 7 种，Win/mac 双平台字体栈）、4 套预设主题 + 自定义颜色 |

### 🐾 桌面宠物

- 点**最小化**后，主窗口化身一只小动物停留在桌面（透明、置顶、不占任务栏）
- 6 种可选：🐱 小猫 / 🐶 小狗 / 🐰 小兔 / 🐼 熊猫 / 🦊 狐狸 / 🐤 小鸡
- 待机动画：呼吸起伏、眨眼、摇尾巴 / 扇翅膀；单击会开心弹跳
- 按住拖动可移动位置（自动记忆停靠点）；**双击或右键回到阅读器**
- 在「设置 → 桌面宠物」中更换动物

### 🗂 书架

- 自动记录打开过的书籍，显示已读百分比、累计阅读时长、最后阅读时间
- 点击直接重开（按已存路径），可一键移除（同步清除书签与进度）

### ⌨️ 快捷键

| 快捷键 | 功能 |
|---|---|
| `Ctrl/Cmd + F` | 全文搜索 |
| `Ctrl/Cmd + O` | 打开文件 |
| `Ctrl/Cmd + F`（mac）或 `F11`（Win） | 全屏切换 |
| `←` / `→` | 上一章 / 下一章 |
| `↑` / `↓` / `Space` | 滚动正文 |
| `+` / `-` | 增大 / 减小字号 |
| `Esc` | 逐层关闭面板 |

### 🛡 数据安全

- 配置（进度 / 书签 / 书架 / 设置）**原子化写入**（临时文件 + rename），并保留 `.bak` 备份，损坏自动回退，杜绝断电丢数据
- 文件读取与编码检测全异步，大文件不再阻塞界面
- 渲染层启用 CSP，文件拖入窗口不触发页面导航

## 运行环境

| 依赖 | 要求 |
|---|---|
| Node.js | **≥ 18**（建议 20 LTS 或 22 LTS，开发验证于 Node 22） |
| npm | 随 Node.js 附带 |
| 操作系统 | Windows 10/11（x64）或 macOS 11+（Intel / Apple Silicon） |
| 网络 | 首次 `npm install` 需联网（拉取 Electron 二进制） |
| 磁盘 | 约 500 MB（含 Electron 依赖与构建产物） |
| TTS | 中文朗读依赖系统中文语音：Windows 自带 Microsoft 中文语音；macOS 在「系统设置 → 辅助功能 → 朗读内容」确认有中文嗓音 |

## 快速开始

```bash
git clone https://github.com/Bsuguang/novel-reader.git
cd novel-reader
npm install      # 安装依赖（含 electron，需要联网）
npm run build    # webpack 打包到 dist/bundle.js
npm start        # 启动应用（先 build 再启动 electron .）
```

也可一步到位：`npm start`。打开后拖入或选择任意 TXT / MD 文件即可开始阅读。

## Windows 运行命令

```bat
:: 开发运行
npm install
npm start

:: 一键启动脚本（等同于 npm start）
start.bat

:: 带书启动
start.bat "D:\小说\凡人修仙传.txt"

:: 打包成安装包 / 便携版 exe（产物在 release\）
npm run dist
```

打包产物：
- `小说阅读器 Setup *.exe` —— 双击安装，像普通软件一样使用；
- `小说阅读器 *.exe`（portable）—— 单文件免安装，拷到哪都能用。

> 打包产物为**未签名** exe，首次打开可能弹出 SmartScreen——点「更多信息 → 仍要运行」即可。
> 若打包报 `app.asar` 被占用，先关闭已打开的阅读器窗口再重试（`npm run dist` 已自动清理旧 `release/`）。

## macOS 运行命令

```bash
# 开发运行
npm install
npm start

# 一键启动脚本（首次运行自动 npm install）
./start.command

# 带书启动
./start.command "/Users/xxx/小说/凡人修仙传.txt"

# 打包 dmg / zip（Intel + Apple Silicon 双架构，产物在 release/）
npm run dist
```

macOS 专属说明：
- 双击 `.txt` 文件关联：Finder 中右键文件 →「打开方式」→ 选择本应用（打包后生效）；
  运行中把文件拖到 Dock 图标同样可以打开。
- 应用使用 `hiddenInset` 标题栏，原生红绿灯按钮已做避让。
- 未签名的 app 首次打开需**右键 → 打开**绕过 Gatekeeper；正式分发需配置
  Apple 开发者签名 + 公证（$99/年）。
- mac 打包配置（dmg + zip、x64/arm64、分类 books、关联 txt/md）已内置在
  `package.json` 的 `build.mac` 段。

## 目录结构

```
novel-reader/
├── main.js              # Electron 主进程：文件读取、编码检测、IPC、持久化、宠物窗、mac 适配
├── preload.js           # 暴露 window.api 给渲染进程（上下文隔离）
├── store.js             # JSON 持久化（原子写入 + .bak 备份 + 防抖合并）
├── pet.html / pet.js    # 桌面宠物窗口（6 种 SVG 动物 + 动画）
├── start.bat            # Windows 一键启动脚本（支持 start.bat "书.txt"）
├── start.command        # macOS 一键启动脚本
├── scripts/dist.js      # 打包脚本（关闭签名自动发现，规避 winCodeSign 解压失败）
├── index.html
├── webpack.config.js / .babelrc
├── src/
│   ├── index.jsx        # 渲染进程入口
│   ├── App.jsx          # 全局快捷键、启动续读
│   ├── store/useStore.js# Zustand 全局状态（行缓存、进度 ratio、阅读时长等）
│   ├── lib/             # 纯逻辑（可单测，无 React 依赖）
│   │   ├── encoding.js  # 编码检测 / 解码
│   │   ├── chapter.js   # 章节识别（TXT 正则 + Markdown 标题）
│   │   ├── text.js      # 章节切段（行缓存优化）
│   │   └── search.js    # 全文搜索（lowercase 缓存）
│   ├── components/      # TitleBar / FileImport / Reader / ChapterTOC（虚拟滚动）
│   │                    # ChapterNav / SettingsPanel / SearchBar / Library
│   │                    # BookmarkPanel / TtsBar
│   └── styles/index.css
└── test/                # 核心算法单元测试（Node 直接跑，无需 Electron）
```

## 测试

核心算法（编码识别 / 章节解析 / 全文搜索）与「目录 / 搜索 / 书签跳转映射」已用 Node 单测
覆盖，无需启动 GUI：

```bash
node test/lib.test.js          # 编码/章节/搜索算法
node test/verify-jump.js       # 真实大文件（GBK/CRLF）跳转映射校验
```

> `verify-jump.js` 需要把路径改为你本地的小说文件；默认指向一份 GBK+CRLF 的真实样本用于
> 回归：段落切分、章节精确映射、搜索偏移映射、书签 round-trip 等。

## 参与贡献

1. Fork 本仓库或新建分支；
2. 提交 Pull Request（合并到 `main` 需仓库所有者审核批准，强推与删分支已被保护规则禁止）；
3. 提 PR 前请确认 `node test/lib.test.js` 全部通过、`npm run build` 无报错。

## 已知限制 / 后续规划

- 当前为大文件「段落级」流畅（content-visibility），未做逐行虚拟滚动；若需更极致的超大型
  文件（>50MB）性能，可后续接入 react-window。
- 编码检测为启发式（BOM → UTF-8 校验 → GBK/Big5 打分），极端混合编码可手动补充；如需更严格
  可用 jschardet 替换 `src/lib/encoding.js` 的 `detectEncoding`。
- 朗读依赖系统已安装的中文语音；若列表为空则只能朗读为系统默认语言。
- macOS 打包需在真实 mac 环境执行 `npm run dist`；正式分发需 Apple 签名 + 公证。
- 应用图标暂用 Electron 默认图标，欢迎 PR 提供 icns / ico。
