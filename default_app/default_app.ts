import { shell } from 'electron/common';
import { app, dialog, BrowserWindow, ipcMain } from 'electron/main';
import * as path from 'node:path';
import * as url from 'node:url';

let mainWindow: BrowserWindow | null = null;

// Initialize Reddit IPC handlers
let redditHandlersInitialized = false;
function initializeRedditHandlers() {
  if (redditHandlersInitialized) return;

  try {
    const { setupRedditIpcHandlers } = require('./reddit-ipc-handler.js');
    setupRedditIpcHandlers();
    redditHandlersInitialized = true;
    console.log('Reddit IPC handlers initialized');
  } catch (error) {
    console.error('Failed to initialize Reddit IPC handlers:', error);
  }
}

// Initialize on app ready
app.whenReady().then(() => {
  initializeRedditHandlers();
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  app.quit();
});

function decorateURL (url: string) {
  // safely add `?utm_source=default_app
  const parsedUrl = new URL(url);
  parsedUrl.searchParams.append('utm_source', 'default_app');
  return parsedUrl.toString();
}

// Find the shortest path to the electron binary
const absoluteElectronPath = process.execPath;
const relativeElectronPath = path.relative(process.cwd(), absoluteElectronPath);
const electronPath = absoluteElectronPath.length < relativeElectronPath.length
  ? absoluteElectronPath
  : relativeElectronPath;

const indexPath = path.resolve(app.getAppPath(), 'index.html');
const redditSearchPath = path.resolve(app.getAppPath(), 'reddit-search.html');

function isTrustedSender (webContents: Electron.WebContents) {
  if (webContents !== (mainWindow && mainWindow.webContents)) {
    return false;
  }

  try {
    const currentPath = url.fileURLToPath(webContents.getURL());
    return currentPath === indexPath || currentPath === redditSearchPath;
  } catch {
    return false;
  }
}

ipcMain.handle('bootstrap', (event) => {
  return isTrustedSender(event.sender) ? electronPath : null;
});

async function createWindow (backgroundColor?: string, preloadScript?: string) {
  await app.whenReady();

  const options: Electron.BrowserWindowConstructorOptions = {
    width: 960,
    height: 620,
    autoHideMenuBar: true,
    backgroundColor,
    webPreferences: {
      preload: preloadScript || url.fileURLToPath(new URL('preload.js', import.meta.url)),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    },
    useContentSize: true,
    show: false
  };

  if (process.platform === 'linux') {
    options.icon = url.fileURLToPath(new URL('icon.png', import.meta.url));
  }

  mainWindow = new BrowserWindow(options);
  mainWindow.on('ready-to-show', () => mainWindow!.show());

  mainWindow.webContents.setWindowOpenHandler(details => {
    shell.openExternal(decorateURL(details.url));
    return { action: 'deny' };
  });

  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, done) => {
    const parsedUrl = new URL(webContents.getURL());

    const options: Electron.MessageBoxOptions = {
      title: 'Permission Request',
      message: `Allow '${parsedUrl.origin}' to access '${permission}'?`,
      buttons: ['OK', 'Cancel'],
      cancelId: 1
    };

    dialog.showMessageBox(mainWindow!, options).then(({ response }) => {
      done(response === 0);
    });
  });

  return mainWindow;
}

export const loadURL = async (appUrl: string) => {
  mainWindow = await createWindow();
  mainWindow.loadURL(appUrl);
  mainWindow.focus();
};

export const loadFile = async (appPath: string) => {
  // Use reddit-preload for reddit-search.html
  const preloadScript = appPath === 'reddit-search.html'
    ? url.fileURLToPath(new URL('reddit-preload.js', import.meta.url))
    : undefined;

  mainWindow = await createWindow(
    appPath === 'index.html' ? '#2f3241' : undefined,
    preloadScript
  );
  mainWindow.loadFile(appPath);
  mainWindow.focus();
};
