import React, { useEffect } from 'react';
import { useStore } from './store/useStore';
import TitleBar from './components/TitleBar';
import FileImport from './components/FileImport';
import Reader from './components/Reader';
import ChapterNav from './components/ChapterNav';
import ChapterTOC from './components/ChapterTOC';
import SettingsPanel from './components/SettingsPanel';
import SearchBar from './components/SearchBar';
import Library from './components/Library';
import BookmarkPanel from './components/BookmarkPanel';
import TtsBar from './components/TtsBar';

function getReaderScroll() {
  return document.querySelector('.reader-scroll');
}

export default function App() {
  const init = useStore((s) => s.init);
  const loadFile = useStore((s) => s.loadFile);
  const openFileAt = useStore((s) => s.openFileAt);
  const openFile = useStore((s) => s.openFile);
  const filePath = useStore((s) => s.filePath);
  const tocOpen = useStore((s) => s.tocOpen);
  const settingsOpen = useStore((s) => s.settingsOpen);
  const searchOpen = useStore((s) => s.searchOpen);
  const libraryOpen = useStore((s) => s.libraryOpen);
  const bookmarksOpen = useStore((s) => s.bookmarksOpen);
  const ttsBarOpen = useStore((s) => s.ttsBarOpen);
  const toggleSearch = useStore((s) => s.toggleSearch);
  const toggleSettings = useStore((s) => s.toggleSettings);
  const toggleLibrary = useStore((s) => s.toggleLibrary);
  const toggleBookmarks = useStore((s) => s.toggleBookmarks);
  const updateSettings = useStore((s) => s.updateSettings);

  useEffect(() => {
    let alive = true;
    (async () => {
      await init();
      if (!alive) return;
      // 1) 双击 .txt / 拖拽到 exe 启动：直接打开传入的书
      const sf = await window.api.getStartupFile();
      if (sf && !sf.error) {
        loadFile(sf);
        return;
      }
      // 2) 否则自动续读上次打开的书（文件丢失则静默回到首页）
      const last = useStore.getState().lastFile;
      if (last) await openFileAt(last, true);
    })();
    // macOS：应用运行中经 open-file 事件（双击 txt / 拖到 Dock 图标）打开书
    if (window.api.onOpenPath) {
      window.api.onOpenPath((p) => {
        if (p && alive) openFileAt(p);
      });
    }
    return () => {
      alive = false;
    };
  }, [init, loadFile, openFileAt]);

  // 全局快捷键（输入框聚焦时忽略）：
  //   Ctrl+F 搜索 / Ctrl+O 打开 / Esc 逐层关闭面板 / Space·↑·↓ 滚动阅读区
  //   + - 字号增减 / F11 全屏
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName) || '';
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      const key = e.key;
      // 全屏优先判断：Win 用 F11；mac 约定 Ctrl+Cmd+F（先于 Ctrl+F 判断，避免误触搜索）
      if (key === 'F11' || (e.ctrlKey && e.metaKey && (key === 'f' || key === 'F'))) {
        e.preventDefault();
        window.api.toggleFullscreen();
        return;
      }
      // mac 用 Cmd，Windows/Linux 用 Ctrl
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (key === 'f' || key === 'F')) {
        e.preventDefault();
        toggleSearch(true);
        return;
      }
      if (mod && (key === 'o' || key === 'O')) {
        e.preventDefault();
        openFile();
        return;
      }
      if (key === 'Escape' && !inInput) {
        // 逐层关闭：搜索 > 设置 > 书架 > 书签 > 目录
        const st = useStore.getState();
        if (st.searchOpen) st.toggleSearch(false);
        else if (st.settingsOpen) st.toggleSettings(false);
        else if (st.libraryOpen) st.toggleLibrary(false);
        else if (st.bookmarksOpen) st.toggleBookmarks(false);
        else if (st.tocOpen) st.toggleToc(false);
        return;
      }
      if (inInput) return;

      const el = getReaderScroll();
      if (!el) return;

      if (key === ' ' || key === 'Spacebar') {
        e.preventDefault();
        el.scrollBy({ top: el.clientHeight * 0.85, behavior: 'auto' });
      } else if (key === 'ArrowDown') {
        e.preventDefault();
        el.scrollBy({ top: 80, behavior: 'auto' });
      } else if (key === 'ArrowUp') {
        e.preventDefault();
        el.scrollBy({ top: -80, behavior: 'auto' });
      } else if (key === '+' || key === '=') {
        const s = useStore.getState().settings;
        updateSettings({ fontSize: Math.min(36, s.fontSize + 1) });
      } else if (key === '-') {
        const s = useStore.getState().settings;
        updateSettings({ fontSize: Math.max(12, s.fontSize - 1) });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleSearch, openFile, updateSettings]);

  return (
    <div className="app">
      <TitleBar />
      <div className="main">
        {!filePath && <FileImport />}
        {filePath && <Reader />}
        {filePath && <ChapterNav />}
        {tocOpen && <ChapterTOC />}
        {settingsOpen && <SettingsPanel />}
        {searchOpen && <SearchBar />}
        {libraryOpen && <Library />}
        {bookmarksOpen && filePath && <BookmarkPanel />}
        {ttsBarOpen && filePath && <TtsBar />}
      </div>
    </div>
  );
}
