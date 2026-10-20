'use strict';
/**
 * 章节识别：在行首匹配常见章节标题，返回章节列表（含起始行索引 / 段落范围 / 首行全局偏移）。
 * 规则可扩展：NUM_RE 匹配「第X章/回/卷…」，KEYWORDS 匹配「序章/楔子…」等特殊标题；
 * isMd=true 时额外匹配 Markdown 标题（#/##/###），供 .md 文件按标题切章。
 *
 * 本模块同时负责把整本文本归一化为 LF（与 useStore / search 同一坐标系），
 * 并为每个章节预计算 startChar（首行 lineIndex 在 rawText 中的全局字符偏移），
 * 供 text.js 的 findChapterByCharPos 做二分定位。
 */

const NUM_RE = /^\s*第\s*([0-9零一二三四五六七八九十百千]+)\s*[章回卷节集部篇]\s*[:：]?\s*(.*)$/;
const KEYWORDS = ['序章', '楔子', '引子', '前言', '后记', '番外', '尾声', '终章', '附录', '序幕', '终幕', '正文'];
const MD_HEADING_RE = /^\s*(#{1,3})\s+(.+)$/;

function isChapterTitle(line, isMd) {
  if (!line) return false;
  if (NUM_RE.test(line)) return true;
  const t = line.trim();
  if (KEYWORDS.some((k) => t === k || t.startsWith(k))) return true;
  if (isMd && MD_HEADING_RE.test(line)) return true;
  return false;
}

function chapterTitleOf(line, isMd) {
  if (!isMd) return line.trim();
  const m = MD_HEADING_RE.exec(line);
  return m ? m[2].trim() : line.trim();
}

function parseChapters(text, isMd) {
  // 归一化行结束符，保证与 useStore 中 rawText、search 的偏移同坐标系
  const norm = String(text).replace(/\r\n?/g, '\n');
  const lines = norm.split('\n');

  // 预计算每个行首在 rawText 中的全局字符偏移：lineStartChar[i] = 前 i 行长度之和 + i 个换行符
  const lineStartChar = new Array(lines.length);
  let acc = 0;
  for (let i = 0; i < lines.length; i++) {
    lineStartChar[i] = acc;
    acc += lines[i].length + 1; // +1 表示该行末尾换行符
  }

  const chapters = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isChapterTitle(line, isMd)) {
      // startChar：首行 lineIndex 的全局字符偏移，供二分定位章
      chapters.push({
        index: chapters.length,
        title: chapterTitleOf(line, isMd),
        lineIndex: i,
        startLine: i,
        endLine: i,
        startChar: lineStartChar[i],
      });
    }
  }
  for (let c = 0; c < chapters.length; c++) {
    const startLine = chapters[c].lineIndex;
    const endLine = c + 1 < chapters.length ? chapters[c + 1].lineIndex : lines.length;
    chapters[c].startLine = startLine;
    chapters[c].endLine = endLine;
  }
  return { chapters, lines };
}

module.exports = { parseChapters, isChapterTitle, NUM_RE, KEYWORDS, MD_HEADING_RE };
