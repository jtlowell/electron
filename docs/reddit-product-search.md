# Reddit Product Search Feature

A powerful feature for Electron that searches Reddit for product recommendations and generates comprehensive buying guides from community discussions.

## Overview

The Reddit Product Search feature allows users to:
- Search Reddit for subreddits relevant to a product category
- Extract high-quality posts and comments based on engagement metrics
- Automatically identify product mentions and recommendations
- Generate detailed buying guides with insights and recommendations
- Export reports in multiple formats (Markdown, JSON, HTML)

## Architecture

### Core Components

1. **Reddit API Module** (`lib/browser/api/reddit.ts`)
   - Interfaces with Reddit's public JSON API
   - Fetches subreddits, posts, and comments
   - Ranks content by signal strength (votes + comments)
   - No authentication required (read-only public data)

2. **Report Generator** (`lib/browser/api/reddit-report-generator.ts`)
   - Processes extracted Reddit data
   - Identifies product mentions using pattern matching
   - Generates key insights and recommendations
   - Formats reports in multiple output formats

3. **IPC Handlers** (`default_app/reddit-ipc-handler.ts`)
   - Bridges main process (Node.js) and renderer process
   - Exposes Reddit API to web pages securely
   - Handles file saving via system dialogs

4. **Demo UI** (`default_app/reddit-search.html`)
   - Interactive web interface
   - Real-time search and report generation
   - Tabbed results view (Products, Insights, Discussions, Report)

## Usage

### Basic Example

```javascript
const { reddit } = require('electron');

// Search for product recommendations
const searchResult = await reddit.redditAPI.searchProductRecommendations(
  'mechanical keyboards',
  5,  // max subreddits
  25, // max posts per subreddit
  50  // max comments per post
);

// Generate buying guide
const report = reddit.reportGenerator.generateBuyingGuide(
  'mechanical keyboards',
  searchResult
);

// Export as markdown
const markdown = reddit.reportGenerator.formatAsMarkdown(report);
console.log(markdown);
```

### API Reference

#### RedditAPI

##### `searchSubreddits(query, limit)`
Search for subreddits by keyword.

**Parameters:**
- `query` (string): Search term
- `limit` (number, optional): Max results (default: 10)

**Returns:** `Promise<SubredditInfo[]>`

##### `getTopPosts(subreddit, timeframe, limit)`
Fetch top posts from a subreddit.

**Parameters:**
- `subreddit` (string): Subreddit name (without r/)
- `timeframe` (string, optional): 'day', 'week', 'month', 'year', 'all' (default: 'month')
- `limit` (number, optional): Max posts (default: 50)

**Returns:** `Promise<RedditPost[]>`

##### `getComments(subreddit, postId, limit)`
Fetch comments from a post.

**Parameters:**
- `subreddit` (string): Subreddit name
- `postId` (string): Post ID
- `limit` (number, optional): Max comments (default: 100)

**Returns:** `Promise<RedditComment[]>`

##### `searchProductRecommendations(category, maxSubreddits, maxPosts, maxComments)`
Complete workflow: search subreddits, fetch posts, extract comments.

**Parameters:**
- `category` (string): Product category to search
- `maxSubreddits` (number, optional): Max subreddits to search (default: 5)
- `maxPosts` (number, optional): Max posts per subreddit (default: 25)
- `maxComments` (number, optional): Max comments per post (default: 50)

**Returns:** `Promise<ProductSearchResult>`

#### ReportGenerator

##### `generateBuyingGuide(category, searchResult)`
Generate a comprehensive buying guide from search results.

**Parameters:**
- `category` (string): Product category name
- `searchResult` (ProductSearchResult): Reddit search results

**Returns:** `BuyingGuideReport`

##### `formatAsMarkdown(report)`
Format report as Markdown text.

**Returns:** `string`

##### `formatAsJSON(report)`
Format report as JSON.

**Returns:** `string`

##### `formatAsHTML(report)`
Format report as standalone HTML page.

**Returns:** `string`

## Data Structures

### RedditPost
```typescript
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
```

### BuyingGuideReport
```typescript
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
}
```

## Demo Application

The feature includes a complete demo application showcasing all capabilities.

### Running the Demo

```bash
# From the electron repository root
npm start default_app/reddit-search.html
```

Or with the built electron binary:

```bash
./out/Release/electron default_app/reddit-search.html
```

### Demo Features

1. **Interactive Search**
   - Enter any product category
   - Configure search parameters (subreddits, posts, comments)
   - Real-time progress indication

