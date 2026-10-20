import { create } from 'zustand';
import { parseChapters } from '../lib/chapter';
import { search } from '../lib/search';
import { splitChapterByRange, findChapterByCharPos } from '../lib/text';

const api = window.api;

// 全文行缓存（模块级，不进 React 状态）：parseChapters 已切好行，
// 翻章切段直接复用，避免每次对全文 split（大文件下 O(N) -> O(章长)）。
let cachedLines = [];

// 阅读时长累计（模块级）：每秒 +1，每 15s 合并进状态并持久化一次，避免每秒触发渲染/IPC
const rtAccum = {};
let rtLastFlush = Date.now();

const DEFAULT_SETTINGS = {
  fontSize: 18,
  fontFamily: '"Noto Serif CJK SC", "Songti SC", "SimSun", serif',
  lineHeight: 1.8,
  paraSpacing: 0.8,
  padding: 48,
  bg: '#ffffff',
  text: '#1f1f1f',
  theme: 'default',
  autoScrollSpeed: 1, // 自动滚屏速度：px/帧（约 60fps）
  pet: 'cat', // 桌面宠物：cat / dog / rabbit / panda / fox / chick
};

export const useStore = create((set, get) => ({
  filePath: null,
  fileName: '',
  encoding: '',
  rawText: '',
  // paragraphs（全量）已移除：改为按需按章切段的 chapterParagraphs
  chapterParagraphs: [], // 当前章段落：{ text, startLine, charStart }，charStart 为全局偏移
  chapters: [],
  tocOpen: false,
  settingsOpen: false,
  searchOpen: false,
  searchQuery: '',
  searchResults: [],
  searchIndex: 0,
  currentChapter: -1, // 当前章索引；-1 表示尚未加载任何章
  currentParagraph: 0, // 当前章内的局部段落索引（0-based）
  loadingChapter: false, // 加载章瞬时态（预留：当前为同步计算，仅占位）
  pendingScroll: null, // 加载章后需执行的滚动意图：'top' | 数字(全局 charPos) | null
  settings: { ...DEFAULT_SETTINGS },
  progress: {}, // { [path]: { chapter, charPos, ratio } }，ratio 为全书进度 0-1
  recent: [], // 书架：已打开过的书籍（去重、最近在前，含 lastOpenedAt）
  bookmarks: {}, // 书签：{ [path]: [ {id,label,note,chapter,charPos,createdAt} ] }
  readingTime: {}, // { [path]: 秒 } 累计阅读时长
  libraryOpen: false,
  bookmarksOpen: false,
  ttsBarOpen: false,
  ttsVoice: '', // 选中的朗读嗓音名（持久化）
  // tts.current 语义：当前播放段的「全局 charStart」（-1 表示未播放）
  tts: { playing: false, paused: false, rate: 1, current: -1 },
  autoScroll: false, // 自动滚屏开关（瞬态，不持久化；速度持久化在 settings）
  scrollRequest: null, // 兼容旧路由（组件现多直接调 loadChapter / gotoPosition）
  lastFile: '', // 上次打开的书路径，用于启动自动续读

  init: async () => {
    try {
      const cfg = await api.getConfig();
      set({
        settings: { ...DEFAULT_SETTINGS, ...(cfg.settings || {}) },
        progress: cfg.progress || {},
        recent: cfg.recent || [],
        bookmarks: cfg.bookmarks || {},
        readingTime: cfg.readingTime || {},
        lastFile: cfg.lastFile || '',
        tts: { ...get().tts, rate: cfg.ttsRate || 1 },
        ttsVoice: cfg.ttsVoice || '',
      });
    } catch (e) {
      /* 忽略：首次运行无配置 */
    }
  },

  // 真正加载逻辑（打开新文件 / 书架重开 共用）
  loadFile: (file) => {
    if (!file || file.error) {
      alert('打开失败：' + (file && file.error ? file.error : '未知错误'));
      return;
    }
    get().flushReadingTime(); // 切书前把上一本的时长落盘

    // md 文件按 Markdown 标题切章；txt 按常规章节正则
    const isMd = /\.md$/i.test(file.path || '');
    const { chapters: parsed, lines } = parseChapters(file.content, isMd);
    cachedLines = lines;
    const rawText = lines.join('\n'); // 归一化 LF 全文（与 startChar/charStart 同一坐标系）

    // 无章节兜底：整本当作一个伪章，避免无标题文件导致无内容
    const chapters =
      parsed.length > 0
        ? parsed
        : [
            {
              index: 0,
              title: '全文',
              lineIndex: 0,
              startLine: 0,
              endLine: lines.length,
              startChar: 0,
            },
          ];

    const prev = get().progress[file.path] || {};
    set({
      filePath: file.path,
      fileName: file.name,
      encoding: file.encoding,
      rawText,
      chapters,
      currentChapter: -1,
      currentParagraph: 0,
      chapterParagraphs: [],
      loadingChapter: false,
      pendingScroll: null,
      searchOpen: false,
      searchResults: [],
      searchQuery: '',
      autoScroll: false,
      ttsBarOpen: false,
      tts: { playing: false, paused: false, rate: get().tts.rate, current: -1 },
      scrollRequest: null,
    });

    // 续读：优先新格式 {chapter,charPos}；旧格式 {ratio} 近似迁移（不硬重置）；
    // 否则从第 0 章顶部开始
    if (prev.chapter != null) {
      const idx = Math.min(Math.max(prev.chapter, 0), chapters.length - 1);
      get().loadChapter(idx, prev.charPos || 0);
    } else if (prev.ratio != null) {
      const charPos = Math.floor(prev.ratio * rawText.length);
      get().gotoPosition(charPos);
    } else {
      get().loadChapter(0);
    }

    const recent = [
      { path: file.path, name: file.name, lastOpenedAt: Date.now() },
      ...(get().recent || []).filter((r) => r.path !== file.path),
    ].slice(0, 50);
    set({ recent, lastFile: file.path });
    api.setConfig({ recent, lastFile: file.path });
  },

  openFile: async () => {
    const file = await api.openFile();
    if (!file) return;
    get().loadFile(file);
  },

  // 书架：按已记录路径重开（文件被移动/删除则提示；silent=true 时不弹窗，用于启动自动续读）
  openFileAt: async (p, silent = false) => {
    const file = await api.openFileAt(p);
    if (!file) {
      if (!silent) alert('无法打开该书：文件可能已被移动或删除');
      return;
    }
    get().loadFile(file);
  },

  removeFromLibrary: (p) => {
    const recent = (get().recent || []).filter((r) => r.path !== p);
    const bookmarks = { ...get().bookmarks };
    delete bookmarks[p];
    const progress = { ...get().progress };
    delete progress[p];
    const readingTime = { ...get().readingTime };
    delete readingTime[p];
    const patch = { recent, bookmarks, progress, readingTime };
    if (get().lastFile === p) patch.lastFile = ''; // 从书架移除后不再自动续读这本
    set(patch);
    api.setConfig(patch);
  },

  updateSettings: (patch) => {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    api.setConfig({ settings });
  },

  // 内部：写入 progress[path] = { chapter, charPos, ratio } 并持久化
  saveProgressInternal: (chapter, charPos) => {
    const p = get().filePath;
    if (!p) return;
    const ratio = get().rawText.length ? charPos / get().rawText.length : 0;
    const progress = { ...get().progress, [p]: { chapter, charPos, ratio } };
    set({ progress });
    api.setConfig({ progress });
  },

  // 公开：滚动时由 Reader 调用，依据 currentChapter + currentParagraph 计算全局 charPos 后保存
  saveProgress: () => {
    const p = get().filePath;
    if (!p) return;
    const { currentChapter, currentParagraph, chapterParagraphs } = get();
    const para = chapterParagraphs[currentParagraph];
    const charPos = para ? para.charStart : 0;
    get().saveProgressInternal(currentChapter, charPos);
  },

  // 阅读时长：每秒由 Reader 调用一次；每 15s 合并持久化
  tickReadingTime: () => {
    const p = get().filePath;
    if (!p || document.hidden) return;
    rtAccum[p] = (rtAccum[p] || 0) + 1;
    if (Date.now() - rtLastFlush >= 15000) get().flushReadingTime();
  },

  // 把累计的阅读时长合并进状态并持久化（切书 / 周期触发）
  flushReadingTime: () => {
    rtLastFlush = Date.now();
    const keys = Object.keys(rtAccum);
    if (!keys.length) return;
    const readingTime = { ...get().readingTime };
    for (const k of keys) readingTime[k] = (readingTime[k] || 0) + rtAccum[k];
    for (const k of keys) delete rtAccum[k];
    set({ readingTime });
    api.setConfig({ readingTime });
  },

  // 加载指定章；index 越界（<0 或 >= chapters.length）为 no-op
  // charPos: 可选全局 charStart，用于续读/跳转后定位到章内段；缺省置顶
  loadChapter: (index, charPos = null) => {
    const { chapters, rawText } = get();
    if (index < 0 || index >= chapters.length) return; // 越界 no-op
    const chapter = chapters[index];
    const paras = splitChapterByRange(rawText, chapter, cachedLines);
    set({
      currentChapter: index,
      chapterParagraphs: paras,
      currentParagraph: 0,
      loadingChapter: false,
      // 有 charPos 则定位到该段，否则置顶
      pendingScroll: charPos == null ? 'top' : charPos,
      tts: { ...get().tts, current: -1 }, // 切章时清除旧高亮（属于前一章）
    });
    const save = charPos == null ? 0 : charPos;
    get().saveProgressInternal(index, save);
  },

  // 下一章 / 上一章：在 [0, chapters.length-1] 内 clamp，到边界 no-op
  nextChapter: () => {
    const { currentChapter, chapters } = get();
    if (chapters.length === 0) return;
    const idx = currentChapter + 1;
    if (idx > chapters.length - 1) return; // 末章：no-op
    get().loadChapter(idx);
  },

  prevChapter: () => {
    const { currentChapter, chapters } = get();
    if (chapters.length === 0) return;
    const idx = currentChapter - 1;
    if (idx < 0) return; // 首章：no-op
    get().loadChapter(idx);
  },

  // 全局 charPos -> 定位所属章并 loadChapter（搜索结果、书签跳转共用）
  gotoPosition: (charPos) => {
    const { chapters } = get();
    if (!chapters.length) return;
    const ci = findChapterByCharPos(chapters, charPos);
    if (ci < 0) return;
    get().loadChapter(ci, charPos);
  },

  // 清零 pendingScroll（Reader 消费后调用）
  clearPendingScroll: () => {
    if (get().pendingScroll !== null) set({ pendingScroll: null });
  },

  // 搜索结果导航：上一处 / 下一处（循环）
  gotoSearchResult: (dir) => {
    const { searchResults, searchIndex } = get();
    if (!searchResults.length) return;
    const n = searchResults.length;
    const idx = (searchIndex + dir + n) % n;
    set({ searchIndex: idx });
    get().gotoPosition(searchResults[idx].position);
  },

  // 在当前阅读位置添加书签（可选备注）
  addBookmark: (note) => {
    const p = get().filePath;
    if (!p) return;
    const { chapterParagraphs, chapters, currentParagraph, currentChapter } = get();
    const para = chapterParagraphs[currentParagraph];
    const label =
      currentChapter >= 0 && chapters[currentChapter]
        ? chapters[currentChapter].title
        : '第 ' + (currentParagraph + 1) + ' 段';
    const bm = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      label,
      note: (note || '').trim(),
      chapter: currentChapter,
      charPos: para ? para.charStart : 0, // 全局 charStart
      createdAt: Date.now(),
    };
    const list = [...(get().bookmarks[p] || []), bm];
    const bookmarks = { ...get().bookmarks, [p]: list };
    set({ bookmarks });
    api.setConfig({ bookmarks });
  },

  removeBookmark: (id) => {
    const p = get().filePath;
    if (!p) return;
    const list = (get().bookmarks[p] || []).filter((b) => b.id !== id);
    const bookmarks = { ...get().bookmarks, [p]: list };
    set({ bookmarks });
    api.setConfig({ bookmarks });
  },

  // 书签跳转：统一走 gotoPosition，由其内部 findChapterByCharPos 还原章并定位
  jumpToBookmark: (bm) => {
    if (!bm) return;
    get().gotoPosition(bm.charPos);
  },

  setSearch: (query) => {
    const q = (query || '').trim();
    set({ searchQuery: q, searchIndex: 0 });
    if (!q) {
      set({ searchResults: [] });
      return;
    }
    set({ searchResults: search(get().rawText, q, { max: 500 }) });
  },

  // TTS 偏好持久化：语速 / 嗓音
  setTtsRate: (r) => {
    set({ tts: { ...get().tts, rate: r } });
    api.setConfig({ ttsRate: r });
  },
  setTtsVoice: (name) => {
    set({ ttsVoice: name });
    api.setConfig({ ttsVoice: name });
  },

  // 自动滚屏
  setAutoScroll: (v) => set({ autoScroll: !!v }),

  requestScroll: (req) => set({ scrollRequest: req }),
  setCurrentChapter: (i) => set({ currentChapter: i }),
  setCurrentParagraph: (i) => {
    if (get().currentParagraph !== i) set({ currentParagraph: i });
  },
  setTts: (patch) => set({ tts: { ...get().tts, ...patch } }),

  toggleToc: (v) => set((s) => ({ tocOpen: v !== undefined ? v : !s.tocOpen })),
  toggleSettings: (v) => set((s) => ({ settingsOpen: v !== undefined ? v : !s.settingsOpen })),
  toggleSearch: (v) =>
    set((s) => ({
      searchOpen: v !== undefined ? v : !s.searchOpen,
      searchResults: v ? s.searchResults : [],
    })),
  toggleLibrary: (v) => set((s) => ({ libraryOpen: v !== undefined ? v : !s.libraryOpen })),
  toggleBookmarks: (v) => set((s) => ({ bookmarksOpen: v !== undefined ? v : !s.bookmarksOpen })),
  toggleTtsBar: (v) => set((s) => ({ ttsBarOpen: v !== undefined ? v : !s.ttsBarOpen })),
}));
