import React, { useRef, useEffect, useState } from 'react';
import { useStore } from '../store/useStore';

// 定高虚拟滚动：数千章的目录只渲染可视区附近的条目，避免长列表卡顿。
// 行高须与 CSS .chapter-item 保持一致（44px，双行省略）。
const ROW = 44;
const OVERSCAN = 10;

export default function ChapterTOC() {
  const chapters = useStore((s) => s.chapters);
  const toggleToc = useStore((s) => s.toggleToc);
  const loadChapter = useStore((s) => s.loadChapter);
  const currentChapter = useStore((s) => s.currentChapter);

  const listRef = useRef(null);
  const [range, setRange] = useState({ start: 0, end: 50 });

  // 根据滚动位置计算需渲染的窗口（含上下 OVERSCAN 余量）
  const recompute = () => {
    const box = listRef.current;
    if (!box) return;
    const start = Math.max(0, Math.floor(box.scrollTop / ROW) - OVERSCAN);
    const end = Math.min(
      chapters.length,
      Math.ceil((box.scrollTop + box.clientHeight) / ROW) + OVERSCAN
    );
    setRange((r) => (r.start === start && r.end === end ? r : { start, end }));
  };

  // 打开目录（每次打开都重新挂载）或当前章变化时，把当前章滚到可视区中央。
  // 行高固定，直接按 index * ROW 计算目标位置，无需测量真实 DOM。
  useEffect(() => {
    const box = listRef.current;
    if (!box) return;
    if (currentChapter >= 0 && currentChapter < chapters.length) {
      box.scrollTop = Math.max(0, currentChapter * ROW - box.clientHeight / 2 + ROW / 2);
    } else {
      box.scrollTop = 0;
    }
    recompute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChapter, chapters.length]);

  const { start, end } = range;
  const slice = chapters.slice(start, end);

  return (
    <div className="sidebar">
      {/* 固定头部：不随列表滚动，「关闭」按钮始终可见可点 */}
      <div className="toc-header">
        <h3>目录（{chapters.length}）</h3>
        <button className="toc-close" onClick={() => toggleToc(false)}>关闭</button>
      </div>
      {/* 滚动容器：顶部占位 + 可视窗口条目 + 底部占位，撑出真实滚动高度 */}
      <div className="toc-list" ref={listRef} onScroll={recompute}>
        <div style={{ height: start * ROW }} />
        {slice.map((c) => (
          <div
            key={c.index}
            className={'chapter-item' + (c.index === currentChapter ? ' active' : '')}
            onClick={() => loadChapter(c.index)}
            title={c.title}
          >
            {c.title}
          </div>
        ))}
        <div style={{ height: (chapters.length - end) * ROW }} />
      </div>
    </div>
  );
}
