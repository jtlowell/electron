# Reddit Product Search - Standalone Demo

A fully functional Electron app that searches Reddit for product recommendations and generates comprehensive buying guides.

## Quick Start (5 Minutes)

### 1. Install Dependencies

```bash
npm install
```

This will install Electron (takes 2-3 minutes).

### 2. Run the Demo

```bash
npm start
```

That's it! The app will open and you can start searching.

## How to Use

1. **Enter a product category** in the search box (e.g., "mechanical keyboards", "headphones", "coffee makers")
2. **Adjust search parameters** (optional):
   - Max Subreddits: How many subreddits to search (default: 5)
   - Max Posts: How many posts per subreddit (default: 25)
   - Max Comments: How many comments per post (default: 50)
3. **Click "Search Reddit"** - The app will:
   - Find relevant subreddits
   - Extract top posts with high engagement
   - Analyze thousands of comments
   - Identify product mentions
   - Generate a comprehensive report
4. **View Results** in four tabs:
   - **Top Products**: Ranked products with mentions and context
   - **Key Insights**: Discussion themes and trends
   - **Top Discussions**: Most valuable posts with summaries
   - **Full Report**: Complete markdown report
5. **Export** your buying guide:
   - Markdown (.md)
   - JSON (.json)
   - HTML (.html)

## Example Searches

Try these product categories:
- "mechanical keyboards"
- "noise cancelling headphones"
- "standing desk"
- "coffee grinder"
- "gaming mouse"
- "4K monitor"
- "wireless earbuds"

## Features

✅ **Real Reddit Data**: Searches actual Reddit discussions  
✅ **Smart Ranking**: Ranks by engagement (votes + comments)  
✅ **Product Detection**: Automatically identifies product mentions  
✅ **Comprehensive Reports**: Detailed buying guides with insights  
✅ **Multiple Formats**: Export as Markdown, JSON, or HTML  
✅ **Beautiful UI**: Clean, modern interface  
✅ **Fast**: Optimized for performance  

## Files

- `main.js` - Main Electron process (Node.js)
- `preload.js` - Secure IPC bridge
- `index.html` - User interface
- `renderer.js` - UI logic
- `reddit-api.js` - Reddit API client
- `report-generator.js` - Report generation engine

## How It Works

1. **Search Phase**: 
   - Queries Reddit's public JSON API for relevant subreddits
   - No authentication required (read-only public data)

2. **Extraction Phase**:
   - Fetches top posts from each subreddit
   - Extracts comments from high-signal posts
   - Ranks content by engagement metrics

3. **Analysis Phase**:
   - Identifies product names using pattern matching
   - Extracts context around mentions
   - Generates key insights and themes

4. **Report Phase**:
   - Aggregates all findings
   - Ranks products by mentions and scores
   - Formats output in multiple formats

## Architecture

```
┌─────────────────┐
│   Renderer      │  (HTML/CSS/JS in browser)
│   - index.html  │
│   - renderer.js │
└────────┬────────┘
         │ IPC (secure)
         │
┌────────▼────────┐
│   Main Process  │  (Node.js)
│   - main.js     │
│   - reddit-api  │
│   - report-gen  │
└─────────────────┘
```

## Security

- ✅ Context isolation enabled
- ✅ Node integration disabled in renderer
- ✅ Secure IPC via contextBridge
- ✅ No remote code execution
- ✅ Read-only Reddit access

## Troubleshooting

### "Failed to search Reddit" Error
- Check your internet connection
- Reddit may be rate-limiting (wait a minute and try again)
- Try a different search term

### Empty Results
- Try broader search terms
- Increase "Max Subreddits" parameter
- Some categories may not have active subreddits

### Slow Performance
- Reduce search parameters (fewer subreddits/posts)
- Reddit API may be slow during peak hours
- Large categories take longer to process

## Technical Details

**Reddit API**: Uses public JSON endpoints (https://www.reddit.com/.json)  
**Rate Limiting**: ~60 requests/minute (built-in delays)  
**Data Format**: JSON from Reddit, converted to structured objects  
**Signal Algorithm**: `log10(votes) * 0.7 + log10(comments) * 0.3`  
**Product Extraction**: Regex patterns for brand+model, quoted text, common patterns  

## License

MIT License - Free to use and modify

## Credits

Built with Electron and Reddit's public API.
