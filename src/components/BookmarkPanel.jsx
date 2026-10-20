import React, { useState } from 'react';
import { useStore } from '../store/useStore';

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function BookmarkPanel() {
  const filePath = useStore((s) => s.filePath);
  const fileName = useStore((s) => s.fileName);
  const bookmarks = useStore((s) => s.bookmarks);
  const rawText = useStore((s) => s.rawText);
  const addBookmark = useStore((s) => s.addBookmark);
  const removeBookmark = useStore((s) => s.removeBookmark);
  const jumpToBookmark = useStore((s) => s.jumpToBookmark);
  const toggle = useStore((s) => s.toggleBookmarks);

  const list = (filePath && bookmarks[filePath]) || [];
  const [note, setNote] = useState('');
  const [exportMsg, setExportMsg] = useState('');

  const onAdd = () => {
    addBookmark(note);
    setNote('');
  };

  // 摘录：书签位置起 40 字符（原文为空时降级无摘录）
  const snippetOf = (bm) => {
    if (!rawText) return '';
    const s = rawText.slice(bm.charPos, bm.charPos + 40);
    return s.replace(/\s+/g, ' ').trim();
  };

  // 导出书签/笔记为 Markdown（主进程弹保存对话框）
  const onExport = async () => {
    if (!list.length) return;
    const lines = [`# 《${fileName || '未命名'}》 书签与笔记`, ''];
    list.forEach((b, i) => {
      lines.push(`## ${i + 1}. ${b.label}`);
      lines.push(`- 位置：charPos ${b.charPos}`);
      const snip = snippetOf(b);
      if (snip) lines.push(`- 摘录：${snip}…`);
      if (b.note) lines.push(`- 笔记：${b.note}`);
      if (b.createdAt) lines.push(`- 时间：${formatDate(b.createdAt)}`);
      lines.push('');
    });
    const res = await window.api.saveTextFile({
      defaultPath: (fileName || '书签') + '-笔记.md',
      content: lines.join('\n'),
    });
    if (res && res.path) setExportMsg('已导出：' + res.path);
    else if (res && res.error) setExportMsg('导出失败：' + res.error);
    else setExportMsg('');
  };

  return (
    <div className="panel">
      <button className="close-x" onClick={() => toggle(false)}>
        ✕
      </button>
      <h3>书签 · 笔记</h3>
      <div className="field">
        <label>为当前阅读位置添加书签（{fileName || '未打开书籍'}）</label>
        <textarea
          className="note-input"
          placeholder="（可选）写点笔记…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
        />
        <button className="wide-btn" onClick={onAdd} disabled={!filePath}>
          ＋ 添加书签
        </button>
      </div>

      {list.length > 0 && (
        <div className="field">
          <button className="wide-btn export-btn" onClick={onExport}>
            ⬇ 导出书签/笔记为 Markdown
          </button>
          {exportMsg && <div className="export-msg">{exportMsg}</div>}
        </div>
      )}

      {list.length === 0 ? (
        <div className="empty">还没有书签。</div>
      ) : (
        <div className="bookmark-list">
          {list.map((b) => (
            <div key={b.id} className="bookmark-item">
              <div className="bm-main" onClick={() => jumpToBookmark(b)} title="点击跳转到此处">
                <div className="bm-label">{b.label}</div>
                {snippetOf(b) && <div className="bm-snippet">…{snippetOf(b)}…</div>}
                {b.note ? <div className="bm-note">{b.note}</div> : null}
              </div>
              <button
                className="bm-del"
                onClick={(e) => {
                  e.stopPropagation();
                  removeBookmark(b.id);
                }}
              >
                删除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
