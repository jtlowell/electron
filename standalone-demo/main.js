const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { RedditAPI } = require('./reddit-api');
const { ReportGenerator } = require('./report-generator');

const redditAPI = new RedditAPI();
const reportGenerator = new ReportGenerator();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'Reddit Product Search - Electron Demo'
  });

  mainWindow.loadFile('index.html');
  
  // Optional: Open DevTools for debugging
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function setupIpcHandlers() {
  // Search for product recommendations
  ipcMain.handle('reddit:search-products', async (event, category, options) => {
    try {
      console.log(`[Main] Searching Reddit for: ${category}`);
      
      const searchResult = await redditAPI.searchProductRecommendations(
        category,
        options?.maxSubreddits || 5,
        options?.maxPosts || 25,
        options?.maxComments || 50
      );

      const report = reportGenerator.generateBuyingGuide(category, searchResult);

      console.log(`[Main] Found ${report.productRecommendations.length} products`);
      return report;
    } catch (error) {
      console.error('[Main] Search error:', error);
      throw new Error(error.message || 'Failed to search Reddit');
    }
  });

  // Format report as HTML
  ipcMain.handle('reddit:format-report-html', async (event, report) => {
    try {
      return reportGenerator.formatAsHTML(report);
    } catch (error) {
      console.error('[Main] Format error:', error);
      throw error;
    }
  });

  // Save file to disk
  ipcMain.handle('reddit:save-file', async (event, filename, content) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Report',
        defaultPath: filename,
        filters: [
          { name: 'All Files', extensions: ['*'] },
          { name: 'Markdown', extensions: ['md'] },
          { name: 'JSON', extensions: ['json'] },
          { name: 'HTML', extensions: ['html'] }
        ]
      });

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }

      await fs.promises.writeFile(result.filePath, content, 'utf-8');
      console.log(`[Main] File saved: ${result.filePath}`);

      return { success: true, path: result.filePath };
    } catch (error) {
      console.error('[Main] Save error:', error);
      throw error;
    }
  });

  console.log('[Main] IPC handlers registered');
}
