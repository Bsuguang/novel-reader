// 打包脚本：构建 webpack 产物并以「关闭代码签名自动发现」的方式调用 electron-builder。
// 个人本地应用不需要代码签名，关闭后可跳过 winCodeSign 工具包下载（其内含 macOS 符号链接，
// 在普通 Windows 权限下 7-zip 解压会报「无法创建符号链接 / 客户端没有所需的特权」而失败）。
// 产物为未签名 exe，Windows 首次打开可能提示 SmartScreen，点「更多信息 → 仍要运行」即可。
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// 清理上一轮的 release 产物，避免 electron-builder 在 EnsureEmptyDir 时因残留的
// app.asar 被占用（常因上次的 electron/阅读器进程未退出，或杀毒软件正在扫描该目录）而报
// 「The process cannot access the file because it is being used by another process」。
const releaseDir = path.resolve(__dirname, '..', 'release');
try {
  if (fs.existsSync(releaseDir)) {
    fs.rmSync(releaseDir, { recursive: true, force: true });
    console.log('已清理上一轮的 release/ 目录');
  }
} catch (e) {
  console.error('无法删除 release/（文件被占用）：', e.message);
  console.error('请先关闭已打开的「小说阅读器」窗口，或在任务管理器结束 electron.exe / app-builder.exe 后重试。');
  process.exit(1);
}

const env = { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' };
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const build = spawnSync(npm, ['run', 'build'], { stdio: 'inherit', shell: true, env });
if (build.status !== 0) process.exit(build.status ?? 1);

const pack = spawnSync('npx', ['electron-builder'], { stdio: 'inherit', shell: true, env });
process.exit(pack.status ?? 1);
