/**
 * Preload script for Reddit Product Search demo
 * Exposes Reddit API functions to the renderer process via contextBridge
 */

const { ipcRenderer, contextBridge, shell } = require('electron/renderer');

// Expose Reddit API to renderer process
contextBridge.exposeInMainWorld('electronReddit', {
  /**
   * Search for product recommendations on Reddit
   */
  searchProducts: async (category: string, options?: {
    maxSubreddits?: number;
    maxPosts?: number;
    maxComments?: number;
  }) => {
    return await ipcRenderer.invoke('reddit:search-products', category, options);
  },

  /**
   * Search subreddits by keyword
   */
  searchSubreddits: async (query: string, limit?: number) => {
    return await ipcRenderer.invoke('reddit:search-subreddits', query, limit);
  },

  /**
   * Get top posts from a subreddit
   */
  getTopPosts: async (subreddit: string, timeframe?: string, limit?: number) => {
    return await ipcRenderer.invoke('reddit:get-top-posts', subreddit, timeframe, limit);
  },

  /**
   * Get comments from a post
   */
  getComments: async (subreddit: string, postId: string, limit?: number) => {
    return await ipcRenderer.invoke('reddit:get-comments', subreddit, postId, limit);
  },

  /**
   * Format report as HTML
   */
  formatReportAsHTML: async (report: any) => {
    return await ipcRenderer.invoke('reddit:format-report-html', report);
  },

  /**
   * Save file to disk
   */
  saveFile: async (filename: string, content: string) => {
    return await ipcRenderer.invoke('reddit:save-file', filename, content);
  },

  /**
   * Open URL in external browser
   */
  openExternal: async (url: string) => {
    return await shell.openExternal(url);
  }
});
