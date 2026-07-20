```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Comments</title>
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #f0f2f5;
      color: #1a1a2e;
      padding: 2rem;
      min-height: 100vh;
    }

    h1 {
      font-size: 1.75rem;
      margin-bottom: 1.5rem;
      color: #16213e;
    }

    #controls {
      display: flex;
      gap: 1rem;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
    }

    button {
      padding: 0.6rem 1.2rem;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.95rem;
      font-weight: 600;
      transition: background 0.2s, transform 0.1s;
    }

    button:active {
      transform: scale(0.97);
    }

    #fetch-btn {
      background: #0f3460;
      color: #fff;
    }

    #fetch-btn:hover {
      background: #16213e;
    }

    #clear-btn {
      background: #e94560;
      color: #fff;
    }

    #clear-btn:hover {
      background: #c73652;
    }

    #fetch-btn:disabled {
      background: #9aa5b4;
      cursor: not-allowed;
      transform: none;
    }

    #status {
      font-size: 0.9rem;
      color: #555;
      margin-bottom: 1rem;
      min-height: 1.2rem;
    }

    #status.error {
      color: #e94560;
      font-weight: 600;
    }

    #comments-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      max-width: 680px;
    }

    .comment-card {
      background: #fff;
      border-radius: 10px;
      padding: 1.2rem 1.4rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      border-left: 4px solid #0f3460;
      animation: fadeIn 0.3s ease forwards;
      opacity: 0;
    }

    @keyframes fadeIn {
      to { opacity: 1; transform: translateY(0); }
      from { opacity: 0; transform: translateY(8px); }
    }

    .comment-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.5rem;
      margin-bottom: 0.6rem;
    }

    .comment-name {
      font-weight: 700;
      font-size: 0.95rem;
      color: #0f3460;
      text-transform: capitalize;
    }

    .comment-id {
      font-size: 0.75rem;
      color: #aaa;
      white-space: nowrap;
    }

    .comment-email {
      font-size: 0.8rem;
      color: #888;
      margin-bottom: 0.75rem;
      word-break: break-all;
    }

    .comment-body {
      font-size: 0.9rem;
      line-height: 1.6;
      color: #333;
    }

    #skeleton-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      max-width: 680px;
    }

    .skeleton-card {
      background: #fff;
      border-radius: 10px;
      padding: 1.2rem 1.4rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      border-left: 4px solid #ddd;
    }

    .skeleton-line {
      height: 12px;
      border-radius: 4px;
      background: linear-gradient(90deg, #e8e8e8 25%, #f5f5f5 50%, #e8e8e8 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
      margin-bottom: 0.6rem;
    }

    .skeleton-line.short { width: 40%; }
    .skeleton-line.medium { width: 65%; }
    .skeleton-line.long { width: 100%; }
    .skeleton-line.xlong { width: 100%; height: 10px; }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  </style>
</head>
<body>

  <h1>💬 Comments Viewer</h1>

  <div id="controls">
    <button id="fetch-btn">Fetch Comments</button>
    <button id="clear-btn">Clear</button>
  </div>

  <p id="status"></p>
  <div id="skeleton-container" aria-hidden="true"></div>
  <div id="comments-container" aria-live="polite"></div>

  <script>
    const API_URL = 'https://jsonplaceholder.typicode.com/comments?_limit=10';

    const fetchBtn = document.getElementById('fetch-btn');
    const clearBtn = document.getElementById('clear-btn');
    const commentsContainer = document.getElementById('comments-container');
    const skeletonContainer = document.getElementById('skeleton-container');
    const statusEl = document.getElementById('status');

    // ── Skeleton helpers ──────────────────────────────────────────────────────

    function createSkeletonCard() {
      const card = document.createElement('div');
      card.className = 'skeleton-card';
      card.setAttribute('aria-hidden', 'true');

      const lines = [
        ['skeleton-line short', 0],
        ['skeleton-line medium', 100],
        ['skeleton-line long', 200],
        ['skeleton-line xlong', 300],
        ['skeleton-line xlong', 400],
      ];

      lines.forEach(([cls, delay]) => {
        const line = document.createElement('div');
        line.className = cls;
        line.style.animationDelay = `${delay}ms`;
        card.appendChild(line);
      });

      return card;
    }

    function showSkeletons(count = 5) {
      skeletonContainer.innerHTML = '';
      for (let i = 0; i < count; i++) {
        skeletonContainer.appendChild(createSkeletonCard());
      }
    }

    function hideSkeletons() {
      skeletonContainer.innerHTML = '';
    }

    // ── Status helpers ────────────────────────────────────────────────────────

    function setStatus(message, isError = false) {
      statusEl.textContent = message;
      statusEl.className = isError ? 'error' : '';
    }

    // ── Comment card builder (no innerHTML, no string concatenation) ──────────

    function buildCommentCard(comment, index) {
      // Validate expected shape
      const id = Number.isFinite(comment.id) ? comment.id : '?';
      const name = typeof comment.name === 'string' ? comment.name : 'Unknown';
      const email = typeof comment.email === 'string' ? comment.email : '';
      const body = typeof comment.body === 'string' ? comment.body