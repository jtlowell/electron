/**
 * Generate buying guides and product review reports from Reddit data
 */

class ReportGenerator {
  /**
   * Generate a complete buying guide report from search results
   */
  generateBuyingGuide(category, searchResult) {
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
      rawData: { posts, commentsByPost: comments }
    };
  }

  extractProductMentions(posts, commentsByPost) {
    const productMap = new Map();

    // Extract from posts
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

        const mention = productMap.get(product);
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

          const mention = productMap.get(product);
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

    return productMentions.sort((a, b) => {
      const scoreA = a.mentions * Math.log10(Math.max(1, a.averageScore + 1));
      const scoreB = b.mentions * Math.log10(Math.max(1, b.averageScore + 1));
      return scoreB - scoreA;
    });
  }

  extractProductNames(text) {
    const products = new Set();

    // Blacklist of common non-product words
    const blacklist = new Set([
      'the', 'that', 'this', 'these', 'those', 'there', 'their', 'them',
      'what', 'when', 'where', 'which', 'who', 'why', 'how',
      'with', 'from', 'have', 'been', 'were', 'said', 'will', 'would',
      'could', 'should', 'about', 'into', 'through', 'during', 'before',
      'after', 'above', 'below', 'between', 'under', 'again', 'further',
      'then', 'once', 'here', 'very', 'even', 'back', 'just', 'only',
      'over', 'some', 'such', 'than', 'most', 'other', 'more', 'also',
      'well', 'much', 'many', 'good', 'best', 'better', 'great', 'nice',
      'reddit', 'subreddit', 'post', 'comment', 'user', 'thread', 'link'
    ]);

    // Pattern 1: Brand + Model with numbers (e.g., "Sony WH-1000XM4", "iPhone 14")
    const brandModelPattern = /\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\s+([A-Z0-9]{2,}[-A-Z0-9]*\d+[-A-Z0-9]*)\b/g;
    let match;
    while ((match = brandModelPattern.exec(text)) !== null) {
      const candidate = match[0];
      if (this.isValidProduct(candidate, blacklist)) {
        products.add(candidate);
      }
    }

    // Pattern 2: Product with version suffixes (e.g., "AirPods Pro", "MacBook Air")
    const suffixPattern = /\b([A-Z][a-z]{2,}(?:[A-Z][a-z]+)*)\s+(Pro|Plus|Max|Ultra|Air|Mini|Lite|XL|Studio|Edition)\b/g;
    while ((match = suffixPattern.exec(text)) !== null) {
      const candidate = match[0];
      if (this.isValidProduct(candidate, blacklist) && candidate.length > 5) {
        products.add(candidate);
      }
    }

    // Pattern 3: Model numbers (e.g., "RTX 3080", "MX Keys")
    const modelPattern = /\b([A-Z]{2,}\s+\d{3,}[A-Z]*|[A-Z]{2,}\s+[A-Z][a-z]+)\b/g;
    while ((match = modelPattern.exec(text)) !== null) {
      const candidate = match[0];
      if (this.isValidProduct(candidate, blacklist) && /\d/.test(candidate)) {
        products.add(candidate);
      }
    }

    // Pattern 4: Quoted products with numbers or known suffixes
    const quotedPattern = /"([^"]{4,50})"/g;
    while ((match = quotedPattern.exec(text)) !== null) {
      const quoted = match[1].trim();
      if ((/\d/.test(quoted) || /(Pro|Plus|Max|Ultra|Air|Mini)/.test(quoted)) &&
          this.isValidProduct(quoted, blacklist)) {
        products.add(quoted);
      }
    }

    return Array.from(products).filter(p => {
      // Additional filtering
      const lower = p.toLowerCase();
      return (
        p.length >= 4 &&
        p.length < 100 &&
        !blacklist.has(lower) &&
        !/^(the|that|this|these|those|what|when|where)/i.test(p) &&
        // Must have either a number or a product suffix
        (/\d/.test(p) || /(Pro|Plus|Max|Ultra|Air|Mini|Lite|Studio|Edition)/.test(p))
      );
    });
  }

  isValidProduct(text, blacklist) {
    const lower = text.toLowerCase();
    const words = lower.split(/\s+/);

    // Check if any word is in blacklist
    for (const word of words) {
      if (blacklist.has(word)) {
        return false;
      }
    }

    // Must have at least one uppercase letter and be long enough
    return /[A-Z]/.test(text) && text.length >= 4;
  }

  extractContextAroundProduct(text, product, contextLength = 100) {
    const index = text.toLowerCase().indexOf(product.toLowerCase());
    if (index === -1) return text.substring(0, 200);

    const start = Math.max(0, index - contextLength);
    const end = Math.min(text.length, index + product.length + contextLength);

    let context = text.substring(start, end);
    if (start > 0) context = '...' + context;
    if (end < text.length) context = context + '...';

    return context;
  }

  generateKeyInsights(posts, commentsByPost, productMentions) {
    const insights = [];

    if (productMentions.length > 0) {
      const topProducts = productMentions.slice(0, 5).map(p => p.productName);
      insights.push(`Most mentioned products: ${topProducts.join(', ')}`);
    }

    const topDiscussions = posts
      .sort((a, b) => b.numComments - a.numComments)
      .slice(0, 3);

    if (topDiscussions.length > 0) {
      insights.push(
        `Most discussed topics: ${topDiscussions.map(p => `"${p.title}" (${p.numComments} comments)`).join(', ')}`
      );
    }

    const commonWords = this.findCommonWords(posts);
    if (commonWords.length > 0) {
      insights.push(`Common discussion themes: ${commonWords.slice(0, 10).join(', ')}`);
    }

    return insights;
  }

  findCommonWords(posts) {
    const wordCount = new Map();
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
      'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'
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

  generatePostSummary(post) {
    const text = post.selftext || post.title;
    const maxLength = 200;

    if (text.length <= maxLength) {
      return text;
    }

    const firstSentence = text.match(/^.+?[.!?]\s/);
    if (firstSentence && firstSentence[0].length <= maxLength) {
      return firstSentence[0].trim();
    }

    return text.substring(0, maxLength).trim() + '...';
  }

  getTopComments(posts, commentsByPost, limit) {
    const allComments = [];

    for (const [postId, comments] of commentsByPost.entries()) {
      const post = posts.find(p => p.id === postId);
      if (!post) continue;

      const flatComments = this.flattenComments(comments);

      for (const comment of flatComments) {
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

  flattenComments(comments) {
    const flat = [];

    const traverse = (comments) => {
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

  countAllComments(comments) {
    return this.flattenComments(comments).length;
  }

  formatAsHTML(report) {
    const markdown = this.formatAsMarkdown(report);

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
  </style>
</head>
<body>
  ${html}
</body>
</html>
    `.trim();
  }

  formatAsMarkdown(report) {
    const lines = [];

    lines.push(`# Buying Guide: ${report.category}`);
    lines.push('');
    lines.push(`*Generated on ${new Date(report.generatedAt).toLocaleString()}*`);
    lines.push('');

    lines.push('## Summary');
    lines.push('');
    lines.push(`- **Subreddits Analyzed**: ${report.summary.totalSubreddits}`);
    lines.push(`- **Posts Reviewed**: ${report.summary.totalPosts}`);
    lines.push(`- **Comments Analyzed**: ${report.summary.totalComments.toLocaleString()}`);
    lines.push(`- **Top Communities**: ${report.summary.topSubreddits.join(', ')}`);
    lines.push('');

    lines.push('## Top Product Recommendations');
    lines.push('');

    if (report.productRecommendations.length > 0) {
      report.productRecommendations.slice(0, 10).forEach((product, i) => {
        lines.push(`### ${i + 1}. ${product.productName}`);
        lines.push('');
        lines.push(`- **Mentions**: ${product.mentions}`);
        lines.push(`- **Average Score**: ${product.averageScore.toFixed(1)}`);
        lines.push(`- **Total Engagement**: ${product.totalScore}`);
        lines.push('');
      });
    } else {
      lines.push('*No specific product mentions found*');
      lines.push('');
    }

    lines.push('## Key Insights');
    lines.push('');
    report.keyInsights.forEach(insight => {
      lines.push(`- ${insight}`);
    });
    lines.push('');

    return lines.join('\n');
  }
}

module.exports = { ReportGenerator };
