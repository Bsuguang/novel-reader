import React, { useEffect } from 'react';
import { useStore } from '../store/useStore';

/**
 * 底部固定翻章导航条：
 *   「上一章 ｜ 第 X 章 / 共 N 章 + 全书进度% + 本章剩余约 X 分钟 ｜ 下一章」
 *   + 自动滚屏开关与速度调节 + 当前章标题居中。
 * 首章「上一章」disabled、末章「下一章」disabled。
 * 键盘：← / PageUp -> 上一章；→ / PageDown -> 下一章（输入框聚焦时忽略）。
 */
export default function ChapterNav() {
  const chapters = useStore((s) => s.chapters);
  const currentChapter = useStore((s) => s.currentChapter);
  const nextChapter = useStore((s) => s.nextChapter);
  const prevChapter = useStore((s) => s.prevChapter);
  const rawText = useStore((s) => s.rawText);
  const chapterParagraphs = useStore((s) => s.chapterParagraphs);
  const currentParagraph = useStore((s) => s.currentParagraph);
  const autoScroll = useStore((s) => s.autoScroll);
  const setAutoScroll = useStore((s) => s.setAutoScroll);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);

  useEffect(() => {
    const onKey = (e) => {
      // 焦点在输入框/文本域时忽略，避免与搜索框等冲突
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        prevChapter();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        nextChapter();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prevChapter, nextChapter]);

  const total = chapters.length;
  const idx = currentChapter;
  const title = idx >= 0 && chapters[idx] ? chapters[idx].title : '';
  const atFirst = idx <= 0;
  const atLast = idx >= total - 1;

  // 全书进度%：当前段全局偏移 / 全文长度
  const para = chapterParagraphs[currentParagraph];
  const charPos = para ? para.charStart : 0;
  const percent = rawText.length ? Math.min(100, (charPos / rawText.length) * 100) : 0;

  // 本章剩余预计阅读时间（按中文 ~500 字/分钟估算，含标点）
  const ch = idx >= 0 ? chapters[idx] : null;
  const chEnd = ch
    ? idx + 1 < chapters.length
      ? chapters[idx + 1].startChar
      : rawText.length
    : 0;
  const remainMin = Math.max(0, Math.round((chEnd - charPos) / 500));

  return (
    <div className="chapter-nav">
      <button className="nav-btn" onClick={prevChapter} disabled={atFirst}>
        ← 上一章
      </button>
      <button
        className={'nav-btn auto-btn' + (autoScroll ? ' on' : '')}
        onClick={() => setAutoScroll(!autoScroll)}
        title="自动滚屏（滚到底自动读下一章）"
      >
        {autoScroll ? '⏸ 停止滚动' : '▶ 自动滚动'}
      </button>
      <div className="nav-info">
        <span className="nav-count">
          第 {idx + 1} 章 / 共 {total} 章 · 已读 {percent.toFixed(1)}% · 本章剩余约{' '}
          {remainMin} 分钟
        </span>
        {autoScroll && (
          <span className="nav-speed">
            速度
            <input
              type="range"
              min="0.5"
              max="5"
              step="0.5"
              value={settings.autoScrollSpeed}
              onChange={(e) => updateSettings({ autoScrollSpeed: Number(e.target.value) })}
            />
            <span>{settings.autoScrollSpeed}x</span>
          </span>
        )}
        <span className="nav-title" title={title}>
          {title}
        </span>
      </div>
      <button className="nav-btn" onClick={nextChapter} disabled={atLast}>
        下一章 →
      </button>
    </div>
  );
}
