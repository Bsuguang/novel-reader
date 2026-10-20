import React from 'react';
import { useStore } from '../store/useStore';

export default function TitleBar() {
  const openFile = useStore((s) => s.openFile);
  const fileName = useStore((s) => s.fileName);
  const filePath = useStore((s) => s.filePath);
  const chapters = useStore((s) => s.chapters);
  const toggleToc = useStore((s) => s.toggleToc);
  const toggleSearch = useStore((s) => s.toggleSearch);
  const toggleSettings = useStore((s) => s.toggleSettings);
  const toggleLibrary = useStore((s) => s.toggleLibrary);
  const toggleBookmarks = useStore((s) => s.toggleBookmarks);
  const toggleTtsBar = useStore((s) => s.toggleTtsBar);
  const bookmarks = useStore((s) => s.bookmarks);
  const bmCount = filePath && bookmarks[filePath] ? bookmarks[filePath].length : 0;

  return (
    <div className={'titlebar' + (window.api.platform === 'darwin' ? ' mac' : '')}>
      <button onClick={openFile}>打开</button>
      <button onClick={() => toggleLibrary()}>书架</button>
      <button onClick={() => toggleToc()} disabled={!filePath || chapters.length === 0}>
        目录
      </button>
      <button onClick={() => toggleSearch()} disabled={!filePath}>
        搜索
      </button>
      <button onClick={() => toggleBookmarks()} disabled={!filePath}>
        书签{bmCount ? `(${bmCount})` : ''}
      </button>
      <button onClick={() => toggleTtsBar()} disabled={!filePath}>
        朗读
      </button>
      <button onClick={() => toggleSettings()}>设置</button>
      <span className="title">
        {filePath ? `${fileName}（共 ${chapters.length} 章）` : '小说阅读器'}
      </span>
    </div>
  );
}
