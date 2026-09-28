const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const express = require('express');
const TronMultiSigService = require('./tron-service');

let mainWindow = null;
let serverInstance = null;
const tronService = new TronMultiSigService();

// 1. 单例锁保护：严格杜绝双击重复打开导致资源抢占
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      // 启动内嵌的动态端口 Express 引擎
      const assignedPort = await startLocalEngine();
      console.log(`[System] 本地后台引擎启动成功，动态端口: ${assignedPort}`);

      createWindow(assignedPort);
      registerIPCHandlers();
    } catch (err) {
      console.error('[System] 应用初始化失败:', err);
    }
  });
}

// 2. 动态端口本地 Express 服务 (解决 EADDRINUSE 核心逻辑)
function startLocalEngine() {
  return new Promise((resolve, reject) => {
    const expressApp = express();
    expressApp.use(express.json());

    expressApp.get('/health', (req, res) => {
      res.json({ status: 'OK', timestamp: Date.now() });
    });

    const server = http.createServer(expressApp);

    // 关键点：监听 0 端口，操作系统会自动分配空闲端口，永远不会报 EADDRINUSE
    server.listen(0, '127.0.0.1', () => {
      serverInstance = server;
      resolve(server.address().port);
    });

    server.on('error', (err) => reject(err));
  });
}

// 3. 注册安全 IPC 通信 (取代易出问题的本地 HTTP 跨域调用)
function registerIPCHandlers() {
  // 处理多签构建请求
  ipcMain.handle('tron:build-multisig', async (event, { ownerAddr, signers, threshold }) => {
    return await tronService.buildPermissionUpdateTx(ownerAddr, signers, threshold);
  });

  // 处理 Memo 通知生成
  ipcMain.handle('tron:build-notify', async (event, { from, to, memo }) => {
    return await tronService.buildNotificationTx(from, to, memo);
  });
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

// 应用退出清理：优雅释放端口句柄
app.on('before-quit', () => {
  if (serverInstance) {
    serverInstance.close(() => {
      console.log('[System] 本地服务句柄已优雅安全销毁');
    });
  }
});
