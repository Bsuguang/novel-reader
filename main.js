const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { detectAndDecode } = require('./src/lib/encoding');
const Store = require('./store');

let mainWindow;
let store;
let petWindow = null; // 桌面宠物窗（最小化主窗口时显示）
let petDragOffset = { dx: 0, dy: 0 };
let startupFile = null; // 启动时通过命令行传入的 .txt/.md 路径（双击文件 / 拖拽到 exe）
let pendingOpenPath = null; // macOS open-file 事件在窗口就绪前收到的待打开路径
const isMac = process.platform === 'darwin';

// 解析启动参数：双击 .txt / 拖拽文件到 exe 时，系统会把文件路径作为 argv 传入。
// 找到第一个真实存在的 .txt/.md 并解码，供渲染进程直接打开。
async function parseStartupFile() {
  for (const arg of process.argv) {
    if (/\.(txt|md)$/i.test(arg) && fs.existsSync(arg)) {
      const decoded = await readAndDecode(arg);
      return decoded.error ? null : decoded;
    }
  }
  return null;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 720,
    minWidth: 600,
    minHeight: 400,
    // Windows/Linux：隐藏标题栏 + 自绘窗控 overlay（titlebar CSS 已设 -webkit-app-region: drag）；
    // macOS：用 hiddenInset，保留原生红绿灯（配合 CSS 给标题栏左侧留位）
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    ...(isMac ? {} : { titleBarOverlay: { color: '#2b2b2b', symbolColor: '#eeeeee', height: 44 } }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile('index.html');
  // 阻止拖拽文件到窗口时触发页面导航（应交给渲染进程的 dropzone 处理）
  mainWindow.webContents.on('will-navigate', (e) => e.preventDefault());
  // macOS：窗口就绪前经 open-file 收到的路径，在加载完成后补发给渲染层
  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingOpenPath) {
      const p = pendingOpenPath;
      pendingOpenPath = null;
      mainWindow.webContents.send('open-path', p);
    }
  });

  // 最小化 -> 不进任务栏，而是化身桌面宠物
  mainWindow.on('minimize', (e) => {
    e.preventDefault();
    showPet();
  });
  // 主窗口关闭：连带销毁宠物窗，保证 window-all-closed 正常退出
  mainWindow.on('closed', () => {
    if (petWindow && !petWindow.isDestroyed()) petWindow.destroy();
    petWindow = null;
    mainWindow = null;
  });
}

// ---------- 桌面宠物 ----------

function createPetWindow() {
  petWindow = new BrowserWindow({
    width: 160,
    height: 170,
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  petWindow.setAlwaysOnTop(true, 'screen-saver');
  // 恢复上次停靠位置；首次出现在工作区右下角
  const saved = store && store.getAll().petPos;
  if (Array.isArray(saved) && saved.length === 2) {
    petWindow.setPosition(saved[0], saved[1]);
  } else {
    const wa = screen.getPrimaryDisplay().workAreaSize;
    petWindow.setPosition(wa.width - 180, wa.height - 200);
  }
  petWindow.loadFile('pet.html');
}

function showPet() {
  if (!petWindow || petWindow.isDestroyed()) createPetWindow();
  // 每次显示都重载，确保读取设置里最新选择的小动物
  petWindow.loadFile('pet.html');
  petWindow.show();
}

function hidePetAndRestore() {
  if (petWindow && !petWindow.isDestroyed()) petWindow.hide();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  }
}

app.whenReady().then(async () => {
  store = new Store(path.join(app.getPath('userData'), 'reader-config.json'));
  startupFile = await parseStartupFile();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  // 强制落盘防抖窗口内尚未写入的进度/书签等数据
  if (store) store.flushSync();
});

app.on('window-all-closed', () => {
  // macOS 惯例：关窗不退出，点 Dock 图标（activate）可重建窗口
  if (!isMac) app.quit();
});

// macOS：双击 .txt（文件关联）/ Finder 拖到 Dock 图标时，路径经此事件传入（不走 argv）。
// 可能在 ready 之前触发：先暂存，窗口就绪后经 get-startup-file / open-path 两条通道交给渲染层。
app.on('open-file', (e, p) => {
  e.preventDefault();
  if (!/\.(txt|md)$/i.test(p || '')) return;
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isLoading()) {
    mainWindow.show();
    mainWindow.webContents.send('open-path', p);
  } else {
    pendingOpenPath = p; // 窗口未就绪：暂存，did-finish-load 后补发
  }
});

