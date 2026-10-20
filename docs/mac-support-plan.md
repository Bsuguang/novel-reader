# macOS 本地支持升级规划（不动源码的可行性分析 + 分阶段路线）

> 目标：评估当前工程在 macOS 上「开箱能跑多少、改多少配置能分发、哪些代码迟早要动」，
> 给出分阶段路线。本文档为规划，不涉及任何源码修改。

## 一、现状盘点：代码的平台兼容性

### 已经是跨平台兼容的（无需处理）

| 模块 | 现状 | 结论 |
|---|---|---|
| 窗口生命周期 | `window-all-closed` 已判断 `platform !== 'darwin'`，`activate` 已重建窗口 | ✅ 标准 mac 行为已预留 |
| 数据目录 | `app.getPath('userData')`，macOS 自动落在 `~/Library/Application Support` | ✅ |
| 编码检测 | Node/Chromium 内置 `TextDecoder`，GBK/Big5 解码器 mac 同样内置 | ✅ |
| 持久化 | 临时文件 + rename 原子写，APFS 兼容 | ✅ |
| 桌面宠物 | 透明窗/置顶/`skipTaskbar`/手动拖动 IPC 在 macOS 均可用（`screen-saver` level 合法） | ✅ |
| TTS | Web Speech API 在 macOS Chromium 可用，系统自带中文嗓音（婷婷等） | ✅ |
| 大文件方案 | content-visibility 与平台无关；Retina 缩放无影响 | ✅ |
| 安全模型 | contextIsolation + preload，无平台专属 API | ✅ |

### 平台差异点（不改代码时的表现）

| 差异点 | 不改代码在 macOS 上的表现 | 严重度 |
|---|---|---|
| `titleBarOverlay`（Windows 专属的自绘窗控按钮） | macOS 上 `titleBarStyle: 'hidden'` 会显示原生红绿灯按钮，但**红绿灯在左上角，与自绘标题栏的「打开/书架」按钮重叠** | ⚠️ 高（UI 冲突） |
| 双击 .txt 打开（文件关联） | macOS 通过 `app.on('open-file')` 事件传文件路径，当前只读 `process.argv`（Windows 方式）→ 双击 txt 无法直接打开 | ⚠️ 中 |
| 快捷键 | Ctrl+F / Ctrl+O 在 mac 约定是 Cmd+F / Cmd+O；F11 全屏在 mac 无效（约定 Ctrl+Cmd+F） | ⚠️ 低-中 |
| 中文字体栈 | SimSun/SimHei/KaiTi/FangSong 是 Windows 字体，mac 上会静默回退到 serif/sans-serif；字体栈里已含 Songti SC / PingFang SC，阅读不至于破相，但「宋体/楷体」选项实际无效 | ⚠️ 低 |
| `start.bat` | Windows 脚本，mac 用 `npm start` 即可 | ℹ️ |

### 结论

**零代码修改**即可在 macOS 上运行并覆盖 90% 功能（打开/编码/目录/搜索/书签/进度/TTS/宠物/自动滚屏全部可用），
但**文件关联和标题栏红绿灯重叠**两个问题决定了「能用」与「好用」之间还需要一次极小的代码适配
（预计 < 30 行）和一批纯配置改动。

## 二、分阶段路线

### Phase 0 —— 零改动验证（半天，纯手动测试）

在任意 Mac 上：

```bash
npm install && npm start
```

逐项验证清单（建议按此顺序过一遍并记录）：

- [ ] 拖入 GBK / UTF-8 / UTF-16 三种编码样本，确认无乱码
- [ ] 章节识别、目录跳转、搜索（含防抖手感）、书签、进度续读
- [ ] 设置面板：主题/字号/字体（确认回退效果）/宠物选择
- [ ] 最小化 → 桌面宠物出现、可拖动、双击恢复；位置记忆
- [ ] TTS：中文嗓音列表、语速、跟随滚动
- [ ] 书签/笔记导出 markdown
- [ ] 明暗模式切换下各面板配色是否可读（目前 UI 是深色固定配色，大概率无碍）
- [ ] 15MB+ 大文件翻章流畅度（M 系列 vs Intel 各测一次）

产出：一份 mac 兼容性实测记录，决定后续投入。

