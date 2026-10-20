# 增量架构设计：novel-reader 按章懒加载与章节导航

> 聚焦增量变更。基于现有实现（`Electron + React 18 + Zustand 4 + Webpack`，无新增依赖）做架构改造。
> 目标：大文件首屏 DOM 由「全书段落」降为「仅当前章段落」+「上一章 / 下一章」导航。

---

## 1. 实现方案概述 + 框架选型

- **技术栈沿用**：Electron + React 18 + Zustand 4 + Webpack，**无新增依赖、无配置变更**（`package.json` / `webpack.config.js` / `preload.js` / `main.js` 均不动）。
- **核心思路**：把「打开即全量切段」改为「按章按需切片」。
  - `rawText`（归一化全文，LF）常驻 store；新增 `chapterParagraphs` 仅保存**当前章**段落。
  - 每段仍保留**全局 `charStart`**（即在 `rawText` 中的字符偏移），与 `search.js`、书签 `charPos`、进度 `charPos`、TTS 高亮共用同一坐标系 —— 这是消除兼容性风险的关键。
- **全局偏移 ↔ (章, 章内段) 映射**统一封装在新增的 `src/lib/text.js`，所有跨章定位（搜索、书签、续读、TTS）都经此工具，避免散落各处。
- **架构模式**：维持现有「单一 Zustand store + 受控组件」模式，不做状态库替换。新增一个纯展示型底部组件 `ChapterNav`。

---

## 2. 文件清单（相对路径，标注 修改/新增）

| 文件 | 状态 | 说明 |
|------|------|------|
| `src/lib/text.js` | **新增** | `splitChapterByRange` / `findChapterByCharPos` / `localIndexByCharPos` |
| `src/lib/chapter.js` | **修改** | `parseChapters` 结果为每个 chapter 预计算 `startChar`（首行全局字符偏移），供二分定位章 |
| `src/store/useStore.js` | **修改** | 移除 `paragraphs`；新增 `chapterParagraphs` / `loadingChapter` / `pendingScroll`；新增 `loadChapter` / `nextChapter` / `prevChapter` / `gotoPosition`；改造 `loadFile` / `saveProgress` / `addBookmark` / `jumpToBookmark` |
| `src/components/Reader.jsx` | **修改** | 仅渲染 `chapterParagraphs`；`pendingScroll` 滚动；`requestScroll` 路由到 `loadChapter`/`gotoPosition`；TTS 高亮按 `charStart` 匹配；顶部/底部显示当前章标题 |
| `src/components/ChapterNav.jsx` | **新增** | 底部固定翻章条「上一章 ｜ 第X章/共N章 ｜ 下一章」+ 当前章标题 + 键盘快捷键 |
| `src/components/ChapterTOC.jsx` | **修改** | 点击 → `loadChapter(c.index)`（维持 `currentChapter` 高亮） |
| `src/components/SearchBar.jsx` | **修改** | 点击结果 → `gotoPosition(r.position)` |
| `src/components/BookmarkPanel.jsx` | **微调/说明** | 经 `store.jumpToBookmark → gotoPosition`，通常无需改；保留以说明链路 |
| `src/components/TtsBar.jsx` | **修改** | 数据源改为 `chapterParagraphs`；章末自动 `loadChapter(next)` 续读；`tts.current` 语义改为全局 `charStart` |
| `src/App.jsx` | **修改** | 有 `filePath` 时挂载 `<ChapterNav />` |
| `src/styles/index.css` | **修改** | `.chapter-nav` 底部固定条样式（按钮 / 禁用态 / 标题省略） |
| `test/lib.test.js` | **修改/新增** | 为 `splitChapterByRange` / `findChapterByCharPos` / `localIndexByCharPos` 补单测 |

---

## 3. 数据结构与接口变更

### 3.1 State 字段变更（`useStore`）

**移除**
- `paragraphs: []` —— 不再全量构建。

**新增**
- `chapterParagraphs: []` —— 当前章段落数组，元素形状 `{ text, startLine, charStart }`，其中 `charStart` 为**全局**字符偏移（与旧 `paragraphs` 同坐标系，保证搜索/书签/进度兼容）。
- `loadingChapter: false` —— 加载章时的瞬时态（预留；当前同步计算，可仅作占位/未来异步预取）。
- `pendingScroll: null` —— 加载章后需要在渲染完成执行的滚动意图：`'top'`（置顶）或 `number`（全局 charPos，定位到章内段）。由 `Reader` 消费后清零。

