'use strict';
/**
 * 编码检测与解码
 * 仅依赖 Node / 浏览器内置 TextDecoder，无需 iconv-lite / jschardet。
 * 支持：UTF-8(含 BOM)、GBK、GB2312、Big5、UTF-16(LE/BE)。
 */

const ENCODINGS = ['utf-8', 'gbk', 'gb2312', 'big5', 'utf-16le'];

function hasBOM(buf) {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return 'utf-8';
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return 'utf-16le';
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) return 'utf-16be';
  return null;
}

function tryDecode(buf, enc) {
  try {
    return new TextDecoder(enc, { fatal: false }).decode(buf);
  } catch (e) {
    return null;
  }
}

function countReplacement(str) {
  let n = 0;
  for (let i = 0; i < str.length; i++) if (str.charCodeAt(i) === 0xfffd) n++;
  return n;
}

function countCJK(str) {
  let n = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if ((c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3400 && c <= 0x4dbf)) n++;
  }
  return n;
}

function scoreDecode(str) {
  // 替换字符越多越差；CJK 越多越可能是正确的中文解码
  return countCJK(str) - countReplacement(str) * 10;
}

function detectEncoding(buf) {
  const bom = hasBOM(buf);
  if (bom) return bom === 'utf-16be' ? 'utf-16be' : bom;

  const utf8 = tryDecode(buf, 'utf-8');
  if (utf8 !== null && countReplacement(utf8) === 0 && /[一-鿿]/.test(utf8)) {
    return 'utf-8';
  }

  const candidates = ['gbk', 'gb2312', 'big5'];
  let best = null;
  let bestScore = -Infinity;
  for (const enc of candidates) {
    const s = tryDecode(buf, enc);
    if (!s) continue;
    const sc = scoreDecode(s);
    if (sc > bestScore) {
      bestScore = sc;
      best = enc;
    }
  }
  return best || 'utf-8';
}

function decodeBuffer(buf, encoding) {
  const enc = (encoding || detectEncoding(buf)).toLowerCase();
  if (enc === 'utf-16be') {
    const swapped = Buffer.from(buf);
    for (let i = 0; i < swapped.length - 1; i += 2) {
      const t = swapped[i];
      swapped[i] = swapped[i + 1];
      swapped[i + 1] = t;
    }
    return tryDecode(swapped, 'utf-16le') || tryDecode(buf, 'utf-8');
  }
  return tryDecode(buf, enc) || tryDecode(buf, 'utf-8');
}

function detectAndDecode(buf) {
  const encoding = detectEncoding(buf);
  const text = decodeBuffer(buf, encoding);
  return { text, encoding };
}

module.exports = { detectAndDecode, detectEncoding, decodeBuffer, ENCODINGS, hasBOM };
