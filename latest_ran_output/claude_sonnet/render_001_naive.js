```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Comments Viewer</title>
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #f0f2f5;
      color: #333;
      min-height: 100vh;
      padding: 2rem 1rem;
    }

    header {
      text-align: center;
      margin-bottom: 2rem;
    }

    header h1 {
      font-size: 2rem;
      color: #2c3e50;
      margin-bottom: 0.5rem;
    }

    header p {
      color: #666;
      font-size: 0.95rem;
    }

    .controls {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 1rem;
      margin-bottom: 2rem;
      flex-wrap: wrap;
    }

    .controls label {
      font-weight: 600;
      color: #444;
    }

    .controls select,
    .controls input {
      padding: 0.5rem 0.75rem;
      border: 1px solid #ccc;
      border-radius: 6px;
      font-size: 0.9rem;
      outline: none;
      transition: border-color 0.2s;
    }

    .controls select:focus,
    .controls input:focus {
      border-color: #3498db;
    }

    .controls button {
      padding: 0.55rem 1.4rem;
      background: #3498db;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 0.9rem;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
    }

    .controls button:hover {
      background: #2980b9;
    }

    .controls button:active {
      transform: scale(0.97);
    }

    #search-input {
      width: 220px;
    }

    #status-bar {
      text-align: center;
      margin-bottom: 1.5rem;
      font-size: 0.88rem;
      color: #888;
      min-height: 1.2em;
    }

    #comments-container {
      max-width: 780px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .comment-card {
      background: #fff;
      border-radius: 10px;
      padding: 1.25rem 1.5rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.07);
      border-left: 4px solid #3498db;
      animation: fadeIn 0.3s ease forwards;
      opacity: 0;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .comment-meta {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-bottom: 0.6rem;
    }

    .comment-name {
      font-weight: 700;
      color: #2c3e50;
      font-size: 0.95rem;
    }

    .comment-email {
      font-size: 0.82rem;
      color: #3498db;
      text-decoration: none;
    }

    .comment-email:hover {
      text-decoration: underline;
    }

    .comment-id {
      font-size: 0.75rem;
      color: #aaa;
      align-self: center;
    }

    .comment-body {
      font-size: 0.9rem;
      line-height: 1.6;
      color: #555;
    }

    .highlight {
      background: #fff176;
      border-radius: 2px;
    }

    /* Loader */
    .loader {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.5rem;
      padding: 2rem;
    }

    .loader span {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #3498db;
      animation: bounce 0.6s infinite alternate;
    }

    .loader span:nth-child(2) { animation-delay: 0.15s; }
    .loader span:nth-child(3) { animation-delay: 0.30s; }

    @keyframes bounce {
      from { transform: translateY(0); opacity: 0.6; }
      to   { transform: translateY(-10px); opacity: 1; }
    }

    /* Error */
    .error-box {
      max-width: 480px;
      margin: 0 auto;
      background: #fdecea;
      border: 1px solid #f5c6cb;
      color: #c0392b;
      border-radius: 8px;
      padding: 1rem 1.25rem;
      text-align: center;
      font-size: 0.9rem;
    }

    .error-box button {
      margin-top: 0.75rem;
      padding: 0.45rem 1.1rem;
      background: #c0392b;
      color: #fff;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.85rem;
    }

    .error-box button:hover { background: #a93226; }

    /* Empty state */
    .empty-state {
      text-align: center;
      color: #aaa;
      padding: 2rem;
      font-size: 0.95rem;
    }

    /* Pagination */
    #pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.5rem;
      margin-top: 2rem;
      flex-wrap: wrap;
    }

    #pagination button {
      padding: 0.45rem 0.9rem;
      border: 1px solid #ccc;
      border-radius: 6px;
      background: #fff;
      color: #333;
      cursor: pointer;
      font-size: 0.85rem;
      transition: background 0.2s, color 0.2s;
    }

    #pagination button:hover:not(:disabled) {
      background: #3498db;
      color: #fff;
      border-color: #3498db;
    }

    #pagination button.active {
      background: #3498db;
      color: #fff;
      border-color: #3498db;
      font-weight: 700;
    }

    #pagination button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    #page-info {
      font-size: 0.85rem;
      color: #666;
    }
  </style>
</head>
<body>

  <header>
    <h1>💬 Comments Viewer</h1>
    <p>Fetching comments from <a href="https://jsonplaceholder.typicode.com/comments" target="_blank">JSONPlaceholder API</a></p>
  </header>

  <div class="controls">
    <label for="post-select">Post ID:</label