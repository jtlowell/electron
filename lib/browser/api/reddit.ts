/**
 * Reddit API integration for product search and recommendation extraction
 */

import { net } from 'electron/main';

export interface RedditPost {
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

export interface RedditComment {
  id: string;
  author: string;
  body: string;
  score: number;
  created: number;
  replies?: RedditComment[];
}

export interface SubredditInfo {
  name: string;
  displayName: string;
  subscribers: number;
  description: string;
  publicDescription: string;
}

export interface ProductSearchResult {
  subreddits: SubredditInfo[];
  posts: RedditPost[];
  comments: Map<string, RedditComment[]>;
}

/**
 * Reddit API client for searching and extracting product recommendations
 */
export class RedditAPI {
  private readonly baseUrl = 'https://www.reddit.com';
  private readonly userAgent = 'Electron Reddit Product Search/1.0';

  /**
   * Search for subreddits relevant to a product category
   */
  async searchSubreddits(query: string, limit: number = 10): Promise<SubredditInfo[]> {
    const url = `${this.baseUrl}/subreddits/search.json?q=${encodeURIComponent(query)}&limit=${limit}`;

    try {
      const response = await net.fetch(url, {
        headers: {
          'User-Agent': this.userAgent
        }
      });

      if (!response.ok) {
        throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
      }

      const data: any = await response.json();

      return data.data.children.map((child: any) => ({
        name: child.data.name,
        displayName: child.data.display_name,
        subscribers: child.data.subscribers || 0,
        description: child.data.description || '',
        publicDescription: child.data.public_description || ''
      }));
    } catch (error) {
      console.error('Error searching subreddits:', error);
      throw error;
    }
  }

  /**
   * Fetch top posts from a subreddit with high engagement
   */
  async getTopPosts(
    subreddit: string,
    timeframe: 'day' | 'week' | 'month' | 'year' | 'all' = 'month',
    limit: number = 50
  ): Promise<RedditPost[]> {
    const url = `${this.baseUrl}/r/${subreddit}/top.json?t=${timeframe}&limit=${limit}`;

    try {
      const response = await net.fetch(url, {
        headers: {
          'User-Agent': this.userAgent
        }
      });

      if (!response.ok) {
        throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
      }

      const data: any = await response.json();

      return data.data.children.map((child: any) => ({
        id: child.data.id,
        title: child.data.title,
        subreddit: child.data.subreddit,
        author: child.data.author,
        score: child.data.score,
        numComments: child.data.num_comments,
        url: child.data.url,
        selftext: child.data.selftext || '',
        created: child.data.created_utc,
        permalink: child.data.permalink
      }));
    } catch (error) {
      console.error('Error fetching top posts:', error);
      throw error;
    }
  }

  /**
   * Search for posts containing specific keywords in a subreddit
   */
  async searchPosts(
    subreddit: string,
    query: string,
    limit: number = 50,
    sort: 'relevance' | 'hot' | 'top' | 'new' = 'top'
  ): Promise<RedditPost[]> {
    const url = `${this.baseUrl}/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&sort=${sort}&limit=${limit}`;

    try {
      const response = await net.fetch(url, {
        headers: {
          'User-Agent': this.userAgent
        }
      });

      if (!response.ok) {
        throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
      }

      const data: any = await response.json();

      return data.data.children.map((child: any) => ({
        id: child.data.id,
        title: child.data.title,
        subreddit: child.data.subreddit,
        author: child.data.author,
        score: child.data.score,
        numComments: child.data.num_comments,
        url: child.data.url,
        selftext: child.data.selftext || '',
        created: child.data.created_utc,
        permalink: child.data.permalink
      }));
    } catch (error) {
      console.error('Error searching posts:', error);
      throw error;
    }
  }

  /**
   * Fetch comments from a post
   */
  async getComments(subreddit: string, postId: string, limit: number = 100): Promise<RedditComment[]> {
    const url = `${this.baseUrl}/r/${subreddit}/comments/${postId}.json?limit=${limit}`;

    try {
      const response = await net.fetch(url, {
        headers: {
          'User-Agent': this.userAgent
        }
      });

      if (!response.ok) {
        throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
      }

      const data: any = await response.json();

      // data[0] is the post, data[1] is the comments
      if (!data[1] || !data[1].data || !data[1].data.children) {
        return [];
      }

      return this.parseComments(data[1].data.children);
    } catch (error) {
      console.error('Error fetching comments:', error);
      throw error;
    }
  }

