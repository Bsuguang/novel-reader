import React, { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { localIndexByCharPos } from '../lib/text';

// 取当前位于阅读区顶部附近的段落索引（用于书签定位 / 朗读起点）
function getCurrentParagraphIndex(el) {
  const rect = el.getBoundingClientRect();
  const node = document.elementFromPoint(rect.left + rect.width / 2, rect.top + 24);
  let p = node;
  while (p && p !== el) {
    if (p.id && p.id.indexOf('para-') === 0) return Number(p.id.slice(5));
    p = p.parentElement;
  }
  return -1;
}

// 按关键词高亮段落文本（大小写不敏感）
function renderWithHighlight(text, query) {
  if (!query) return text;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const parts = [];
  let i = 0;
  let key = 0;
  while (i <= text.length) {
    const idx = lower.indexOf(q, i);
    if (idx === -1) {
      parts.push(text.slice(i));
      break;
    }
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(
      <mark key={'h' + key++} className="hl">
        {text.slice(idx, idx + q.length)}
      </mark>
    );
    i = idx + q.length;
  }
  return parts;
}

export default function Reader() {
  const scrollRef = useRef(null);
  const scrollTimer = useRef(null);

  const chapterParagraphs = useStore((s) => s.chapterParagraphs);
  const settings = useStore((s) => s.settings);
  const filePath = useStore((s) => s.filePath);
  const searchQuery = useStore((s) => s.searchQuery);
  const chapters = useStore((s) => s.chapters);
  const currentChapter = useStore((s) => s.currentChapter);
  const pendingScroll = useStore((s) => s.pendingScroll);
  const saveProgress = useStore((s) => s.saveProgress);
  const setCurrentParagraph = useStore((s) => s.setCurrentParagraph);
  const clearPendingScroll = useStore((s) => s.clearPendingScroll);
  const loadChapter = useStore((s) => s.loadChapter);
  const gotoPosition = useStore((s) => s.gotoPosition);
  const scrollRequest = useStore((s) => s.scrollRequest);
  const requestScroll = useStore((s) => s.requestScroll);
  const tts = useStore((s) => s.tts);
  const autoScroll = useStore((s) => s.autoScroll);
  const tickReadingTime = useStore((s) => s.tickReadingTime);

  // 将目标段落滚动到视口顶部附近。
  // 关键点：正文用了 content-visibility:auto，远处的段落初始是「折叠」状态，
  // 直接读 offsetTop / getBoundingClientRect 会得到错误位置。这里用「迭代逼近」：
  // 每次先把节点滚到顶部使其进入可视区被正常布局，下一帧再精确测量，数次后收敛到正确位置。
  const scrollToParagraph = useCallback((targetIndex) => {
    const el = scrollRef.current;
    if (!el || targetIndex < 0) return;
    let iter = 0;
    const step = () => {
      const node = document.getElementById('para-' + targetIndex);
      if (!node) return;
      const top =
        el.scrollTop + node.getBoundingClientRect().top - el.getBoundingClientRect().top - 24;
      el.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
      if (iter++ < 8) requestAnimationFrame(step);
    };
    step();
  }, []);

  // 消费 pendingScroll：加载章后由 loadChapter 设置，渲染完成后在此执行并清零
  useEffect(() => {
    if (pendingScroll == null) return;
    const el = scrollRef.current;
    if (!el) return;
    if (pendingScroll === 'top') {
      el.scrollTo({ top: 0, behavior: 'auto' });
    } else {
      // 全局 charPos -> 章内局部段索引 -> 滚动到该段（保留迭代逼近以绕开折叠误差）
      const idx = localIndexByCharPos(chapterParagraphs, pendingScroll);
      scrollToParagraph(idx < 0 ? 0 : idx);
    }
    clearPendingScroll();
  }, [pendingScroll, chapterParagraphs, scrollToParagraph, clearPendingScroll]);

  // 朗读跟随：正在播放时，当前朗读段自动滚进视野（暂停/停止时不打扰手动浏览）
  useEffect(() => {
    if (!tts.playing || tts.paused || tts.current < 0) return;
    const idx = localIndexByCharPos(chapterParagraphs, tts.current);
    if (idx >= 0) scrollToParagraph(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tts.current, tts.playing, tts.paused]);

  // 自动滚屏：rAF 循环按 settings.autoScrollSpeed（px/帧，按实际帧间隔折算）匀速下滚；
  // 滚到底自动进入下一章继续，末章则自动停止
  const speedRef = useRef(settings.autoScrollSpeed || 1);
  speedRef.current = settings.autoScrollSpeed || 1;
  useEffect(() => {
    if (!autoScroll) return;
    let raf = 0;
    let last = performance.now();
    const step = (now) => {
      const el = scrollRef.current;
      if (!el) return;
      const dt = Math.min(now - last, 100); // 后台标签页回来时避免一次跳滚
      last = now;
      const bottom = el.scrollHeight - el.clientHeight - 1;
      if (el.scrollTop >= bottom) {
        // 本章读完：有下一章则自动续，否则停止
        const st = useStore.getState();
        if (st.currentChapter < st.chapters.length - 1) {
          st.nextChapter();
        } else {
          st.setAutoScroll(false);
          return;
        }
      } else {
        el.scrollTop += (speedRef.current * dt) / 16.7;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [autoScroll]);

  // 阅读时长统计：每秒累计一次（页面隐藏时不计），store 内部每 15s 持久化
  useEffect(() => {
    if (!filePath) return;
    const t = setInterval(() => tickReadingTime(), 1000);
    return () => clearInterval(t);
  }, [filePath, tickReadingTime]);

  // 兼容旧 scrollRequest 路由（保留：组件现多直接调 loadChapter / gotoPosition）
  useEffect(() => {
    if (!scrollRequest) return;
    if (scrollRequest.type === 'chapter') {
      loadChapter(scrollRequest.value);
    } else if (scrollRequest.type === 'position') {
      gotoPosition(scrollRequest.value);
    }
    // 其它类型忽略
  }, [scrollRequest, loadChapter, gotoPosition]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      saveProgress(); // 无参：依据 currentChapter + 章内 currentParagraph 计算全局 charPos 保存
      const idx = getCurrentParagraphIndex(el);
      if (idx >= 0) setCurrentParagraph(idx);
    }, 400);
  }, [saveProgress, setCurrentParagraph]);

  const styleVars = {
    '--reader-bg': settings.bg,
    '--reader-text': settings.text,
    '--reader-font-size': settings.fontSize + 'px',
    '--reader-line-height': String(settings.lineHeight),
    '--reader-para': settings.paraSpacing + 'em',
    '--reader-padding': settings.padding + 'px',
    '--reader-font-family': settings.fontFamily,
  };

  // 当前章标题（阅读区顶部展示，避免与按章切段后的首段标题重复，仅作信息条）
  const chapterTitle =
    currentChapter >= 0 && chapters[currentChapter] ? chapters[currentChapter].title : '';

  return (
    <div className="reader-wrap">
      {chapterTitle && <div className="chapter-title-bar">{chapterTitle}</div>}
      <div className="reader-scroll" ref={scrollRef} onScroll={onScroll} style={styleVars}>
        <div className="reader-content">
          {chapterParagraphs.map((p, i) => (
            <p
              id={'para-' + i}
              key={i}
              className={tts.current >= 0 && p.charStart === tts.current ? 'tts-active' : ''}
            >
              {renderWithHighlight(p.text, searchQuery)}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