// 打开本地 txt/md：主进程异步读取原始字节 -> 自动检测编码并解码为 UTF-8 后传回渲染进程
ipcMain.handle('open-file', async () => {
  const res = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: '文本文件', extensions: ['txt', 'md'] }],
  });
  if (res.canceled || !res.filePaths.length) return null;
  return readAndDecode(res.filePaths[0]);
});

// 按已记录的路径直接重新打开（书架重开，无需再弹对话框）
ipcMain.handle('open-file-path', async (e, p) => {
  if (!p || typeof p !== 'string') return { error: '无效路径' };
  if (!fs.existsSync(p)) return { error: '文件不存在，可能已被移动或删除' };
  return readAndDecode(p);
});

// 读取文件字节、检测编码并解码为文本；失败返回 { error }。
// 异步读取，避免大文件阻塞主进程导致窗口失去响应。
async function readAndDecode(p) {
  try {
    const buf = await fs.promises.readFile(p);
    const { text, encoding } = detectAndDecode(buf);
    return { path: p, name: path.basename(p), content: text, encoding };
  } catch (e) {
    return { error: String((e && e.message) || e) };
  }
}

// 设置 / 进度 / 最近文件持久化（JSON 文件，零额外依赖）
ipcMain.handle('config:get', () => (store ? store.getAll() : {}));
ipcMain.handle('config:set', (e, patch) => (store ? store.set(patch) : null));

// 渲染进程启动时拉取「命令行传入的文件」（双击 .txt / 拖拽到 exe 打开）
ipcMain.handle('get-startup-file', () => startupFile);

// 全屏切换（F11 快捷键）
ipcMain.handle('toggle-fullscreen', () => {
  if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
});

// 导出文本（书签/笔记导出 markdown）：弹保存对话框并写文件
ipcMain.handle('save-text-file', async (e, { defaultPath, content }) => {
  if (typeof content !== 'string') return { error: '无效内容' };
  const res = await dialog.showSaveDialog({
    defaultPath: defaultPath || '导出.md',
    filters: [{ name: 'Markdown', extensions: ['md'] }, { name: '文本文件', extensions: ['txt'] }],
  });
  if (res.canceled || !res.filePath) return null;
  try {
    await fs.promises.writeFile(res.filePath, content, 'utf-8');
    return { path: res.filePath };
  } catch (err) {
    return { error: String((err && err.message) || err) };
  }
});

// ---------- 桌面宠物 IPC ----------

// 双击 / 右键宠物 -> 隐藏宠物并还原主窗口
ipcMain.handle('pet-restore', () => hidePetAndRestore());

// 手动拖动（不用 -webkit-app-region: drag，因其会吞掉点击事件）：
// 渲染进程把鼠标屏幕坐标发来，主进程按按下时的偏移同步窗口位置
ipcMain.on('pet-drag-start', (e, pt) => {
  if (!petWindow || petWindow.isDestroyed()) return;
  const b = petWindow.getBounds();
  petDragOffset = { dx: pt.x - b.x, dy: pt.y - b.y };
});
ipcMain.on('pet-drag-move', (e, pt) => {
  if (!petWindow || petWindow.isDestroyed()) return;
  petWindow.setPosition(Math.round(pt.x - petDragOffset.dx), Math.round(pt.y - petDragOffset.dy));
});
ipcMain.on('pet-drag-end', () => {
  // 拖完记住停靠位置
  if (petWindow && !petWindow.isDestroyed() && store) {
    store.set({ petPos: petWindow.getPosition() });
  }
});
