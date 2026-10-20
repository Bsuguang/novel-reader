'use strict';
/**
 * 全文搜索：在大段文本中查找关键词，返回含上下文片段的命中列表。
 * 默认大小写不敏感；可限制最大返回数量。
 */

// lowercase 全文缓存：同一本书多次搜索不再重复 toLowerCase（大文件下显著省时）
let lowerCache = { src: null, lower: '' };
function getLower(text) {
  if (lowerCache.src === text) return lowerCache.lower;
  lowerCache.src = text;
  lowerCache.lower = text.toLowerCase();
  return lowerCache.lower;
}

function search(text, query, opts) {  opts = opts || {};
  if (!query) return [];
  const max = opts.max || 500;
  const ignoreCase = opts.ignoreCase !== false;
  const q = ignoreCase ? query.toLowerCase() : query;
  const hay = ignoreCase ? getLower(text) : text;
  const results = [];
  let idx = 0;
  while (results.length < max) {
    const found = hay.indexOf(q, idx);
    if (found === -1) break;
    const start = Math.max(0, found - 24);
    const end = Math.min(text.length, found + query.length + 24);
    results.push({
      position: found,
      snippet: text.slice(start, end),
      before: start,
      after: end,
    });
    idx = found + query.length;
  }
  return results;
}

module.exports = { search };
