import React, { useState } from 'react';
import { useStore } from '../store/useStore';

export default function FileImport() {
  const openFile = useStore((s) => s.openFile);
  const openFileAt = useStore((s) => s.openFileAt);
  const [drag, setDrag] = useState(false);

  return (
    <div
      className={'dropzone' + (drag ? ' drag' : '')}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        // 优先直接读取拖入文件的真实路径（Electron 在 File 对象上暴露 path），
        // 不再退化为弹文件对话框；没有路径（异常环境）时才回退
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        const p = f && f.path;
        if (p && /\.(txt|md)$/i.test(p)) {
          openFileAt(p);
        } else if (p) {
          alert('仅支持 .txt / .md 文件');
        } else {
          openFile();
        }
      }}
    >
      <div style={{ fontSize: 40 }}>📖</div>
      <div>把 TXT / MD 文件拖到这里，或</div>
      <button onClick={openFile} style={{ padding: '8px 16px' }}>
        选择文件打开
      </button>
    </div>
  );
}
