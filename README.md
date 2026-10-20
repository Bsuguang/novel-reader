# 本地 TXT 小说阅读器（V1 + V2）

一个**本地运行、纯前端、无云端依赖**的 TXT 小说阅读器。基于 novelReader 同款技术栈
（Electron + React 18 + Zustand）二次开发，覆盖 V1 四项核心功能与 V2 增强。

> 说明：因当前开发沙箱无法访问 GitHub（代理拦截），本工程按 novelReader 的架构与
> 技术栈从零搭建为**可直接运行的独立工程**，而非 fork 其仓库。若你已 `git clone`
> novelReader，可将本工程的 `src/` 覆盖过去并补齐 `main.js` / `preload.js` 即可复用。

## V1 功能

1. **TXT 导入 + 编码识别**：拖拽 / 按钮选择 `.txt`；主进程读取原始字节，自动检测编码
   （UTF-8 / GBK / GB2312 / Big5 / UTF-16）并解码为 UTF-8，无乱码。
2. **章节识别 + 目录**：内置正则识别「第X章 / 第X回 / 卷X / 序章 / 楔子 / 番外 …」，
   左侧目录点击跳转、当前章高亮。
3. **阅读设置与主题**：字号、行高、段距、边距、自定义背景/文字色 + 4 套预设主题，
   设置持久化。
4. **进度保存 + 全文搜索**：按书自动记录阅读位置（重开续读）；全文关键词搜索，结果
   列表点击跳转并高亮。

## V2 功能

5. **书架**：自动记录打开过的书籍，顶部「书架」按钮打开书库；点击直接重开（按已存路径
   读取，无需重新选文件），可一键从书架移除（同步清除其书签与进度）。
6. **书签 / 笔记**：顶部「书签」打开面板；为当前阅读位置一键加书签（自动以所在章节命名，
   可附文字笔记）；点击书签跳回原处，可删除。
7. **朗读（TTS）**：顶部「朗读」打开朗读条，调用系统 Web Speech API 从当前段落开始朗读，
   支持 播放 / 暂停 / 继续 / 停止 与 0.5x–2x 语速；长段落自动按句切分避免截断，并高亮
   正在朗读的段落。中文朗读依赖系统中文嗓音（Windows 自带 Microsoft 中文语音）。
8. **超大文件流畅**：正文用 CSS `content-visibility: auto`，仅渲染视口附近段落；目录/搜索
   跳转用「迭代逼近」定位，绕开折叠段落的尺寸误差（已用 15.7MB / 24.5 万行真实样本验证）。

## 技术栈

- Electron（桌面壳，主进程负责文件读取 / 编码检测 / 持久化）
- React 18 + Zustand（渲染进程 UI 与状态）
- 编码识别：**Node 内置 `TextDecoder`**，零第三方依赖，支持中文 GBK/Big5
- 大文件流畅：段落使用 CSS `content-visibility: auto`，只渲染视口附近内容

## 目录结构

```
novel-reader/
├── main.js              # Electron 主进程：打开文件、编码检测、IPC、持久化
├── preload.js           # 暴露 window.api 给渲染进程（上下文隔离）
├── store.js             # 极简 JSON 持久化（设置/进度/最近文件）
├── start.bat           # Windows 一键启动脚本（支持 start.bat "书.txt"）
├── scripts/dist.js     # 打包脚本（关闭代码签名自动发现，规避 winCodeSign 解压失败）
├── index.html
├── webpack.config.js / .babelrc
├── src/
│   ├── index.jsx        # 渲染进程入口
│   ├── App.jsx
│   ├── store/useStore.js# Zustand 全局状态
│   ├── lib/             # 纯逻辑（可单测，无 React 依赖）
│   │   ├── encoding.js  # 编码检测 / 解码
│   │   ├── chapter.js   # 章节识别
│   │   └── search.js    # 全文搜索
│   ├── components/      # TitleBar / FileImport / Reader / ChapterTOC / SettingsPanel
│   │                     # SearchBar / Library / BookmarkPanel / TtsBar
│   └── styles/index.css
└── test/                # 核心算法单元测试（Node 直接跑，无需 Electron）
```

## 快速开始