**保留但语义调整**
- `currentChapter: -1` —— 当前章索引；`-1` 表示尚未加载任何章。
- `currentParagraph: 0` —— 含义不变，但现在是**当前章内的局部索引**（0-based）。
- `tts.current: -1` —— 语义由「全书段索引」改为「当前播放段的**全局 charStart**」（用 `charStart` 便于跨章映射与高亮），`-1` 表示未播放。
- `progress[path]` —— 由 `{ ratio }` 改为 `{ chapter: number, charPos: number }`（全局 charStart）；旧 `{ratio}` 在加载时按「无续读（第 0 章顶部）」处理（见 §8）。

### 3.2 新增 Action 签名

```js
// 加载指定章；index 越界（<0 或 >= chapters.length）为 no-op
// charPos: 可选全局 charStart，用于续读/跳转后定位到章内段；缺省置顶
loadChapter(index, charPos = null) => void

// 下一章 / 上一章：在 [0, chapters.length-1] 内 clamp，到边界 no-op
nextChapter() => void
prevChapter() => void

// 全局 charPos -> 定位所属章并 loadChapter（搜索结果、书签跳转共用）
gotoPosition(charPos: number) => void

// 内部：写入 progress[path] = { chapter, charPos } 并持久化
saveProgressInternal(chapter, charPos) => void

// 公开：滚动时由 Reader 调用，依据 currentChapter + currentParagraph 计算全局 charPos 后保存
saveProgress() => void

// 清零 pendingScroll（Reader 消费后调用）
clearPendingScroll() => void
```

### 3.3 改造的 Action

- `loadFile(file)`：不再 `processText` 全量切段；改为 `parseChapters` 得 `chapters`（含 `startChar`）→ 存 `rawText` 归一化全文；据 `progress[path]` 决定 `resumeChapter`/`resumeCharPos`（缺省 `{0,0}`）；最后 `loadChapter(resumeChapter, resumeCharPos)`。不再产生 `scrollRequest: {type:'ratio'}`。
- `saveProgress()`（无参）：读取 `currentChapter`、`currentParagraph`、`chapterParagraphs`，取 `chapterParagraphs[currentParagraph]?.charStart` 作为全局 `charPos`，调用 `saveProgressInternal`。
- `addBookmark(note)`：`charPos` 取自 `chapterParagraphs[currentParagraph]?.charStart`（全局）；`chapter` 取自 `currentChapter`。
- `jumpToBookmark(bm)`：改为 `gotoPosition(bm.charPos)`（由 `gotoPosition` 内部 `findChapterByCharPos` 还原章并定位），不再手动 `setCurrentChapter` + `requestScroll`。

### 3.4 新增工具 `src/lib/text.js`

```js
// 仅切当前章为段落；charStart 为 rawText 全局偏移（与 search 偏移同坐标系）
splitChapterByRange(rawText, chapter) => Array<{ text, startLine, charStart }>

// 全局 charPos -> 所属章索引（基于 chapters[].startChar 二分，O(log n)）
findChapterByCharPos(chapters, charPos) => number  // -1 表示未命中

// 章内全局 charPos -> 局部段索引（章内 charStart 升序，最大 <= charPos）
localIndexByCharPos(paragraphs, charPos) => number
```

### 3.5 `chapter.js` 变更

`parseChapters` 在产出 `chapters` 时，额外为每个 chapter 计算 `startChar`（首行 `lineIndex` 在 `rawText` 中的全局字符偏移 = 前 `lineIndex` 行长度之和 + 换行符）。`findChapterByCharPos` 依赖该字段做二分。

---

## 4. 程序调用流程（关键路径）

> 完整时序图见 `docs/sequence-diagram.mermaid`（含 loadFile 续读、翻章、搜索/书签跳转、TOC 点击、TTS 跨章续读）。

**A. loadFile 初始化 + 续读**
1. `loadFile` → `parseChapters` 得 `chapters`（含 `startChar`）；`rawText = normalize(content)`。
2. 读取 `progress[path] = {chapter, charPos}`（缺省第 0 章、charPos 0）。
3. `loadChapter(chapter, charPos)` → `splitChapterByRange` 生成 `chapterParagraphs`（全局 charStart）→ `set({currentChapter, chapterParagraphs, pendingScroll: charPos|'top'})` → `saveProgressInternal`。
4. `Reader` 的 `useEffect[chapterParagraphs]` 触发 `handlePendingScroll`：`pendingScroll==='top'` 置顶；为数字则 `localIndexByCharPos` → `scrollToParagraph(localIndex)`；随后 `clearPendingScroll()`。

**B. 翻章（底部按钮 / 键盘）**
- `nextChapter()`/`prevChapter()` → clamp 出 `idx` → `loadChapter(idx)`（`pendingScroll:'top'`）→ `Reader` 置顶。
- `ChapterNav` 键盘：监听 `keydown`，`←`/`PageUp` → `prevChapter()`，`→`/`PageDown` → `nextChapter()`；输入框聚焦时忽略。

