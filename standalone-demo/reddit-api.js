/**
 * Reddit API integration for product search and recommendation extraction
 */

const https = require('https');

class RedditAPI {
  constructor() {
    this.baseUrl = 'https://www.reddit.com';
    this.userAgent = 'Electron Reddit Product Search/1.0';
  }

  /**
   * Make HTTP request to Reddit
   */
  async fetch(url) {
    return new Promise((resolve, reject) => {
      https.get(url, {
        headers: {
          'User-Agent': this.userAgent
        }
      }, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`Reddit API error: ${res.statusCode}`));
          }
        });
      }).on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Search for subreddits relevant to a product category
   */
  async searchSubreddits(query, limit = 10) {
    const url = `${this.baseUrl}/subreddits/search.json?q=${encodeURIComponent(query)}&limit=${limit}`;

    try {
      const data = await this.fetch(url);

      return data.data.children.map(child => ({
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
  async getTopPosts(subreddit, timeframe = 'month', limit = 50) {
    const url = `${this.baseUrl}/r/${subreddit}/top.json?t=${timeframe}&limit=${limit}`;

    try {
      const data = await this.fetch(url);

      return data.data.children.map(child => ({
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
   * Fetch comments from a post
   */
  async getComments(subreddit, postId, limit = 100) {
    const url = `${this.baseUrl}/r/${subreddit}/comments/${postId}.json?limit=${limit}`;

    try {
      const data = await this.fetch(url);

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
  parseComments(children) {
    const comments = [];

    for (const child of children) {
      if (child.kind === 'more') continue;

      const data = child.data;
      const comment = {
        id: data.id,
        author: data.author || '[deleted]',
        body: data.body || '',
        score: data.score || 0,
        created: data.created_utc
      };

      if (data.replies && data.replies.data && data.replies.data.children) {
        comment.replies = this.parseComments(data.replies.data.children);
      }

      comments.push(comment);
    }

    return comments;
  }

  /**
   * Rank posts by signal strength
   */
  rankPostsBySignal(posts) {
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
  calculateSignal(post) {
    const voteWeight = 0.7;
    const commentWeight = 0.3;

    const voteScore = Math.log10(Math.max(1, post.score));
    const commentScore = Math.log10(Math.max(1, post.numComments));

    return (voteScore * voteWeight) + (commentScore * commentWeight);
  }

  /**
   * Complete product search workflow
   */
  async searchProductRecommendations(category, maxSubreddits = 5, maxPostsPerSubreddit = 25, maxCommentsPerPost = 50) {
    try {
      // Step 1: Find relevant subreddits
      const subreddits = await this.searchSubreddits(category, maxSubreddits);

      if (subreddits.length === 0) {
        throw new Error(`No subreddits found for category: ${category}`);
      }

      // Step 2: Fetch top posts from each subreddit
      const allPosts = [];

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
      const topPosts = rankedPosts.slice(0, 10);
      const comments = new Map();

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

module.exports = { RedditAPI };