```bash
npm install      # 安装依赖（含 electron，需要联网）
npm run build    # webpack 打包到 dist/bundle.js
npm start        # 启动应用（等价于 webpack 打包后 electron .）
```

也可一步到位：`npm start`（已配置先 build 再启动）。
打开后拖入或选择任意 TXT（项目内含 `test-novel.txt` 示例，另提供 GBK 样本用于编码验证）。

## 快捷打开（免开终端）

不想每次都打开终端敲命令？三种方式任选：

### 1. 一键启动脚本（开发期最省事）
双击工程根目录的 **`start.bat`** 即可启动（等同于 `npm start`）。
还支持直接带书名启动：

```bat
start.bat "D:\小说\凡人修仙传.txt"
```

### 2. 双击 .txt 直接读（拖拽 / 文件关联）
应用已支持**读取启动参数里的文件路径**（双击文件、把文件拖到 exe 上、或右键「打开方式」选本程序都会触发）。
开发期可用：

```bat
start.bat "D:\小说\凡人修仙传.txt"
```

打包成正式版（见下）后，把 `.txt` 右键「打开方式」指向本阅读器的 exe，
之后**双击任意 txt 都会直接用本阅读器打开并定位到上次进度**。

### 3. 打包成独立 exe（彻底免项目）
一条命令产出可分发安装包 / 便携版（无需 Node 环境即可运行）：

```bash
npm run dist        # 等价于 node scripts/dist.js（先 webpack，再 electron-builder）
```

产物在 `release/`：
- `小说阅读器 Setup *.exe` —— 双击安装，桌面生成图标，像普通软件一样使用；
- `小说阅读器 *.exe`（portable）—— 单文件免安装，拷到哪都能用。

> **关于签名**：个人本地使用无需代码签名，`npm run dist` 已通过 `scripts/dist.js` 设置
> `CSC_IDENTITY_AUTO_DISCOVERY=false` 关闭自动签名，可跳过 electron-builder 的 `winCodeSign`
> 工具包下载（该包含 macOS 符号链接，普通 Windows 权限下 7-zip 解压会报「无法创建符号链接」而失败）。
> 产物为**未签名** exe，首次打开 Windows 可能弹出 SmartScreen「Windows 已保护你的电脑」——
> 点「更多信息 → 仍要运行」即可正常使用。若要分发给他人，再自行配置代码签名证书。

> 打包需要本地有 `npm` 与网络（拉取 electron-builder 依赖）。沙箱环境无法执行打包，
> 请在你本机运行。打包前确保已 `npm install`。
> 若报 `remove ...\win-unpacked\resources\app.asar: The process cannot access the file because it is being used by another process`，
> 是上一轮残留的 electron/阅读器进程或杀毒软件仍占用 `release/` 目录；`npm run dist` 已会自动清理旧
> `release/`，若仍报此错，请**先关闭已打开的阅读器窗口**，或在任务管理器结束 `electron.exe` / `app-builder.exe` 后重试。

## 测试

核心算法（编码识别 / 章节解析 / 全文搜索）与「目录 / 搜索 / 书签跳转映射」已用 Node 单测
覆盖，无需启动 GUI：

```bash
node test/lib.test.js          # 编码/章节/搜索算法
node test/verify-jump.js       # 真实大文件（凡人修仙传 GBK/CRLF）跳转映射校验
```

> `verify-jump.js` 需要把路径改为你本地的小说文件；默认指向一份 GBK+CRLF 的真实样本用于
> 回归：段落切分、章节精确映射、搜索偏移映射、书签 round-trip 等。

## 已知限制 / 后续规划

- 当前为大文件「段落级」流畅（content-visibility），未做逐行虚拟滚动；若需更极致的超大型
  文件（>50MB）性能，可后续接入 react-window。
- 编码检测为启发式（BOM → UTF-8 校验 → GBK/Big5 打分），极端混合编码可手动补充；如需更严格
  可用 jschardet 替换 `src/lib/encoding.js` 的 `detectEncoding`。
- 朗读依赖系统已安装的中文语音（Windows 一般在「设置 → 时间和语言 → 语音」里确认有中文
  嗓音）；若列表为空则只能朗读为系统默认语言。
