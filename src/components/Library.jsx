import React from 'react';
import { useStore } from '../store/useStore';

function formatDuration(sec) {
  if (!sec || sec < 60) return sec ? Math.round(sec) + ' 秒' : '';
  const m = Math.floor(sec / 60);
  if (m < 60) return m + ' 分钟';
  return Math.floor(m / 60) + ' 小时 ' + (m % 60) + ' 分';
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Library() {
  const recent = useStore((s) => s.recent);
  const openFileAt = useStore((s) => s.openFileAt);
  const openFile = useStore((s) => s.openFile);
  const removeFromLibrary = useStore((s) => s.removeFromLibrary);
  const toggleLibrary = useStore((s) => s.toggleLibrary);
  const progress = useStore((s) => s.progress);
  const readingTime = useStore((s) => s.readingTime);

  return (
    <div className="panel library">
      <button className="close-x" onClick={() => toggleLibrary(false)}>
        ✕
      </button>
      <h3>我的书架</h3>
      <button className="wide-btn" onClick={openFile}>
        ＋ 打开本地 TXT / MD
      </button>

      {recent.length === 0 ? (
        <div className="empty">还没有书籍，点上面按钮添加一本吧。</div>
      ) : (
        <div className="book-list">
          {recent.map((b) => {
            const pr = progress[b.path];
            const pct = pr && pr.ratio != null ? Math.round(pr.ratio * 100) : null;
            const rt = formatDuration(readingTime && readingTime[b.path]);
            return (
              <div key={b.path} className="book-item">
                <div
                  className="book-main"
                  onClick={() => openFileAt(b.path)}
                  title={b.path}
                >
                  <div className="book-name">{b.name}</div>
                  <div className="book-path">{b.path}</div>
                  {(pct != null || rt || b.lastOpenedAt) && (
                    <div className="book-meta">
                      {pct != null && <span className="bm-tag">已读 {pct}%</span>}
                      {rt && <span>{rt}</span>}
                      {b.lastOpenedAt && <span>{formatDate(b.lastOpenedAt)}</span>}
                    </div>
                  )}
                </div>
                <button
                  className="book-del"
                  title="从书架移除"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromLibrary(b.path);
                  }}
                >
                  删除
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
