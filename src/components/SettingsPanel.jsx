import React from 'react';
import { useStore } from '../store/useStore';

const THEMES = [
  { name: '默认白', bg: '#ffffff', text: '#1f1f1f' },
  { name: '米黄', bg: '#f4ecd8', text: '#3b2f1a' },
  { name: '护眼绿', bg: '#c7edcc', text: '#1f3d24' },
  { name: '深色', bg: '#1e1e1e', text: '#d8d8d8' },
];

// 字体选项使用「mac 优先、Windows 回退」的双平台栈，同一选项在两端都能命中
const FONTS = [
  { name: '衬线（默认）', value: '"Noto Serif CJK SC", "Songti SC", "SimSun", serif' },
  { name: '宋体 / 宋体-简', value: '"Songti SC", "SimSun", "NSimSun", serif' },
  { name: '雅黑 / 苹方', value: '"PingFang SC", "Microsoft YaHei", sans-serif' },
  { name: '黑体', value: '"Heiti SC", "SimHei", sans-serif' },
  { name: '楷体', value: '"Kaiti SC", "STKaiti", "KaiTi", serif' },
  { name: '仿宋', value: '"STFangsong", "FangSong", serif' },
  { name: '系统默认', value: '-apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif' },
];

const PETS = [
  { id: 'cat', emoji: '🐱', name: '小猫' },
  { id: 'dog', emoji: '🐶', name: '小狗' },
  { id: 'rabbit', emoji: '🐰', name: '小兔' },
  { id: 'panda', emoji: '🐼', name: '熊猫' },
  { id: 'fox', emoji: '🦊', name: '狐狸' },
  { id: 'chick', emoji: '🐤', name: '小鸡' },
];

export default function SettingsPanel() {
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const toggle = useStore((s) => s.toggleSettings);

  return (
    <div className="panel">
      <button className="close-x" onClick={() => toggle(false)}>
        ✕
      </button>
      <h3>阅读设置</h3>

      <div className="field">
        <label>主题</label>
        <div className="row">
          {THEMES.map((t) => (
            <div
              key={t.name}
              className="swatch"
              title={t.name}
              style={{
                background: t.bg,
                borderColor: settings.bg === t.bg ? '#4a6fa5' : '#ccc',
              }}
              onClick={() => update({ bg: t.bg, text: t.text, theme: t.name })}
            />
          ))}
        </div>
      </div>

      <div className="field">
        <label>字体</label>
        <select
          className="font-select"
          value={settings.fontFamily}
          onChange={(e) => update({ fontFamily: e.target.value })}
        >
          {/* 自定义过 fontFamily 而不在预设列表时仍显示当前值 */}
          {!FONTS.some((f) => f.value === settings.fontFamily) && (
            <option value={settings.fontFamily}>自定义</option>
          )}
          {FONTS.map((f) => (
            <option key={f.name} value={f.value}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>桌面宠物（最小化后显示，双击宠物恢复）</label>
        <div className="row">
          {PETS.map((p) => (
            <div
              key={p.id}
              className={'pet-option' + (settings.pet === p.id ? ' sel' : '')}
              title={p.name}
              onClick={() => update({ pet: p.id })}
            >
              <span className="pet-emoji">{p.emoji}</span>
              <span className="pet-name">{p.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="field">
        <label>字号 {settings.fontSize}px</label>
        <input
          type="range"
          min="12"
          max="36"
          value={settings.fontSize}
          onChange={(e) => update({ fontSize: Number(e.target.value) })}
        />
      </div>

      <div className="field">
        <label>行高 {settings.lineHeight}</label>
        <input
          type="range"
          min="1.2"
          max="2.4"
          step="0.1"
          value={settings.lineHeight}
          onChange={(e) => update({ lineHeight: Number(e.target.value) })}
        />
      </div>

      <div className="field">
        <label>段距 {settings.paraSpacing}em</label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={settings.paraSpacing}
          onChange={(e) => update({ paraSpacing: Number(e.target.value) })}
        />
      </div>

      <div className="field">
        <label>边距 {settings.padding}px</label>
        <input
          type="range"
          min="16"
          max="120"
          step="8"
          value={settings.padding}
          onChange={(e) => update({ padding: Number(e.target.value) })}
        />
      </div>

      <div className="field">
        <label>自定义背景色</label>
        <input type="color" value={settings.bg} onChange={(e) => update({ bg: e.target.value })} />
      </div>
      <div className="field">
        <label>自定义文字色</label>
        <input type="color" value={settings.text} onChange={(e) => update({ text: e.target.value })} />
      </div>
    </div>
  );
}
