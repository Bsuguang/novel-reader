import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { localIndexByCharPos } from '../lib/text';

// 把一段文本按句切成小块，避免单次 utterance 过长被语音引擎截断
function splitSentences(text) {
  const out = [];
  let buf = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    buf += ch;
    if ('。！？；…!?'.includes(ch) || ch === '\n') {
      out.push(buf);
      buf = '';
    }
  }
  if (buf.trim()) out.push(buf);
  return out.length ? out : [text];
}

export default function TtsBar() {
  const chapterParagraphs = useStore((s) => s.chapterParagraphs);
  const chapters = useStore((s) => s.chapters);
  const currentChapter = useStore((s) => s.currentChapter);
  const currentParagraph = useStore((s) => s.currentParagraph);
  const tts = useStore((s) => s.tts);
  const setTts = useStore((s) => s.setTts);
  const filePath = useStore((s) => s.filePath);
  const nextChapter = useStore((s) => s.nextChapter);
  const toggle = useStore((s) => s.toggleTtsBar);
  const setTtsRate = useStore((s) => s.setTtsRate);
  const setTtsVoice = useStore((s) => s.setTtsVoice);
  const savedVoice = useStore((s) => s.ttsVoice);

  const queueRef = useRef([]);
  const posRef = useRef(0);
  const rateRef = useRef(tts.rate);
  const voiceRef = useRef(null);
  const continuingRef = useRef(false); // TTS 跨章续读标记（区别于手动翻章）
  const [voices, setVoices] = useState([]);

  // 加载语音列表，优先上次选中的嗓音，其次中文嗓音；卸载时停止朗读并复位状态
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const pick = () => {
      const vs = window.speechSynthesis.getVoices();
      if (vs.length) setVoices(vs);
      const saved = vs.find((v) => v.name === savedVoice);
      const zh = vs.find((v) => /zh|cmn|chinese|中文|普通话|han/i.test(v.lang + ' ' + v.name));
      voiceRef.current = saved || zh || vs[0] || null;
    };
    pick();
    window.speechSynthesis.onvoiceschanged = pick;
    return () => {
      const synth = window.speechSynthesis;
      if (synth) {
        synth.onvoiceschanged = null;
        synth.cancel();
      }
      setTts({ playing: false, paused: false, current: -1 });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onVoiceChange = (name) => {
    const v = voices.find((x) => x.name === name);
    if (v) {
      voiceRef.current = v;
      setTtsVoice(name);
      // 换嗓音后若在播放，从当前句重读以立即生效
      if (useStore.getState().tts.playing) {
        window.speechSynthesis.cancel();
        const cur = queueRef.current[posRef.current];
        const paras = useStore.getState().chapterParagraphs;
        const start = cur ? localIndexByCharPos(paras, cur.charStart) : 0;
        buildQueue(start < 0 ? 0 : start);
        posRef.current = 0;
        speakNext();
      }
    }
  };

  // 切书时停止朗读并复位
  useEffect(() => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setTts({ playing: false, paused: false, current: -1 });
    rateRef.current = tts.rate;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath]);

  // 监听 chapterParagraphs 变化：
  //   - continuingRef 为真（TTS 自身章末续读触发 nextChapter）：从新章起点续读；
  //   - 否则若正在播放（用户手动翻章）：停止，避免读到错误的章。
  useEffect(() => {
    if (continuingRef.current) {
      continuingRef.current = false;
      buildQueue(0);
      posRef.current = 0;
      const st = useStore.getState();
      setTts({
        playing: true,
        paused: false,
        current: st.chapterParagraphs[0] ? st.chapterParagraphs[0].charStart : -1,
      });
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      speakNext();
    } else if (tts.playing) {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      setTts({ playing: false, paused: false, current: -1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterParagraphs]);

  // 朗读下一块；队列耗尽则尝试跨章续读，否则停止
  const speakNext = () => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (posRef.current >= queueRef.current.length) {
      const st = useStore.getState();
      if (st.currentChapter < st.chapters.length - 1) {
        continuingRef.current = true; // 标记：下一章由 TTS 续读，而非手动翻章
        st.nextChapter();
      } else {
        st.setTts({ playing: false, paused: false, current: -1 });
      }
      return;
    }
    const item = queueRef.current[posRef.current];
    const u = new SpeechSynthesisUtterance(item.text);
    if (voiceRef.current) u.voice = voiceRef.current;
    u.lang = (voiceRef.current && voiceRef.current.lang) || 'zh-CN';
    u.rate = rateRef.current;
    u.onend = () => {
      posRef.current += 1;
      // tts.current 存「全局 charStart」，供 Reader 按 charStart 高亮当前段
      useStore.getState().setTts({ current: item.charStart });
      speakNext();
    };
    u.onerror = () => {
      posRef.current += 1;
      speakNext();
    };
    synth.speak(u);
  };

  // 从当前章 chapterParagraphs 的 start 段起，按句切分构建队列
  const buildQueue = (start) => {
    const paras = useStore.getState().chapterParagraphs;
    const q = [];
    for (let i = Math.max(0, start); i < paras.length; i++) {
      const charStart = paras[i].charStart; // 全局偏移，随该段一起记录
      for (const piece of splitSentences(paras[i].text)) {
        if (piece.trim()) q.push({ charStart, text: piece });
      }
    }
    queueRef.current = q;
  };

  const play = () => {
    if (!window.speechSynthesis) {
      alert('当前环境不支持语音合成（Web Speech API）。');
      return;
    }
    const st = useStore.getState();
    let start = 0;
    if (tts.current >= 0) {
      // 续播：定位到上次高亮段
      const idx = localIndexByCharPos(st.chapterParagraphs, tts.current);
      start = idx < 0 ? 0 : idx;
    } else {
      start = Math.max(0, st.currentParagraph);
    }
    buildQueue(start);
    posRef.current = 0;
    setTts({
      playing: true,
      paused: false,
      current: st.chapterParagraphs[start] ? st.chapterParagraphs[start].charStart : -1,
    });
    window.speechSynthesis.cancel();
    speakNext();
  };

  const pause = () => {
    window.speechSynthesis.pause();
    setTts({ paused: true });
  };
  const resume = () => {
    window.speechSynthesis.resume();
    setTts({ paused: false });
  };
  const stop = () => {
    window.speechSynthesis.cancel();
    setTts({ playing: false, paused: false, current: -1 });
  };
  const changeRate = (r) => {
    rateRef.current = r;
    setTtsRate(r); // 语速持久化
    if (useStore.getState().tts.playing) {
      window.speechSynthesis.cancel();
      const cur = queueRef.current[posRef.current];
      const paras = useStore.getState().chapterParagraphs;
      const start = cur ? localIndexByCharPos(paras, cur.charStart) : Math.max(0, currentParagraph);
      buildQueue(start < 0 ? 0 : start);
      posRef.current = 0;
      speakNext();
    }
  };

  const disabled = !filePath || chapterParagraphs.length === 0;

  // 状态文案：章内段定位（第X章·第Y段）
  const localIdx = tts.current >= 0 ? localIndexByCharPos(chapterParagraphs, tts.current) : -1;
  const statusText = tts.playing
    ? tts.paused
      ? '已暂停'
      : `朗读中…（第 ${currentChapter + 1} 章 · 第 ${(localIdx < 0 ? 0 : localIdx) + 1} 段）`
    : '未开始';

  return (
    <div className="tts-bar">
      <button className="close-x tts-close" onClick={() => toggle(false)}>
        ✕
      </button>
      <span className="tts-title">朗读</span>
      <button onClick={play} disabled={disabled || (tts.playing && !tts.paused)}>
        ▶ 播放
      </button>
      <button onClick={pause} disabled={disabled || !tts.playing || tts.paused}>
        ⏸ 暂停
      </button>
      <button onClick={resume} disabled={disabled || !tts.playing || !tts.paused}>
        ⏵ 继续
      </button>
      <button onClick={stop} disabled={disabled || !tts.playing}>
        ⏹ 停止
      </button>
      <span className="tts-rate">
        语速
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.1"
          value={tts.rate}
          onChange={(e) => changeRate(Number(e.target.value))}
        />
        <span>{tts.rate.toFixed(1)}x</span>
      </span>
      {voices.length > 0 && (
        <span className="tts-voice">
          嗓音
          <select value={voiceRef.current ? voiceRef.current.name : ''} onChange={(e) => onVoiceChange(e.target.value)}>
            {voices.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name}
              </option>
            ))}
          </select>
        </span>
      )}
      <span className="tts-status">{statusText}</span>
    </div>
  );
}