**C. 搜索结果 / 书签跳转（全局 charPos）**
- `gotoPosition(charPos)` → `findChapterByCharPos(chapters, charPos)` 得章 → `loadChapter(ci, charPos)` → `Reader` 在加载后的章内按 `localIndexByCharPos` 定位并滚动；TOC 高亮随 `currentChapter` 自动更新。

**D. TOC 点击**
- `ChapterTOC` 点击 → `loadChapter(c.index)`（`pendingScroll:'top'`）→ `Reader` 置顶；高亮随 `currentChapter` 更新。

**E. TTS 懒加载下跨章续读**
- `play()` 从 `currentChapter` 的 `chapterParagraphs` 起 `buildQueue`；每句朗读 `setTts({current: 全局 charStart})`，`Reader` 高亮 `charStart===tts.current` 的段。
- 队列耗尽且 `currentChapter < last`：`nextChapter()` 加载下一章 → `Reader` 更新 `chapterParagraphs` → `TtsBar` 以新章 `buildQueue(0)` 续读；否则停止并 `setTts({playing:false, current:-1})`。

---

## 5. 任务列表（有序、含依赖、按实现顺序）

> 规则：不超过 5 项；每项 ≥3 相关文件；按模块/层次分组；T01 为所有上层依赖的基础层，T02–T04 可并行，T05 收尾。

### T01 — 按章切片工具与状态机核心（基础层）【P0，依赖：无】
- **做什么**：落地 `src/lib/text.js` 三个映射函数；`chapter.js` 预计算 `startChar`；重写 `useStore`：移除 `paragraphs`，引入 `chapterParagraphs`/`loadingChapter`/`pendingScroll`，实现 `loadChapter`/`nextChapter`/`prevChapter`/`gotoPosition`/`saveProgressInternal`/`clearPendingScroll`，改造 `loadFile`/`saveProgress`/`addBookmark`/`jumpToBookmark`。
- **涉及文件**：`src/lib/text.js`（新增）、`src/lib/chapter.js`（修改）、`src/store/useStore.js`（修改）。
- **验收点**：① 大文件 `loadFile` 不再构建全书 `paragraphs`，内存/首屏显著下降；② `loadChapter(idx)` 产出的 `chapterParagraphs` 各段 `charStart` 与旧全量切分一致（可单测比对）；③ 越界 `loadChapter` 为 no-op；④ `next`/`prev` 在首/末章 clamp；⑤ 进度模型为 `{chapter,charPos}`，旧 `{ratio}` 按第 0 章顶部处理。

### T02 — Reader 渲染当前章 + 底部翻章导航（UI 层）【P0，依赖：T01】
- **做什么**：`Reader` 仅渲染 `chapterParagraphs`；新增 `pendingScroll` 消费效果（top / 全局 charPos 定位）；`requestScroll` 的 `chapter`/`position` 类型路由到 `loadChapter`/`gotoPosition`；TTS 高亮改为按 `charStart` 匹配；顶部/底部展示 `chapters[currentChapter].title`。新增 `ChapterNav`（底部固定条 + 键盘快捷键），在 `App` 中挂载。
- **涉及文件**：`src/components/Reader.jsx`（修改）、`src/components/ChapterNav.jsx`（新增）、`src/App.jsx`（修改）。
- **验收点**：① 首屏 DOM 仅当前章段落（DevTools 元素数 ≈ 单章段落数）；② 翻章按钮 / `←`/`→`/`PageUp`/`PageDown` 可切换章并置顶；③ 首章「上一章」、末章「下一章」禁用；④ TTS 高亮跟随当前播放段；⑤ 当前章标题正确显示。

### T03 — TOC / 搜索 / 书签 接入按章导航（接入层）【P1，依赖：T01】
- **做什么**：`ChapterTOC` 点击改调 `loadChapter(c.index)`；`SearchBar` 结果点击改调 `gotoPosition(r.position)`；`jumpToBookmark` 改走 `gotoPosition`；确保 `addBookmark` 的 `charPos` 取自 `chapterParagraphs[currentParagraph].charStart`。
- **涉及文件**：`src/components/ChapterTOC.jsx`（修改）、`src/components/SearchBar.jsx`（修改）、`src/store/useStore.js`（修改：跳转/书签读路径 action）、`src/components/BookmarkPanel.jsx`（说明性微调，通常无需改）。
- **验收点**：① 目录点击切章并高亮对应项；② 全文搜索结果跨章点击正确加载目标章并滚动到命中段；③ 书签跳转恢复「章 + 章内位置」，标签沿用章标题。

