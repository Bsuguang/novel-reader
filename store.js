'use strict';
const fs = require('fs');

// JSON 持久化（userData 目录，零依赖）。
// 可靠性：临时文件 + rename 原子替换，旧文件先备份为 .bak；主文件损坏时自动回退 .bak。
// 性能：set() 只更新内存并安排 500ms 防抖写盘（滚动进度等高频更新被合并）；
//       退出前由主进程调用 flushSync() 强制落盘。
class Store {
  constructor(file) {
    this.file = file;
    this.bak = file + '.bak';
    this.data = this._read();
    this._timer = null;
  }
  _read() {
    // 依次尝试主文件与备份；从备份恢复成功后立即回写主文件
    for (const f of [this.file, this.bak]) {
      try {
        const raw = fs.readFileSync(f, 'utf-8');
        const data = JSON.parse(raw || '{}');
        if (f === this.bak) this._writeNow(data);
        return data;
      } catch (e) {
        /* 尝试下一个 */
      }
    }
    return {};
  }
  getAll() {
    return this.data;
  }
  set(patch) {
    this.data = Object.assign({}, this.data, patch);
    this._schedule();
    return this.data;
  }
  // 立即写盘（应用退出前调用，防丢最近一次防抖窗口内的数据）
  flushSync() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._writeNow(this.data);
  }
  _schedule() {
    if (this._timer) return; // 已有待写任务，合并
    this._timer = setTimeout(() => {
      this._timer = null;
      this._writeNow(this.data);
    }, 500);
  }
  _writeNow(data) {
    try {
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
      try {
        if (fs.existsSync(this.file)) fs.copyFileSync(this.file, this.bak);
      } catch (e) {
        /* 备份失败不阻断主流程 */
      }
      fs.renameSync(tmp, this.file);
    } catch (e) {
      /* 忽略写入失败（如只读目录） */
    }
  }
}

module.exports = Store;
