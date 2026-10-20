'use strict';
// 离线验证：复刻 useStore.processText 的新逻辑，对真实《凡人修仙传》做断言。
const fs = require('fs');
const path = require('path');
const { parseChapters } = require('../src/lib/chapter');

function processText(content) {
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
      if (buf.length === 0) { lineStart = i; charStart = charPos; }
      buf.push(line);
      charPos += lineLen + 1;
    }
  }
  if (buf.length) paragraphs.push({ text: buf.join('\n'), startLine: lineStart, charStart });
  return { paragraphs, chapters };
}

// 简易搜索（与 src/lib/search.js 同语义）
function search(text, query, max = 500) {
  const q = query.toLowerCase();
  const hay = text.toLowerCase();
  const out = [];
  let idx = 0;
  while (out.length < max) {
    const f = hay.indexOf(q, idx);
    if (f === -1) break;
    out.push({ position: f });
    idx = f + query.length;
  }
  return out;
}

const file = 'C:/Users/BaiSuJun/Downloads/凡人修仙传.txt';
const buf = fs.readFileSync(file);
const text = new TextDecoder('gbk').decode(buf); // 模拟主进程解码（含 CRLF）
let ok = 0, fail = 0;
const assert = (name, cond) => { if (cond) { ok++; console.log('  PASS', name); } else { fail++; console.log('  FAIL', name); } };

console.log('文件大小:', buf.length, '字节, 解码后字符数:', text.length);

const { paragraphs, chapters } = processText(text);
console.log('段落数:', paragraphs.length, ' 章节数:', chapters.length);

assert('段落未被压成 1 个（应远 > 1000）', paragraphs.length > 1000);
assert('章节被正确识别（应 > 1000）', chapters.length > 1000);

// 验证：前 12 个章节都能精确落到「标题所在段落」
let mapOk = 0;
const sample = chapters.slice(0, 12);
for (const ch of sample) {
  const idx = paragraphs.findIndex((p) => p.startLine >= ch.startLine);
  const p = paragraphs[idx];
  const hit = p && p.text.trim().startsWith(ch.title.trim());
  if (hit) mapOk++;
  else console.log('    章节映射偏差:', JSON.stringify(ch.title), '->', JSON.stringify(p && p.text.slice(0, 30)));
}
assert('前12章均精确映射到标题段落', mapOk === sample.length);

// 验证：跳到中间某一章（如第 1300 章附近）也能落对
const mid = chapters[1300];
if (mid) {
  const idx = paragraphs.findIndex((p) => p.startLine >= mid.startLine);
  const p = paragraphs[idx];
  assert('中间章节映射到标题段落', p && p.text.trim().startsWith(mid.title.trim()));
}

// 验证：搜索偏移 -> 段落 映射
const norm = text.replace(/\r\n?/g, '\n');
const q = '韩立';
const results = search(norm, q);
assert('搜索“韩立”有命中', results.length > 0);
let posMapOk = 0, posMapTested = 0;
for (const r of results.slice(0, 50)) {
  posMapTested++;
  let target = -1;
  for (let i = 0; i < paragraphs.length; i++) {
    if (paragraphs[i].charStart <= r.position) target = i; else break;
  }
  const p = paragraphs[target];
  const local = r.position - p.charStart;
  const hit = local >= 0 && local <= p.text.length && p.text.slice(local, local + q.length) === q;
  if (hit) posMapOk++; else console.log('    搜索映射偏差 pos=', r.position, '段落=', target, 'local=', local);
}
assert('搜索偏移映射到正确段落（前50条）', posMapOk === posMapTested);

// 验证：书签 round-trip（记录章节段落的 charStart，再用 position 跳回，应回到同一段落）
let bmOk = 0, bmTest = 0;
for (const ch of chapters.slice(0, 12)) {
  const idx = paragraphs.findIndex((p) => p.startLine >= ch.startLine);
  const p = paragraphs[idx];
  const charPos = p.charStart; // 模拟 addBookmark 记录的偏移
  let tgt = -1;
  for (let i = 0; i < paragraphs.length; i++) {
    if (paragraphs[i].charStart <= charPos) tgt = i; else break;
  }
  bmTest++;
  if (tgt === idx) bmOk++; else console.log('    书签映射偏差 章=', ch.title, '记录段落=', idx, '跳回=', tgt);
}
assert('书签 charStart 跳回同一段落（前12章）', bmOk === bmTest);

console.log('\n结果: PASS=' + ok + ' FAIL=' + fail);
process.exit(fail ? 1 : 0);