2. **Results Tabs**
   - **Top Products**: Ranked product mentions with context
   - **Key Insights**: Automatically extracted themes and trends
   - **Top Discussions**: Most valuable posts with summaries
   - **Full Report**: Complete markdown report

3. **Export Options**
   - Export as Markdown (.md)
   - Export as JSON (.json)
   - Export as HTML (.html)

## Implementation Details

### Reddit API Access

The feature uses Reddit's public JSON API, which doesn't require authentication:
- Endpoint: `https://www.reddit.com/`
- Format: Append `.json` to any Reddit URL
- Rate limiting: 60 requests per minute (built-in delay recommended)
- User-Agent: Required (set to "Electron Reddit Product Search/1.0")

### Signal Ranking Algorithm

Posts and comments are ranked by "signal strength":
```javascript
signal = (log10(votes) * 0.7) + (log10(comments) * 0.3)
```

This balances popularity (votes) with engagement (comments), using logarithmic scale to handle outliers.

### Product Extraction

The report generator uses multiple heuristics to identify product names:
1. Brand + Model pattern (e.g., "Sony WH-1000XM4")
2. Common product patterns (e.g., "AirPods Pro", "RTX 3080")
3. Quoted text containing uppercase/numbers
4. Context extraction around mentions

### Security Considerations

- **Content Security Policy**: Demo UI uses strict CSP
- **Context Isolation**: IPC bridge via contextBridge
- **Sandboxed Renderer**: No direct Node.js access from web pages
- **Trusted Origins**: IPC handlers verify sender origin
- **Input Validation**: All user inputs sanitized

## Performance

Typical search performance:
- 5 subreddits × 25 posts = ~7-10 seconds
- 10 subreddits × 50 posts = ~15-20 seconds
- Parallel requests where possible
- Progress feedback via loading indicators

Memory usage:
- ~50MB for 1000 posts + comments
- Streaming where possible to minimize buffering

## Limitations

1. **Public Data Only**: Can only access public Reddit content
2. **Rate Limiting**: Reddit limits requests (use delays between calls)
3. **Pattern Matching**: Product extraction uses heuristics (not 100% accurate)
4. **No Real-time**: Fetches static data, not live updates
5. **English Focused**: Pattern matching optimized for English text

## Future Enhancements

Potential improvements:
- OAuth authentication for higher rate limits
- Machine learning for better product extraction
- Sentiment analysis of comments
- Price tracking integration
- Comparison tables
- Image analysis from posts
- Multi-language support

## Troubleshooting

### "Failed to search Reddit" Error
- Check internet connection
- Verify Reddit is accessible
- Check User-Agent header is set
- Reduce concurrent requests

### Empty Results
- Try broader search terms
- Increase max subreddits/posts
- Check if subreddit exists and is public
- Verify timeframe (try 'all' instead of 'day')

### Slow Performance
- Reduce maxSubreddits, maxPosts, maxComments
- Reddit API may be slow during peak times
- Check network latency

## Examples

### Search for Gaming Headsets
```javascript
const result = await reddit.redditAPI.searchProductRecommendations(
  'gaming headsets',
  5, 25, 50
);

const report = reddit.reportGenerator.generateBuyingGuide(
  'gaming headsets',
  result
);

console.log('Top Products:');
report.productRecommendations.slice(0, 5).forEach((product, i) => {
  console.log(`${i + 1}. ${product.productName} (${product.mentions} mentions)`);
});
```

### Export to File
```javascript
const fs = require('fs');
const markdown = reddit.reportGenerator.formatAsMarkdown(report);
fs.writeFileSync('buying-guide.md', markdown);
```

### Custom Search
```javascript
// Find specific subreddit
const subreddits = await reddit.redditAPI.searchSubreddits('mechanical keyboards');
console.log(subreddits.map(s => s.displayName));

// Get posts from specific subreddit
const posts = await reddit.redditAPI.getTopPosts('MechanicalKeyboards', 'month', 50);

// Get comments from specific post
const comments = await reddit.redditAPI.getComments('MechanicalKeyboards', 'abc123');
```

## License

This feature is part of Electron and follows the same MIT license.

## Contributing

Contributions welcome! Areas for improvement:
- Better product name extraction algorithms
- Additional report formats (PDF, CSV)
- Visualization components (charts, graphs)
- Caching layer for repeated searches
- Unit tests and integration tests

Please follow the Electron contribution guidelines when submitting PRs.
