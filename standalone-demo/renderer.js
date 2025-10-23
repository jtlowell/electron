// Reddit Product Search UI Logic

let currentReport = null;

// DOM Elements
const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const maxSubreddits = document.getElementById('maxSubreddits');
const maxPosts = document.getElementById('maxPosts');
const maxComments = document.getElementById('maxComments');

const loading = document.getElementById('loading');
const error = document.getElementById('error');
const results = document.getElementById('results');

const resultsTitle = document.getElementById('resultsTitle');
const statSubreddits = document.getElementById('statSubreddits');
const statPosts = document.getElementById('statPosts');
const statComments = document.getElementById('statComments');

const productList = document.getElementById('productList');
const insightsList = document.getElementById('insightsList');
const postList = document.getElementById('postList');
const reportContent = document.getElementById('reportContent');

const exportMarkdown = document.getElementById('exportMarkdown');
const exportJSON = document.getElementById('exportJSON');
const exportHTML = document.getElementById('exportHTML');

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;

    // Update active tab
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // Update active content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`tab-${tabName}`).classList.add('active');
  });
});

// Search form submission
searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const category = searchInput.value.trim();
  if (!category) return;

  await performSearch(category);
});

// Perform search
async function performSearch(category) {
  try {
    // Show loading state
    loading.classList.add('active');
    error.classList.remove('active');
    results.classList.remove('active');
    searchButton.disabled = true;

    // Get options
    const options = {
      maxSubreddits: parseInt(maxSubreddits.value),
      maxPosts: parseInt(maxPosts.value),
      maxComments: parseInt(maxComments.value)
    };

    // Call Reddit API via IPC
    const report = await window.electronReddit.searchProducts(category, options);

    currentReport = report;

    // Display results
    displayResults(report);

    // Hide loading, show results
    loading.classList.remove('active');
    results.classList.add('active');

  } catch (err) {
    console.error('Search error:', err);
    loading.classList.remove('active');
    error.textContent = `Error: ${err.message || 'Failed to search Reddit. Please try again.'}`;
    error.classList.add('active');
  } finally {
    searchButton.disabled = false;
  }
}

// Display results
function displayResults(report) {
  // Update header
  resultsTitle.textContent = `Buying Guide: ${report.category}`;

  // Update stats
  statSubreddits.textContent = report.summary.totalSubreddits;
  statPosts.textContent = report.summary.totalPosts;
  statComments.textContent = report.summary.totalComments.toLocaleString();

  // Display products
  displayProducts(report.productRecommendations);

  // Display insights
  displayInsights(report.keyInsights);

  // Display top posts
  displayPosts(report.topPosts);

  // Display full report
  displayReport(report);
}

// Display products
function displayProducts(products) {
  productList.innerHTML = '';

  if (products.length === 0) {
    productList.innerHTML = '<p style="text-align: center; color: #657786;">No specific products found in the discussions.</p>';
    return;
  }

  products.slice(0, 10).forEach((product, index) => {
    const card = document.createElement('div');
    card.className = 'product-card';

    const topSources = product.sources
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    card.innerHTML = `
      <div class="product-header">
        <div class="product-name">${index + 1}. ${escapeHtml(product.productName)}</div>
      </div>
      <div class="product-stats">
        <span>📊 ${product.mentions} mentions</span>
        <span>⭐ ${product.averageScore.toFixed(1)} avg score</span>
        <span>💬 ${product.totalScore} total engagement</span>
      </div>
      <div class="product-mentions">
        <strong>Sample mentions:</strong>
        ${topSources.map(source => `
          <div class="mention">
            ${escapeHtml(source.text)}
            <span class="mention-score">(${source.score} upvotes)</span>
          </div>
        `).join('')}
      </div>
    `;

    productList.appendChild(card);
  });
}

// Display insights
function displayInsights(insights) {
  insightsList.innerHTML = '';

  if (insights.length === 0) {
    insightsList.innerHTML = '<p style="text-align: center; color: #657786;">No insights available.</p>';
    return;
  }

  insights.forEach(insight => {
    const div = document.createElement('div');
    div.className = 'insight';
    div.textContent = insight;
    insightsList.appendChild(div);
  });
}

// Display posts
function displayPosts(posts) {
  postList.innerHTML = '';

  if (posts.length === 0) {
    postList.innerHTML = '<p style="text-align: center; color: #657786;">No posts found.</p>';
    return;
  }

  posts.forEach(post => {
    const card = document.createElement('div');
    card.className = 'post-card';

    card.innerHTML = `
      <div class="post-title">${escapeHtml(post.title)}</div>
      <div class="post-meta">
        <span>📍 r/${escapeHtml(post.subreddit)}</span>
        <span>⬆️ ${post.score} upvotes</span>
        <span>💬 ${post.numComments} comments</span>
      </div>
      <div class="post-summary">${escapeHtml(post.summary)}</div>
      <a href="#" class="post-link" onclick="window.electronReddit.openExternal('${post.url}'); return false;">
        View on Reddit →
      </a>
    `;

    postList.appendChild(card);
  });
}

// Display full report
function displayReport(report) {
  const markdown = formatReportAsMarkdown(report);
  reportContent.textContent = markdown;
}

// Format report as markdown (client-side version)
function formatReportAsMarkdown(report) {
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

  lines.push('## Most Valuable Discussions');
  lines.push('');
  report.topPosts.slice(0, 5).forEach((post, i) => {
    lines.push(`### ${i + 1}. ${post.title}`);
    lines.push('');
    lines.push(`- **Subreddit**: r/${post.subreddit}`);
    lines.push(`- **Score**: ${post.score} upvotes`);
    lines.push(`- **Comments**: ${post.numComments}`);
    lines.push(`- **Link**: ${post.url}`);
    lines.push('');
  });

  return lines.join('\n');
}

// Export functions
exportMarkdown.addEventListener('click', async () => {
  if (!currentReport) return;

  const markdown = formatReportAsMarkdown(currentReport);
  await window.electronReddit.saveFile(
    `buying-guide-${currentReport.category}.md`,
    markdown
  );
});

exportJSON.addEventListener('click', async () => {
  if (!currentReport) return;

  const json = JSON.stringify(currentReport, null, 2);
  await window.electronReddit.saveFile(
    `buying-guide-${currentReport.category}.json`,
    json
  );
});

exportHTML.addEventListener('click', async () => {
  if (!currentReport) return;

  const html = await window.electronReddit.formatReportAsHTML(currentReport);
  await window.electronReddit.saveFile(
    `buying-guide-${currentReport.category}.html`,
    html
  );
});

// Utility function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