### Phase 1 —— 只改配置/资源，不改源码（1 天）

1. **electron-builder mac 配置**（`package.json` 的 `build` 字段，属配置非代码）：
   ```jsonc
   "mac": {
     "target": [{ "target": "dmg", "arch": ["x64", "arm64"] }, { "target": "zip", "arch": ["x64", "arm64"] }],
     "category": "public.app-category.books",
     "icon": "build/icon.icns",
     "darkModeSupport": true
   }
   ```
   - Intel（x64）与 Apple Silicon（arm64）各出一份；不追求 universal（体积翻倍收益小）
   - `dmg` 用于安装分发，`zip` 留给后续 electron-updater 自动更新
2. **图标**：把现有 ico/png 转 `.icns`（`iconutil` 一条命令，或 electron-builder 自动从 512px png 生成）
3. **文件关联（Info.plist 级配置）**：electron-builder 的 `extendInfo` 加 `CFBundleDocumentTypes`（`public.plain-text`）——注意：这只让系统允许"打开方式"选中本 App，真正接住路径仍需 Phase 2 的 `open-file` 事件
4. **mac 启动脚本**：仿 `start.bat` 做一个 `start.command`（双击即可 `npm start`）
5. **构建环境注意**：mac 构建需要联网拉 electron 的 mac 发行包；此前 README 记录的 winCodeSign 解压问题在 mac 侧不存在，但需留意 Xcode Command Line Tools 已安装

### Phase 2 —— 最小代码适配（0.5~1 天，约 30~50 行）

> Phase 1 之后「装得上」，这一步之后「用得对」。改动清单按优先级：

1. **标题栏适配红绿灯**（必修）：mac 下 `titleBarStyle` 改用 `'hiddenInset'` 并给 `.titlebar` 左侧留 ~80px padding；或运行时判断平台只给 Windows 传 `titleBarOverlay`
2. **接住 open-file 事件**（必修）：`app.on('open-file', ...)` 存路径，窗口 ready 后走现有 `get-startup-file` 同款通道 → 双击 txt 直接打开
3. **快捷键平台化**（建议）：`e.metaKey || e.ctrlKey` 同时识别，F11 在 mac 映射为 `Ctrl+Cmd+F` 或走 `toggle-fullscreen`
4. **字体栈平台化**（建议）：mac 检测时把宋体映射为 Songti SC、楷体映射为 Kaiti SC、仿宋映射为 STFangsong，雅黑映射为 PingFang SC
5. 收尾：宠物窗在多显示器/刘海屏下的默认停靠位置、Dock 图标点击重建窗口（`activate` 已有）

### Phase 3 —— 分发与运维（按需）

1. **签名与公证（决定用户体验的关键）**：
   - 无签名：用户首次打开需「右键 → 打开」或 `xattr -cr 小说阅读器.app`，体验差但可用（个人使用可接受）
   - 正式分发：Apple Developer Program（$99/年）→ Developer ID 签名 + notarytool 公证，才不会弹 Gatekeeper 拦截
2. **自动更新**（可选）：Phase 1 已出 zip，接 `electron-updater` + GitHub Releases 即可
3. **CI**：GitHub Actions 的 `macos-latest` runner 可产出 dmg（注意 runner 无签名证书时产物未签名）
4. **测试矩阵**：Intel + Apple Silicon 各一台；明/暗模式；外接显示器（宠物窗停靠）；中文/带空格/iCloud 路径的文件

## 三、风险与工作量总览

| 阶段 | 改动量 | 产出 | 风险 |
|---|---|---|---|
| Phase 0 | 0 | 可用性实测记录 | 低 |
| Phase 1 | 纯配置 | 双架构 dmg/zip 安装包 | 低（构建网络依赖） |
| Phase 2 | ~30-50 行代码 | 体验与 Windows 对齐 | 低（均为局部小改） |
| Phase 3 | 运维为主 | 可分发、可更新 | 签名费用/流程是主要门槛 |

**一句话结论**：代码底子是跨平台的，零改动就能在 mac 上跑通主流程；
先做 Phase 0 验证 + Phase 1 打包配置（都不是代码），真正需要动代码的只有
红绿灯避让、open-file 事件、Cmd 快捷键三件小事，合计不到 50 行。
