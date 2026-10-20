import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { findChapterByCharPos } from '../lib/text';

export default function SearchBar() {
  const setSearch = useStore((s) => s.setSearch);
  const results = useStore((s) => s.searchResults);
  const query = useStore((s) => s.searchQuery);
  const searchIndex = useStore((s) => s.searchIndex);
  const toggle = useStore((s) => s.toggleSearch);
  const gotoPosition = useStore((s) => s.gotoPosition);
  const gotoSearchResult = useStore((s) => s.gotoSearchResult);
  const chapters = useStore((s) => s.chapters);
  const [text, setText] = useState(query);
  const timerRef = useRef(null);

  // 300ms 防抖：大文件（10MB+）全文扫描不应每个键击都执行
  const onChange = (v) => {
    setText(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSearch(v), 300);
  };
  useEffect(() => () => timerRef.current && clearTimeout(timerRef.current), []);

  // 每个命中所属章标题（二分查找，结果数量有上限，直接 map 开销可控）
  const chapterOf = useMemo(() => {
    if (!chapters.length) return () => '';
    return (pos) => {
      const ci = findChapterByCharPos(chapters, pos);
      return ci >= 0 && chapters[ci] ? chapters[ci].title : '';
    };
  }, [chapters]);

  return (
    <div className="panel">
      <button className="close-x" onClick={() => toggle(false)}>
        ✕
      </button>
      <h3>全文搜索</h3>
      <input
        className="search-input"
        placeholder="输入关键词…（Enter 立即搜索）"
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            if (timerRef.current) clearTimeout(timerRef.current);
            setSearch(text);
          }
        }}
        autoFocus
      />
      <div className="search-meta">
        <span style={{ fontSize: 12, color: '#999' }}>共 {results.length} 处</span>
        <span className="search-nav">
          <button
            onClick={() => gotoSearchResult(-1)}
            disabled={!results.length}
            title="上一处"
          >
            ↑ 上一处
          </button>
          <span style={{ fontSize: 12, color: '#999' }}>
            {results.length ? `${searchIndex + 1} / ${results.length}` : ''}
          </span>
          <button
            onClick={() => gotoSearchResult(1)}
            disabled={!results.length}
            title="下一处"
          >
            ↓ 下一处
          </button>
        </span>
      </div>
      <div>
        {results.map((r, i) => (
          <div
            key={i}
            className={'search-result' + (i === searchIndex ? ' current' : '')}
            onClick={() => gotoPosition(r.position)}
          >
            <span className="pos">#{i + 1}</span>{' '}
            <span className="chapter">{chapterOf(r.position)}</span>
            <div className="snippet">…{r.snippet.replace(/\n/g, ' ')}…</div>
          </div>
        ))}
      </div>
    </div>
  );
}
