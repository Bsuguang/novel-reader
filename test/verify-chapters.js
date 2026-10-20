'use strict';
/**
 * 离线验证：用真实大文件《凡人修仙传》(GBK / CR / 15.7MB) 验证按章懒加载改造。
 * ① 不再全量切段；② loadChapter 产出的 charStart 与旧「全量 processText」算法一致；
 * ③ findChapterByCharPos / localIndexByCharPos 能正确把全局偏移还原到「章+章内段」；
 * ④ 旧 progress {ratio} 近似迁移落点合理。
 * 直接 `node test/verify-chapters.js` 运行（无需 webpack）。
 */
const path = require('path');
const fs = require('fs');
const { parseChapters } = require('../src/lib/chapter');
const { search } = require('../src/lib/search');
const { splitChapterByRange, findChapterByCharPos, localIndexByCharPos } = require('../src/lib/text');

// ---- 复刻旧版「全量 processText」与 search，做对照 ----
function oldProcessText(content) {
  const { chapters } = parseChapters(content);
  const norm = String(content).replace(/\r\n?/g, '\n');
  const lines = norm.split('\n');
  const paragraphs = [];
  let buf = [];
  let lineStart = 0;
  let charPos = 0;
  let charStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLen = line.length;
    if (line.trim() === '') {
      if (buf.length) {
        paragraphs.push({ text: buf.join('\n'), startLine: lineStart, charStart });
        buf = [];
      }
      charPos += lineLen + 1;
    } else {
      if (buf.length === 0) {
        lineStart = i;
        charStart = charPos;
      }
      buf.push(line);
      charPos += lineLen + 1;
    }
  }
  if (buf.length) paragraphs.push({ text: buf.join('\n'), startLine: lineStart, charStart });
  return { paragraphs, chapters };
}

const file = 'C:/Users/BaiSuJun/Downloads/凡人修仙传.txt';
const buf = fs.readFileSync(file);
const text = new TextDecoder('gbk').decode(buf); // 模拟主进程解码（CR 行结束）

let ok = 0;
let fail = 0;
const assert = (name, cond) => {
  if (cond) {
    ok++;
    console.log('  PASS', name);
  } else {
    fail++;
    console.log('  FAIL', name);
  }
};

console.log('文件字节:', buf.length, ' 解码字符:', text.length);

// 复刻 loadFile：parseChapters -> 归一化全文 + 章节(含 startChar)
const { chapters, lines } = parseChapters(text);
const rawText = lines.join('\n'); // 归一化 LF 全文（与 startChar/charStart 同一坐标系）
assert('章节被正确识别（应 > 1000）', chapters.length > 1000);
console.log('  章节数:', chapters.length, ' 归一化全文长度:', rawText.length);

// ① 不再全量切段：旧方式全量段落数；新方式按需逐章切段
const { paragraphs: oldParas } = oldProcessText(text);
console.log('  旧全量段落数:', oldParas.length);
assert('旧全量段落数很大（证明原本是全量切段）', oldParas.length > 1000);

// ② 抽若干章，验证 splitChapterByRange 产出的 charStart 与旧全量切段完全一致
const sampleIdx = [0, 50, 500, 1300, chapters.length - 1].filter((i) => i < chapters.length);
let charStartOk = true;
for (const ci of sampleIdx) {
  const ch = chapters[ci];
  const newParas = splitChapterByRange(rawText, ch);
  const oldSub = oldParas.filter((p) => p.startLine >= ch.startLine && p.startLine < ch.endLine);
  if (newParas.length !== oldSub.length) {
    charStartOk = false;
    console.log('    章', ci, '段落数不符 新=', newParas.length, '旧=', oldSub.length);
    break;
  }
  for (let i = 0; i < newParas.length; i++) {
    if (newParas[i].charStart !== oldSub[i].charStart) {
      charStartOk = false;
      console.log('    章', ci, '第', i, '段 charStart 不符 新=', newParas[i].charStart, '旧=', oldSub[i].charStart);
      break;
    }
  }
}
assert('按章切段 charStart 与旧全量切段完全一致（抽样章）', charStartOk);

// ③ 搜索命中 -> 全局 charPos -> (章, 章内段) 还原，验证命中文字确实落在还原段内
const q = '韩立';
const results = search(rawText, q);
assert('搜索“韩立”有命中', results.length > 0);
let posMapOk = 0;
let posMapTested = 0;
for (const r of results.slice(0, 100)) {
  posMapTested++;
  const ci = findChapterByCharPos(chapters, r.position);
  if (ci < 0) continue;
  const paras = splitChapterByRange(rawText, chapters[ci]);
  const li = localIndexByCharPos(paras, r.position);
  if (li < 0) continue;
  const p = paras[li];
  const local = r.position - p.charStart;
  const hit = local >= 0 && local <= p.text.length && p.text.slice(local, local + q.length) === q;
  if (hit) posMapOk++;
  else console.log('    搜索映射偏差 pos=', r.position, '章=', ci, '段=', li, 'local=', local);
}
assert('搜索偏移 (章,章内段) 还原后命中文字一致（前100条）', posMapOk === posMapTested);

// 章节二分序正确性：startChar 严格升序，且 findChapterByCharPos 落在正确区间
let binOk = true;
for (let c = 1; c < chapters.length; c++) {
  if (chapters[c].startChar <= chapters[c - 1].startChar) {
    binOk = false;
    break;
  }
}
assert('章节 startChar 严格升序（二分前提成立）', binOk);
// 抽样：随机取 20 个「落在首章之后」的全局偏移，验证 findChapterByCharPos 落在所属章区间
const firstStart = chapters[0].startChar;
for (let t = 0; t < 20; t++) {
  const pos = firstStart + Math.floor(Math.random() * (rawText.length - firstStart));
  const ci = findChapterByCharPos(chapters, pos);
  const nextStart = ci + 1 < chapters.length ? chapters[ci + 1].startChar : Infinity;
  if (!(chapters[ci].startChar <= pos && pos < nextStart)) {
    binOk = false;
    break;
  }
}
assert('findChapterByCharPos 抽样 20 个偏移均落回正确章区间', binOk);

// ④ 旧 progress {ratio} 近似迁移落点合理
let ratioOk = true;
for (const ratio of [0, 0.1, 0.25, 0.5, 0.75, 0.99]) {
  const charPos = Math.floor(ratio * rawText.length);
  const ci = findChapterByCharPos(chapters, charPos);
  if (ci < 0 || ci >= chapters.length) {
    ratioOk = false;
    console.log('    ratio=', ratio, '落点章越界 ci=', ci);
    continue;
  }
  const nextStart = ci + 1 < chapters.length ? chapters[ci + 1].startChar : Infinity;
  // 章首之前（如卷首语）的偏移会并入首章（ci=0），属合理落点，放宽下界
  const lowerOk = ci === 0 ? charPos >= 0 : chapters[ci].startChar <= charPos;
  if (!(lowerOk && charPos < nextStart)) {
    ratioOk = false;
    console.log('    ratio=', ratio, '落点不在章区间内');
  }
  // 落点应靠近该 ratio 对应的整体位置（章首偏移 <= charPos）
  console.log(
    '    ratio=',
    ratio.toFixed(2),
    '-> 章#',
    ci,
    chapters[ci].title.slice(0, 16)
  );
}
assert('旧 {ratio} 近似迁移落点均落在合法章区间内', ratioOk);

console.log('\n结果: PASS=' + ok + ' FAIL=' + fail);
process.exit(fail ? 1 : 0);
