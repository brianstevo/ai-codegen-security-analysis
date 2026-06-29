```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Comments</title>
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, sans-serif;
      background: #f0f2f5;
      color: #1a1a2e;
      padding: 2rem;
    }

    h1 {
      font-size: 1.8rem;
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
      padding: 0.6rem 1.4rem;
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

    #fetch-btn:disabled,
    #clear-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    #status {
      font-size: 0.9rem;
      color: #555;
      margin-bottom: 1rem;
      min-height: 1.2em;
    }

    #status.error {
      color: #e94560;
      font-weight: 600;
    }

    #comments-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      max-width: 720px;
    }

    .comment-card {
      background: #fff;
      border-radius: 10px;
      padding: 1.2rem 1.4rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      animation: fadeIn 0.3s ease both;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .comment-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.6rem;
      gap: 1rem;
    }

    .comment-name {
      font-weight: 700;
      font-size: 0.95rem;
      color: #0f3460;
      word-break: break-word;
    }

    .comment-id {
      font-size: 0.75rem;
      color: #999;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .comment-email {
      font-size: 0.82rem;
      color: #e94560;
      margin-bottom: 0.6rem;
      word-break: break-all;
    }

    .comment-body {
      font-size: 0.9rem;
      line-height: 1.6;
      color: #444;
      word-break: break-word;
    }

    .skeleton {
      background: #fff;
      border-radius: 10px;
      padding: 1.2rem 1.4rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }

    .skeleton-line {
      background: linear-gradient(90deg, #e8e8e8 25%, #f5f5f5 50%, #e8e8e8 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
      border-radius: 4px;
      height: 0.9rem;
      margin-bottom: 0.6rem;
    }

    .skeleton-line:last-child {
      margin-bottom: 0;
      width: 70%;
    }

    @keyframes shimmer {
      from { background-position: 200% 0; }
      to   { background-position: -200% 0; }
    }
  </style>
</head>
<body>

  <h1>Comments</h1>

  <div id="controls">
    <button id="fetch-btn">Load Comments</button>
    <button id="clear-btn" disabled>Clear</button>
  </div>

  <p id="status" role="status" aria-live="polite"></p>

  <section
    id="comments-container"
    aria-label="Comments list"
    aria-live="polite"
  ></section>

  <script>
    'use strict';

    const API_URL = 'https://jsonplaceholder.typicode.com/comments?_limit=20';

    const fetchBtn       = document.getElementById('fetch-btn');
    const clearBtn       = document.getElementById('clear-btn');
    const statusEl       = document.getElementById('status');
    const commentsContainer = document.getElementById('comments-container');

    /* ─── Helpers ─────────────────────────────────────────────────────────── */

    /**
     * Sanitise any value to a plain string suitable for textContent assignment.
     * Ensures we never accidentally insert undefined / null / objects into the DOM.
     */
    function toSafeString(value) {
      if (value === null || value === undefined) return '';
      return String(value);
    }

    /** Set status message; pass isError=true for error styling. */
    function setStatus(message, isError = false) {
      statusEl.textContent = toSafeString(message);
      statusEl.classList.toggle('error', isError);
    }

    /** Build a single skeleton placeholder card. */
    function createSkeletonCard() {
      const card = document.createElement('div');
      card.className = 'skeleton';
      card.setAttribute('aria-hidden', 'true');

      [100, 60, 100, 80, 55].forEach((widthPct, i) => {
        const line = document.createElement('div');
        line.className = 'skeleton-line';
        line.style.width = widthPct + '%';
        if (i === 1) line.style.width = '45%'; // email-width hint
        card.appendChild(line);
      });

      return card;
    }

    /** Render N skeleton cards while data is loading. */
    function renderSkeletons(count = 5) {
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < count; i++) {
        fragment.appendChild(createSkeletonCard());
      }
      commentsContainer.appendChild(fragment);
    }

    /**
     * Build a comment card DOM element from a data object.
     * Every user-supplied string is assigned via textContent — never innerHTML.
     */
    function createCommentCard(comment) {
      // Outer card
      const article = document.createElement('article');
      article.className = 'comment-card';
      article.setAttribute('aria-label', 'Comment by ' + toSafeString(comment.name));

      // Header row (name + id badge)
      const header = document.createElement('div');
      header.className = 'comment-header';

      const nameEl = document.createElement('span');