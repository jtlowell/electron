/**
 * IPC handlers for Reddit Product Search
 * Sets up communication between renderer and main process
 */

import { ipcMain, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

// Import Reddit API and Report Generator
// Note: In production, these would be imported from the compiled electron module
// For demo purposes, we'll import directly
let redditAPI: any;
let reportGenerator: any;

try {
  // Try to import from the built module
  const reddit = require('electron').reddit;
  redditAPI = reddit.redditAPI;
  reportGenerator = reddit.reportGenerator;
} catch (error) {
  console.error('Failed to load Reddit API from electron module:', error);

  // Fallback: try to import from source
  try {
    const redditModule = require('../lib/browser/api/reddit');
    const reportModule = require('../lib/browser/api/reddit-report-generator');
    redditAPI = redditModule.redditAPI;
    reportGenerator = reportModule.reportGenerator;
  } catch (fallbackError) {
    console.error('Failed to load Reddit API from source:', fallbackError);
  }
}

/**
 * Initialize all Reddit-related IPC handlers
 */
export function setupRedditIpcHandlers() {
  if (!redditAPI || !reportGenerator) {
    console.error('Reddit API or Report Generator not loaded. IPC handlers will not work.');
    return;
  }

  /**
   * Handler: Search for product recommendations
   */
  ipcMain.handle('reddit:search-products', async (event, category: string, options?: {
    maxSubreddits?: number;
    maxPosts?: number;
    maxComments?: number;
  }) => {
    try {
      console.log(`Searching Reddit for category: ${category}`, options);

      // Perform search
      const searchResult = await redditAPI.searchProductRecommendations(
        category,
        options?.maxSubreddits || 5,
        options?.maxPosts || 25,
        options?.maxComments || 50
      );

      // Generate report
      const report = reportGenerator.generateBuyingGuide(category, searchResult);

      console.log(`Search complete. Found ${report.productRecommendations.length} products.`);

      return report;
    } catch (error: any) {
      console.error('Error searching products:', error);
      throw new Error(error.message || 'Failed to search Reddit');
    }
  });

  /**
   * Handler: Search subreddits
   */
  ipcMain.handle('reddit:search-subreddits', async (event, query: string, limit?: number) => {
    try {
      return await redditAPI.searchSubreddits(query, limit || 10);
    } catch (error: any) {
      console.error('Error searching subreddits:', error);
      throw new Error(error.message || 'Failed to search subreddits');
    }
  });

  /**
   * Handler: Get top posts from subreddit
   */
  ipcMain.handle('reddit:get-top-posts', async (event, subreddit: string, timeframe?: string, limit?: number) => {
    try {
      return await redditAPI.getTopPosts(
        subreddit,
        timeframe || 'month',
        limit || 50
      );
    } catch (error: any) {
      console.error('Error getting top posts:', error);
      throw new Error(error.message || 'Failed to get top posts');
    }
  });

  /**
   * Handler: Get comments from post
   */
  ipcMain.handle('reddit:get-comments', async (event, subreddit: string, postId: string, limit?: number) => {
    try {
      return await redditAPI.getComments(subreddit, postId, limit || 100);
    } catch (error: any) {
      console.error('Error getting comments:', error);
      throw new Error(error.message || 'Failed to get comments');
    }
  });

  /**
   * Handler: Format report as HTML
   */
  ipcMain.handle('reddit:format-report-html', async (event, report: any) => {
    try {
      return reportGenerator.formatAsHTML(report);
    } catch (error: any) {
      console.error('Error formatting report:', error);
      throw new Error(error.message || 'Failed to format report');
    }
  });

  /**
   * Handler: Save file to disk
   */
  ipcMain.handle('reddit:save-file', async (event, filename: string, content: string) => {
    try {
      // Show save dialog
      const result = await dialog.showSaveDialog({
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

      // Write file
      await fs.promises.writeFile(result.filePath, content, 'utf-8');

      console.log(`File saved: ${result.filePath}`);

      return { success: true, path: result.filePath };
    } catch (error: any) {
      console.error('Error saving file:', error);
      throw new Error(error.message || 'Failed to save file');
    }
  });

  console.log('Reddit IPC handlers registered successfully');
}

/**
 * Remove all Reddit IPC handlers
 */
export function removeRedditIpcHandlers() {
  ipcMain.removeHandler('reddit:search-products');
  ipcMain.removeHandler('reddit:search-subreddits');
  ipcMain.removeHandler('reddit:get-top-posts');
  ipcMain.removeHandler('reddit:get-comments');
  ipcMain.removeHandler('reddit:format-report-html');
  ipcMain.removeHandler('reddit:save-file');

  console.log('Reddit IPC handlers removed');
}
