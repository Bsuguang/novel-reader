'use strict';
/**
 * 全局偏移 <-> (章, 章内段) 映射工具。
 *
 * 约定（与 search.js / useStore / TTS 共享同一坐标系）：
 *   - rawText 为「归一化 LF」的全文（与旧 processText 的归一化一致：\r\n? -> \n）。
 *   - chapterParagraphs 每一段的 charStart 是其在 rawText 中的「全局」字符偏移。
 *   - search.position / bookmark.charPos / progress.charPos / tts.current 全部共用该全局坐标系。
 *
 * 任何「全局 charPos <-> (chapterIndex, 章内段落 localIndex)」的换算都必须经由本文件，
 * 禁止在组件 / action 内自行换算，以保证跨章定位的一致性。
 */

/**
 * 仅切「当前章」为段落数组（按章懒加载的核心）。
 *
 * 复刻旧 processText 的逐段切分逻辑，但只处理 [startLine, endLine) 行区间，
 * 并以 chapter.startChar 作为初始全局偏移，从而保证：
 *   本函数产出的每段 charStart 与「旧全量 processText」对同一段落的 charStart 完全一致。
 *
 * @param {string} rawText 归一化 LF 的全文
 * @param {object} chapter 含 startLine / endLine / startChar 的章节对象
 * @param {Array<string>} [lines] 可选：预切好的全文行数组（调用方缓存，避免每次翻章对全文 split）
 * @returns {Array<{text:string, startLine:number, charStart:number}>}
 */
function splitChapterByRange(rawText, chapter, lines) {
  if (!rawText || !chapter) return [];
  const allLines = Array.isArray(lines) ? lines : rawText.split('\n');
  const startLine = chapter.startLine;
  const endLine = chapter.endLine;
  const paragraphs = [];
  let buf = [];
  let lineStart = 0;
  let charPos = chapter.startChar; // 章首行 lineIndex 在 rawText 中的全局字符偏移
  let charStart = 0;
  for (let i = startLine; i < endLine && i < allLines.length; i++) {
    const line = allLines[i];
    const lineLen = line.length;
    if (line.trim() === '') {
      if (buf.length) {
        paragraphs.push({ text: buf.join('\n'), startLine: lineStart, charStart });
        buf = [];
      }
      charPos += lineLen + 1; // +1 为该行末尾换行符
    } else {
      if (buf.length === 0) {
        lineStart = i;
        charStart = charPos;
      }
      buf.push(line);
      charPos += lineLen + 1;
    }
  }
  if (buf.length) {
    paragraphs.push({ text: buf.join('\n'), startLine: lineStart, charStart });
  }
  return paragraphs;
}

/**
 * 全局 charPos -> 所属章索引（基于 chapters[].startChar 做二分，O(log n)）。
 *
 * 章节按 startChar 升序，返回「startChar <= charPos 的最大索引」即包含该偏移的章；
 * charPos 超出全文（>= 末章 startChar）时返回最后一章；未命中（< 首章 startChar）返回 -1。
 *
 * @param {Array<{startChar:number}>} chapters 已预计算 startChar 的章节数组
 * @param {number} charPos 全局字符偏移
 * @returns {number} 命中章索引；未命中返回 -1
 */
function findChapterByCharPos(chapters, charPos) {
  if (!chapters || chapters.length === 0) return -1;
  if (charPos < 0) return -1; // 非法偏移
  // 二分：取「startChar <= charPos 的最大索引」。charPos 落在首章之前（如卷首语/前言）
  // 时，因 ans 初值为 0 且没有任何 startChar <= charPos，自然回退为第 0 章，避免续读/跳转丢失。
  let lo = 0;
  let hi = chapters.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (chapters[mid].startChar <= charPos) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

/**
 * 章内全局 charPos -> 局部段索引。
 *
 * 段落按 charStart 升序，返回「charStart <= charPos 的最大段落索引」；
 * 小于首段起始（charPos 落在章首空白/标题前）时返回 -1（调用方应回退为 0）。
 *
 * @param {Array<{charStart:number}>} paragraphs 当前章段落数组
 * @param {number} charPos 全局字符偏移
 * @returns {number} 局部段索引；无匹配返回 -1
 */
function localIndexByCharPos(paragraphs, charPos) {
  if (!paragraphs || paragraphs.length === 0) return -1;
  let idx = -1;
  for (let i = 0; i < paragraphs.length; i++) {
    if (paragraphs[i].charStart <= charPos) idx = i;
    else break;
  }
  return idx;
}

module.exports = { splitChapterByRange, findChapterByCharPos, localIndexByCharPos };
