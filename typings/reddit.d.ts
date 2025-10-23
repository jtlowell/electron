/**
 * Type definitions for Reddit API module
 */

declare namespace Electron {
  interface RedditPost {
    id: string;
    title: string;
    subreddit: string;
    author: string;
    score: number;
    numComments: number;
    url: string;
    selftext: string;
    created: number;
    permalink: string;
  }

  interface RedditComment {
    id: string;
    author: string;
    body: string;
    score: number;
    created: number;
    replies?: RedditComment[];
  }

  interface SubredditInfo {
    name: string;
    displayName: string;
    subscribers: number;
    description: string;
    publicDescription: string;
  }

  interface ProductSearchResult {
    subreddits: SubredditInfo[];
    posts: RedditPost[];
    comments: Map<string, RedditComment[]>;
  }

  interface ProductMention {
    productName: string;
    mentions: number;
    totalScore: number;
    averageScore: number;
    sources: Array<{
      postId: string;
      commentId?: string;
      text: string;
      score: number;
    }>;
  }

  interface BuyingGuideReport {
    category: string;
    generatedAt: Date;
    summary: {
      totalSubreddits: number;
      totalPosts: number;
      totalComments: number;
      topSubreddits: string[];
    };
    productRecommendations: ProductMention[];
    keyInsights: string[];
    topPosts: Array<{
      title: string;
      subreddit: string;
      score: number;
      numComments: number;
      url: string;
      summary: string;
    }>;
    topComments: Array<{
      text: string;
      score: number;
      author: string;
      postTitle: string;
    }>;
    rawData: {
      posts: RedditPost[];
      commentsByPost: Map<string, RedditComment[]>;
    };
  }

  interface RedditAPI {
    /**
     * Search for subreddits relevant to a product category
     */
    searchSubreddits(query: string, limit?: number): Promise<SubredditInfo[]>;

    /**
     * Fetch top posts from a subreddit with high engagement
     */
    getTopPosts(
      subreddit: string,
      timeframe?: 'day' | 'week' | 'month' | 'year' | 'all',
      limit?: number
    ): Promise<RedditPost[]>;

    /**
     * Search for posts containing specific keywords in a subreddit
     */
    searchPosts(
      subreddit: string,
      query: string,
      limit?: number,
      sort?: 'relevance' | 'hot' | 'top' | 'new'
    ): Promise<RedditPost[]>;

    /**
     * Fetch comments from a post
     */
    getComments(subreddit: string, postId: string, limit?: number): Promise<RedditComment[]>;

    /**
     * Rank posts by signal strength (combination of votes and comments)
     */
    rankPostsBySignal(posts: RedditPost[]): RedditPost[];

    /**
     * Rank comments by score
     */
    rankCommentsByScore(comments: RedditComment[]): RedditComment[];

    /**
     * Extract all comments from nested structure into flat array
     */
    flattenComments(comments: RedditComment[]): RedditComment[];

    /**
     * Complete product search workflow
     */
    searchProductRecommendations(
      category: string,
      maxSubreddits?: number,
      maxPostsPerSubreddit?: number,
      maxCommentsPerPost?: number
    ): Promise<ProductSearchResult>;
  }

  interface ReportGenerator {
    /**
     * Generate a complete buying guide report from search results
     */
    generateBuyingGuide(category: string, searchResult: ProductSearchResult): BuyingGuideReport;

    /**
     * Format report as markdown
     */
    formatAsMarkdown(report: BuyingGuideReport): string;

    /**
     * Format report as JSON
     */
    formatAsJSON(report: BuyingGuideReport): string;

    /**
     * Format report as HTML
     */
    formatAsHTML(report: BuyingGuideReport): string;
  }

  interface Reddit {
    redditAPI: RedditAPI;
    reportGenerator: ReportGenerator;
  }
}

declare module 'electron' {
  const reddit: Electron.Reddit;
}

declare module 'electron/main' {
  const reddit: Electron.Reddit;
}