### T04 — TTS 懒加载适配（朗读层）【P1，依赖：T01，建议与 T02 同步】
- **做什么**：`TtsBar` 数据源由 `paragraphs` 改为 `chapterParagraphs`；`buildQueue` 从当前章起，章末自动 `loadChapter(next)` 续读（通过 `useEffect` 监听 `chapterParagraphs` 衔接队列）；`tts.current` 存全局 `charStart`；状态文案改为「第X章·第Y段」。
- **涉及文件**：`src/components/TtsBar.jsx`（修改）、`src/lib/text.js`（复用 `localIndexByCharPos`）、`src/store/useStore.js`（修改：`tts.current` 语义、TTS 播放中切章衔接）。
- **验收点**：① 朗读仅当前章内容，章末自动续读下一章且不断档；② 高亮随当前播放段（全局 charStart → 本地匹配）；③ 手动翻章时 TTS 行为可预期（建议：手动翻章保持 TTS 在其原章播放，或显式停止——本设计选「继续播放原章队列，跨章后自然衔接」，高亮仅在显示章匹配时显示）。

### T05 — 样式与集成回归（收尾层）【P1/P2，依赖：T02,T03,T04】
- **做什么**：为 `ChapterNav` 增加 `.chapter-nav` 样式（底部固定、按钮禁用态、章标题单行省略）；在大型 txt 上完整走查首屏仅当前章、翻章/快捷键、续读、全文搜索跳转、书签、TTS；为 `text.js` 映射函数补充单测，确保 `npm run build` 通过。
- **涉及文件**：`src/styles/index.css`（修改）、`test/lib.test.js`（修改/新增）、`src/App.jsx`（集成校验点）。
- **验收点**：① 大文件首屏轻量、翻章流畅无白屏；② 续读精确到章内段；③ 搜索/书签/目录/TTS 全链路正确；④ 打包与单测通过。

---

## 6. 依赖包列表

**无新增依赖。** 沿用 `react@^18.2.0`、`react-dom@^18.2.0`、`zustand@^4.5.0`；构建链（`webpack` / `babel` / `electron`）不变。

---

## 7. 共享约定（跨模块必须统一）

- **全局 charStart 是唯一偏移坐标系**：`chapterParagraphs` 每段的 `charStart` 必须是其在 `rawText`（归一化 LF）中的全局字符偏移，与 `search.js` 返回的 `position`、`addBookmark` 的 `charPos`、`progress.charPos`、`tts.current` 完全同坐标系。
- **映射工具唯一出处**：`src/lib/text.js`（`splitChapterByRange` / `findChapterByCharPos` / `localIndexByCharPos`）。任何组件/action 需要「全局偏移 ↔ (章, 章内段)」时**必须**调用这三个函数，禁止在组件内自行换算。
- **章归属判定**：依赖 `chapter.startChar`（首行全局偏移），`findChapterByCharPos` 用二分；保证与搜索/书签偏移一致。
- **滚动意图传递**：跨章定位一律经 `loadChapter(index, charPos)` 设置 `pendingScroll`，由 `Reader` 在渲染完成后消费并清零，避免「先切章再滚动」的竞态。
- **边界规则**：`loadChapter` 越界 no-op；首章无上一章、末章无下一章（UI 禁用 + action clamp）。
- **搜索高亮**：保留 `searchQuery`，但因只渲染当前章，高亮自然只出现在当前章（无需手动清除 `searchQuery`）。

---

## 8. 待明确事项（如仍有）

1. **旧进度迁移**：现有 `progress[path] = {ratio}` 与新的 `{chapter,charPos}` 不兼容。本设计默认「旧格式按无续读（第 0 章顶部）处理」。若需尽量保留旧用户的阅读位置，可在 `loadFile` 增加 `ratio→近似章` 的换算（按 `chapters[].startChar` 比例估算章），但精度有限——**建议直接重置**，请在评审时确认。
2. **TTS 跨章续读 vs 严格按章**：用户决策 (d) 明确「不自动滚动越界切章（靠按钮导航）」，但那是针对**阅读滚动**；TTS 章末自动续读属于朗读行为，本设计按 PRD 建议「章末自动 `loadChapter(next)` 续读」。若希望 TTS 也严格不自动翻章（章末停止并提示），可在 T04 改为停止。请在评审时确认 TTS 跨章策略。
3. **`loadingChapter` 用途**：当前 `splitChapterByRange` 为同步计算，该字段仅占位。若后续做 P2-1 预取相邻章，可在此处驱动骨架/预取，本次不实现。
4. **超大单章（无章节标题的小说）**：若文件无章节标题，`chapters` 为空，`loadChapter` 无章可载。建议兜底：无章节时回退为「整本即一章」（在 `parseChapters` 后若 `chapters.length===0` 则构造一个包裹全本的伪章）。本设计默认仍按现有 `parseChapters` 行为（可能 chapters 为空导致无内容），**建议在 T01 增加该兜底**。请确认是否纳入本期。

---

> 附：类图 `docs/class-diagram.mermaid`，时序图 `docs/sequence-diagram.mermaid`。
