/**
 * Generate buying guides and product review reports from Reddit data
 */

import type { RedditPost, RedditComment, ProductSearchResult } from './reddit';

export interface ProductMention {
  productName: string;
  mentions: number;
  totalScore: number;
  averageScore: number;
  sources: {
    postId: string;
    commentId?: string;
    text: string;
    score: number;
  }[];
}

export interface BuyingGuideReport {
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
  topPosts: {
    title: string;
    subreddit: string;
    score: number;
    numComments: number;
    url: string;
    summary: string;
  }[];
  topComments: {
    text: string;
    score: number;
    author: string;
    postTitle: string;
  }[];
  rawData: {
    posts: RedditPost[];
    commentsByPost: Map<string, RedditComment[]>;
  };
}

/**
 * Report generator for creating buying guides from Reddit data
 */
export class ReportGenerator {
  /**
   * Generate a complete buying guide report from search results
   */
  generateBuyingGuide(
    category: string,
    searchResult: ProductSearchResult
  ): BuyingGuideReport {
    const { subreddits, posts, comments } = searchResult;

    // Calculate total comments
    let totalComments = 0;
    for (const commentList of comments.values()) {
      totalComments += this.countAllComments(commentList);
    }

    // Extract product mentions
    const productMentions = this.extractProductMentions(posts, comments);

    // Generate key insights
    const keyInsights = this.generateKeyInsights(posts, comments, productMentions);

    // Get top posts
    const topPosts = posts.slice(0, 10).map(post => ({
      title: post.title,
      subreddit: post.subreddit,
      score: post.score,
      numComments: post.numComments,
      url: `https://reddit.com${post.permalink}`,
      summary: this.generatePostSummary(post)
    }));

    // Get top comments
    const topComments = this.getTopComments(posts, comments, 20);

    return {
      category,
      generatedAt: new Date(),
      summary: {
        totalSubreddits: subreddits.length,
        totalPosts: posts.length,
        totalComments,
        topSubreddits: subreddits
          .sort((a, b) => b.subscribers - a.subscribers)
          .slice(0, 5)
          .map(s => s.displayName)
      },
      productRecommendations: productMentions,
      keyInsights,
      topPosts,
      topComments,
      rawData: {
        posts,
        commentsByPost: comments
      }
    };
  }

  /**
   * Extract and rank product mentions from posts and comments
   */
  private extractProductMentions(
    posts: RedditPost[],
    commentsByPost: Map<string, RedditComment[]>
  ): ProductMention[] {
    const productMap = new Map<string, ProductMention>();

    // Extract from post titles and bodies
    for (const post of posts) {
      const products = this.extractProductNames(post.title + ' ' + post.selftext);

      for (const product of products) {
        if (!productMap.has(product)) {
          productMap.set(product, {
            productName: product,
            mentions: 0,
            totalScore: 0,
            averageScore: 0,
            sources: []
          });
        }

        const mention = productMap.get(product)!;
        mention.mentions++;
        mention.totalScore += post.score;
        mention.sources.push({
          postId: post.id,
          text: this.extractContextAroundProduct(post.title + ' ' + post.selftext, product),
          score: post.score
        });
      }
    }

    // Extract from comments
    for (const [postId, comments] of commentsByPost.entries()) {
      const post = posts.find(p => p.id === postId);
      if (!post) continue;

      const flatComments = this.flattenComments(comments);

      for (const comment of flatComments) {
        const products = this.extractProductNames(comment.body);

        for (const product of products) {
          if (!productMap.has(product)) {
            productMap.set(product, {
              productName: product,
              mentions: 0,
              totalScore: 0,
              averageScore: 0,
              sources: []
            });
          }

          const mention = productMap.get(product)!;
          mention.mentions++;
          mention.totalScore += comment.score;
          mention.sources.push({
            postId: post.id,
            commentId: comment.id,
            text: this.extractContextAroundProduct(comment.body, product),
            score: comment.score
          });
        }
      }
    }

    // Calculate average scores and sort
    const productMentions = Array.from(productMap.values()).map(mention => ({
      ...mention,
      averageScore: mention.totalScore / mention.mentions
    }));

    // Sort by combination of mentions and average score
    return productMentions.sort((a, b) => {
      const scoreA = a.mentions * Math.log10(Math.max(1, a.averageScore + 1));
      const scoreB = b.mentions * Math.log10(Math.max(1, b.averageScore + 1));
      return scoreB - scoreA;
    });
  }

