'use strict';
const fs = require('fs');
const path = require('path');
const { detectAndDecode, detectEncoding } = require('../src/lib/encoding');
const { parseChapters } = require('../src/lib/chapter');
const { search } = require('../src/lib/search');
const {
  splitChapterByRange,
  findChapterByCharPos,
  localIndexByCharPos,
} = require('../src/lib/text');

// 复刻旧版「全量 processText」切段逻辑，用于与新的「按章 splitChapterByRange」做 charStart 一致性比对
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

let pass = 0;
let fail = 0;
function assert(name, cond) {
  if (cond) {
    pass++;
    console.log('  PASS  ' + name);
  } else {
    fail++;
    console.log('  FAIL  ' + name);
  }
}

console.log('== encoding ==');
const gbkBuf = fs.readFileSync(path.join(__dirname, 'sample-gbk.txt'));
const g = detectAndDecode(gbkBuf);
assert('gbk 被识别为 gbk/gb2312', g.encoding === 'gbk' || g.encoding === 'gb2312');
assert('gbk 解码内容正确', g.text.startsWith('第一回 风起青萍'));
assert('gbk 含后续章节', g.text.includes('第三章 决战之巅'));

const utfBuf = Buffer.from('第二章 你好\n世界', 'utf-8');
const u = detectAndDecode(utfBuf);
assert('utf-8 无 BOM 被正确识别', u.encoding === 'utf-8');
assert('utf-8 解码正确', u.text === '第二章 你好\n世界');

console.log('== chapters ==');
const sample =
  '序章\nIntro text here\n第一章 开始\n内容A段落一\n内容A段落二\n第二章 发展\n内容B\n第三章 结局\n内容C';
const { chapters } = parseChapters(sample);
assert('识别到 4 个章节', chapters.length === 4);
assert('首个章节为序章', chapters[0].title.indexOf('序章') !== -1);
assert('章节按顺序编号', chapters[2].index === 2 && chapters[2].title.indexOf('第二章') !== -1);
assert('第三章为第 4 章', chapters[3].index === 3 && chapters[3].title.indexOf('第三章') !== -1);
assert('记录了起始行索引', typeof chapters[1].startLine === 'number');

console.log('== search ==');
const sres = search(sample, '内容');
assert('搜索“内容”命中 4 处', sres.length === 4);
const sres2 = search(sample, '不存在的词xyz');
assert('搜索不存在的词返回空', sres2.length === 0);

console.log('== text(按章懒加载映射) ==');
// 多章、章间以空行分隔（贴近真实 txt：标题独占一行、内容成段）、含非标题单行的样本
const rawText =
  '序章\n\nintro line one\nintro line two\n\n第一章 开始\n\n内容A段落一\n内容A段落二\n\n第二章 发展\n\n内容B\n\n第三章 结局\n\n内容C';
const { chapters: chs } = parseChapters(rawText);
assert('识别到 4 个章节', chs.length === 4);

// 1) splitChapterByRange：每章切出的段落 charStart 与旧全量切段一致
const { paragraphs: oldParas } = oldProcessText(rawText);
let splitOk = true;
for (const ch of chs) {
  const newParas = splitChapterByRange(rawText, ch);
  const oldSub = oldParas.filter((p) => p.startLine >= ch.startLine && p.startLine < ch.endLine);
  if (newParas.length !== oldSub.length) {
    splitOk = false;
    break;
  }
  for (let i = 0; i < newParas.length; i++) {
    if (newParas[i].charStart !== oldSub[i].charStart || newParas[i].text !== oldSub[i].text) {
      splitOk = false;
      break;
    }
  }
}
assert('按章切段 charStart 与旧全量切段完全一致', splitOk);

// 2) findChapterByCharPos：二分定位章
assert('charPos=0 落在首章', findChapterByCharPos(chs, 0) === 0);
const midCharPos = oldParas.find((p) => p.text.indexOf('内容B') === 0).charStart;
const midCh = findChapterByCharPos(chs, midCharPos);
assert('内容B 偏移命中「第二章」', midCh === 2 && chs[midCh].title.indexOf('第二章') !== -1);
const lastCharPos = rawText.length - 1;
assert('超出末章的偏移仍命中末章', findChapterByCharPos(chs, lastCharPos) === 3);
assert('负偏移返回 -1', findChapterByCharPos(chs, -5) === -1);
assert('空章节数组返回 -1', findChapterByCharPos([], 10) === -1);

// 3) localIndexByCharPos：章内全局偏移 -> 局部段索引
const parasCh1 = splitChapterByRange(rawText, chs[1]); // 第一章
const p0 = parasCh1[0].charStart;
const p1 = parasCh1[1].charStart;
assert('章内偏移=段0起点 -> 局部索引0', localIndexByCharPos(parasCh1, p0) === 0);
assert('章内偏移=段1起点 -> 局部索引1', localIndexByCharPos(parasCh1, p1) === 1);
assert('章内偏移落在段0与段1之间 -> 局部索引0', localIndexByCharPos(parasCh1, p0 + 3) === 0);
assert('章内偏移越过末段 -> 末段索引', localIndexByCharPos(parasCh1, p1 + 9999) === parasCh1.length - 1);
assert('空段落数组返回 -1', localIndexByCharPos([], 10) === -1);

// 4) 跨章 round-trip：全局 charPos -> 章 -> 章内段 -> 该段 charStart 与原始一致
let rtOk = true;
for (const p of oldParas.slice(0, 30)) {
  const ci = findChapterByCharPos(chs, p.charStart);
  const li = localIndexByCharPos(splitChapterByRange(rawText, chs[ci]), p.charStart);
  const got = splitChapterByRange(rawText, chs[ci])[li];
  if (!got || got.charStart !== p.charStart) {
    rtOk = false;
    break;
  }
}
assert('全局charPos 经 (章,章内段) round-trip 回还原 charStart', rtOk);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