  /**
   * Parse Reddit comment tree recursively
   */
  private parseComments(children: any[]): RedditComment[] {
    const comments: RedditComment[] = [];

    for (const child of children) {
      if (child.kind === 'more') continue; // Skip "load more" markers

      const data = child.data;
      const comment: RedditComment = {
        id: data.id,
        author: data.author || '[deleted]',
        body: data.body || '',
        score: data.score || 0,
        created: data.created_utc
      };

      // Parse nested replies
      if (data.replies && data.replies.data && data.replies.data.children) {
        comment.replies = this.parseComments(data.replies.data.children);
      }

      comments.push(comment);
    }

    return comments;
  }

  /**
   * Rank posts by signal strength (combination of votes and comments)
   */
  rankPostsBySignal(posts: RedditPost[]): RedditPost[] {
    return posts
      .map(post => ({
        ...post,
        signal: this.calculateSignal(post)
      }))
      .sort((a, b) => b.signal - a.signal)
      .map(({ signal, ...post }) => post);
  }

  /**
   * Calculate signal strength for a post
   */
  private calculateSignal(post: RedditPost): number {
    // Weighted combination: 70% votes, 30% comments
    // Normalized to account for different scales
    const voteWeight = 0.7;
    const commentWeight = 0.3;

    // Use log scale to handle large numbers
    const voteScore = Math.log10(Math.max(1, post.score));
    const commentScore = Math.log10(Math.max(1, post.numComments));

    return (voteScore * voteWeight) + (commentScore * commentWeight);
  }

  /**
   * Rank comments by score
   */
  rankCommentsByScore(comments: RedditComment[]): RedditComment[] {
    return [...comments].sort((a, b) => b.score - a.score);
  }

  /**
   * Extract all comments from nested structure into flat array
   */
  flattenComments(comments: RedditComment[]): RedditComment[] {
    const flat: RedditComment[] = [];

    const traverse = (comments: RedditComment[]) => {
      for (const comment of comments) {
        flat.push(comment);
        if (comment.replies && comment.replies.length > 0) {
          traverse(comment.replies);
        }
      }
    };

    traverse(comments);
    return flat;
  }

  /**
   * Complete product search workflow
   */
  async searchProductRecommendations(
    category: string,
    maxSubreddits: number = 5,
    maxPostsPerSubreddit: number = 25,
    maxCommentsPerPost: number = 50
  ): Promise<ProductSearchResult> {
    try {
      // Step 1: Find relevant subreddits
      const subreddits = await this.searchSubreddits(category, maxSubreddits);

      if (subreddits.length === 0) {
        throw new Error(`No subreddits found for category: ${category}`);
      }

      // Step 2: Fetch top posts from each subreddit
      const allPosts: RedditPost[] = [];

      for (const subreddit of subreddits) {
        try {
          const posts = await this.getTopPosts(
            subreddit.displayName,
            'month',
            maxPostsPerSubreddit
          );
          allPosts.push(...posts);
        } catch (error) {
          console.warn(`Failed to fetch posts from r/${subreddit.displayName}:`, error);
        }
      }

      // Step 3: Rank posts by signal
      const rankedPosts = this.rankPostsBySignal(allPosts);

      // Step 4: Fetch comments from top posts
      const topPosts = rankedPosts.slice(0, 10); // Get top 10 posts
      const comments = new Map<string, RedditComment[]>();

      for (const post of topPosts) {
        try {
          const postComments = await this.getComments(
            post.subreddit,
            post.id,
            maxCommentsPerPost
          );
          comments.set(post.id, postComments);
        } catch (error) {
          console.warn(`Failed to fetch comments for post ${post.id}:`, error);
        }
      }

      return {
        subreddits,
        posts: rankedPosts,
        comments
      };
    } catch (error) {
      console.error('Error in product search workflow:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const redditAPI = new RedditAPI();