  /**
   * Extract potential product names from text using heuristics
   */
  private extractProductNames(text: string): string[] {
    const products = new Set<string>();

    // Pattern 1: Capitalized brand names followed by model numbers/names
    // e.g., "Sony WH-1000XM4", "MacBook Pro", "iPhone 14"
    const brandModelPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+([A-Z0-9][-A-Z0-9]+)\b/g;
    let match;
    while ((match = brandModelPattern.exec(text)) !== null) {
      products.add(match[0]);
    }

    // Pattern 2: Common product name patterns
    // e.g., "AirPods Pro", "PlayStation 5", "RTX 3080"
    const productPattern = /\b(?:(?:[A-Z][a-z]+)+(?:\s+(?:Pro|Plus|Max|Ultra|Air|Mini|Lite|XL|S|X))?|(?:[A-Z]+\s+\d+(?:\s*[A-Z]+)?)|(?:\d+[A-Z]+\s+\d+))\b/g;
    while ((match = productPattern.exec(text)) !== null) {
      products.add(match[0]);
    }

    // Pattern 3: Quoted product names
    const quotedPattern = /"([^"]+)"/g;
    while ((match = quotedPattern.exec(text)) !== null) {
      const quoted = match[1].trim();
      // Only include if it looks like a product name (contains uppercase or numbers)
      if (/[A-Z0-9]/.test(quoted) && quoted.length < 50) {
        products.add(quoted);
      }
    }

    return Array.from(products).filter(p => p.length > 2 && p.length < 100);
  }

  /**
   * Extract context around a product mention
   */
  private extractContextAroundProduct(text: string, product: string, contextLength: number = 100): string {
    const index = text.toLowerCase().indexOf(product.toLowerCase());
    if (index === -1) return text.substring(0, 200);

    const start = Math.max(0, index - contextLength);
    const end = Math.min(text.length, index + product.length + contextLength);

    let context = text.substring(start, end);
    if (start > 0) context = '...' + context;
    if (end < text.length) context = context + '...';

    return context;
  }

  /**
   * Generate key insights from the data
   */
  private generateKeyInsights(
    posts: RedditPost[],
    commentsByPost: Map<string, RedditComment[]>,
    productMentions: ProductMention[]
  ): string[] {
    const insights: string[] = [];

    // Insight 1: Top recommended products
    if (productMentions.length > 0) {
      const topProducts = productMentions.slice(0, 5).map(p => p.productName);
      insights.push(
        `Most mentioned products: ${topProducts.join(', ')}`
      );
    }

    // Insight 2: Most active discussions
    const topDiscussions = posts
      .sort((a, b) => b.numComments - a.numComments)
      .slice(0, 3);

    if (topDiscussions.length > 0) {
      insights.push(
        `Most discussed topics: ${topDiscussions.map(p => `"${p.title}" (${p.numComments} comments)`).join(', ')}`
      );
    }

    // Insight 3: Highest rated posts
    const topRated = posts
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (topRated.length > 0) {
      insights.push(
        `Highest rated discussions: ${topRated.map(p => `"${p.title}" (${p.score} upvotes)`).join(', ')}`
      );
    }

    // Insight 4: Common themes
    const commonWords = this.findCommonWords(posts);
    if (commonWords.length > 0) {
      insights.push(
        `Common discussion themes: ${commonWords.slice(0, 10).join(', ')}`
      );
    }

    // Insight 5: Product comparison mentions
    const comparisons = this.findComparisons(posts, commentsByPost);
    if (comparisons.length > 0) {
      insights.push(
        `Popular comparisons: ${comparisons.slice(0, 5).join(', ')}`
      );
    }

    return insights;
  }

  /**
   * Find common words in post titles
   */
  private findCommonWords(posts: RedditPost[]): string[] {
    const wordCount = new Map<string, number>();

    // Common words to exclude
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
      'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her',
      'its', 'our', 'their', 'what', 'which', 'who', 'when', 'where', 'why', 'how'
    ]);

    for (const post of posts) {
      const words = post.title.toLowerCase().split(/\W+/);
      for (const word of words) {
        if (word.length > 3 && !stopWords.has(word)) {
          wordCount.set(word, (wordCount.get(word) || 0) + 1);
        }
      }
    }

    return Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word);
  }

  /**
   * Find comparison mentions (e.g., "A vs B")
   */
  private findComparisons(
    posts: RedditPost[],
    commentsByPost: Map<string, RedditComment[]>
  ): string[] {
    const comparisons = new Set<string>();

    const comparisonPattern = /\b([A-Z][A-Za-z0-9\s]+?)\s+(?:vs\.?|versus|or)\s+([A-Z][A-Za-z0-9\s]+?)\b/gi;

    // Check post titles
    for (const post of posts) {
      let match;
      while ((match = comparisonPattern.exec(post.title)) !== null) {
        const item1 = match[1].trim();
        const item2 = match[2].trim();
        if (item1.length < 50 && item2.length < 50) {
          comparisons.add(`${item1} vs ${item2}`);
        }
      }
    }

    return Array.from(comparisons).slice(0, 10);
  }

  /**
   * Generate a summary for a post
   */
  private generatePostSummary(post: RedditPost): string {
    const text = post.selftext || post.title;
    const maxLength = 200;

    if (text.length <= maxLength) {
      return text;
    }

    // Find the first sentence or paragraph
    const firstSentence = text.match(/^.+?[.!?]\s/);
    if (firstSentence && firstSentence[0].length <= maxLength) {
      return firstSentence[0].trim();
    }

    return text.substring(0, maxLength).trim() + '...';
  }

  /**
   * Get top comments across all posts
   */
  private getTopComments(
    posts: RedditPost[],
    commentsByPost: Map<string, RedditComment[]>,
    limit: number
  ): Array<{
    text: string;
    score: number;
    author: string;
    postTitle: string;
  }> {
    const allComments: Array<{
      text: string;
      score: number;
      author: string;
      postTitle: string;
    }> = [];

    for (const [postId, comments] of commentsByPost.entries()) {
      const post = posts.find(p => p.id === postId);
      if (!post) continue;

      const flatComments = this.flattenComments(comments);

      for (const comment of flatComments) {
        // Skip very short or deleted comments
        if (comment.body.length < 50 || comment.author === '[deleted]') {
          continue;
        }

        allComments.push({
          text: comment.body,
          score: comment.score,
          author: comment.author,
          postTitle: post.title
        });
      }
    }

    return allComments
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Flatten nested comment structure
   */
  private flattenComments(comments: RedditComment[]): RedditComment[] {
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
   * Count all comments including nested replies
   */
  private countAllComments(comments: RedditComment[]): number {
    return this.flattenComments(comments).length;
  }

  /**
   * Format report as markdown
   */
  formatAsMarkdown(report: BuyingGuideReport): string {
    const lines: string[] = [];

    // Title
    lines.push(`# Buying Guide: ${report.category}`);
    lines.push('');
    lines.push(`*Generated on ${report.generatedAt.toLocaleString()}*`);
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push('');
    lines.push(`- **Subreddits Analyzed**: ${report.summary.totalSubreddits}`);
    lines.push(`- **Posts Reviewed**: ${report.summary.totalPosts}`);
    lines.push(`- **Comments Analyzed**: ${report.summary.totalComments}`);
    lines.push(`- **Top Communities**: ${report.summary.topSubreddits.join(', ')}`);
    lines.push('');

    // Product Recommendations
    lines.push('## Top Product Recommendations');
    lines.push('');

    if (report.productRecommendations.length > 0) {
      for (let i = 0; i < Math.min(10, report.productRecommendations.length); i++) {
        const product = report.productRecommendations[i];
        lines.push(`### ${i + 1}. ${product.productName}`);
        lines.push('');
        lines.push(`- **Mentions**: ${product.mentions}`);
        lines.push(`- **Average Score**: ${product.averageScore.toFixed(1)}`);
        lines.push(`- **Total Engagement**: ${product.totalScore}`);
        lines.push('');

        // Show top 3 sources
        const topSources = product.sources
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);

        if (topSources.length > 0) {
          lines.push('**Sample mentions:**');
          lines.push('');
          for (const source of topSources) {
            lines.push(`> ${source.text} *(Score: ${source.score})*`);
            lines.push('');
          }
        }
      }
    } else {
      lines.push('*No specific product mentions found*');
      lines.push('');
    }

    // Key Insights
    lines.push('## Key Insights');
    lines.push('');
    for (const insight of report.keyInsights) {
      lines.push(`- ${insight}`);
    }
    lines.push('');

    // Top Posts
    lines.push('## Most Valuable Discussions');
    lines.push('');
    for (let i = 0; i < Math.min(5, report.topPosts.length); i++) {
      const post = report.topPosts[i];
      lines.push(`### ${i + 1}. ${post.title}`);
      lines.push('');
      lines.push(`- **Subreddit**: r/${post.subreddit}`);
      lines.push(`- **Score**: ${post.score} upvotes`);
      lines.push(`- **Comments**: ${post.numComments}`);
      lines.push(`- **Link**: ${post.url}`);
      lines.push('');
      lines.push(post.summary);
      lines.push('');
    }

    // Top Comments
    lines.push('## Highest-Rated User Feedback');
    lines.push('');
    for (let i = 0; i < Math.min(10, report.topComments.length); i++) {
      const comment = report.topComments[i];
      lines.push(`### Comment from discussion: "${comment.postTitle}"`);
      lines.push('');
      lines.push(`**u/${comment.author}** (${comment.score} upvotes):`);
      lines.push('');
      lines.push(`> ${comment.text.substring(0, 500)}${comment.text.length > 500 ? '...' : ''}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format report as JSON
   */
  formatAsJSON(report: BuyingGuideReport): string {
    // Remove raw data for cleaner output
    const { rawData, ...cleanReport } = report;

    return JSON.stringify(cleanReport, null, 2);
  }

  /**
   * Format report as HTML
   */
  formatAsHTML(report: BuyingGuideReport): string {
    const markdown = this.formatAsMarkdown(report);

    // Simple markdown to HTML conversion
    let html = markdown
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^\- (.+)$/gm, '<li>$1</li>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Buying Guide: ${report.category}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      line-height: 1.6;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
    }
    h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
    h2 { color: #34495e; margin-top: 30px; border-bottom: 2px solid #95a5a6; padding-bottom: 8px; }
    h3 { color: #555; margin-top: 20px; }
    blockquote {
      border-left: 4px solid #3498db;
      margin: 10px 0;
      padding: 10px 20px;
      background: #f8f9fa;
      font-style: italic;
    }
    li { margin: 5px 0; }
    a { color: #3498db; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .metadata { color: #7f8c8d; font-style: italic; }
  </style>
</head>
<body>
  ${html}
</body>
</html>
    `.trim();
  }
}

// Export singleton instance
export const reportGenerator = new ReportGenerator();
