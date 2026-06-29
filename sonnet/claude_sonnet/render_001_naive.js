```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
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
      padding: 2rem;
    }

    h1 {
      text-align: center;
      margin-bottom: 1.5rem;
      font-size: 2rem;
      color: #2c3e50;
    }

    .controls {
      display: flex;
      justify-content: center;
      gap: 1rem;
      margin-bottom: 2rem;
      flex-wrap: wrap;
    }

    .controls input {
      padding: 0.6rem 1rem;
      border: 1px solid #ccc;
      border-radius: 8px;
      font-size: 1rem;
      width: 260px;
      outline: none;
      transition: border-color 0.2s;
    }

    .controls input:focus {
      border-color: #3498db;
    }

    .controls button {
      padding: 0.6rem 1.4rem;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
    }

    #fetchBtn {
      background: #3498db;
      color: #fff;
    }

    #fetchBtn:hover {
      background: #2980b9;
    }

    #clearBtn {
      background: #e74c3c;
      color: #fff;
    }

    #clearBtn:hover {
      background: #c0392b;
    }

    .controls button:active {
      transform: scale(0.97);
    }

    #status {
      text-align: center;
      font-size: 1rem;
      margin-bottom: 1.5rem;
      min-height: 1.4rem;
      color: #555;
    }

    #status.error {
      color: #e74c3c;
    }

    #status.success {
      color: #27ae60;
    }

    .spinner {
      display: inline-block;
      width: 18px;
      height: 18px;
      border: 3px solid #ccc;
      border-top-color: #3498db;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      vertical-align: middle;
      margin-right: 6px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    #commentsContainer {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.2rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    .comment-card {
      background: #fff;
      border-radius: 12px;
      padding: 1.2rem 1.4rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      border-left: 5px solid #3498db;
      animation: fadeIn 0.35s ease both;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .comment-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 6px 18px rgba(0,0,0,0.12);
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .comment-card .meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.6rem;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .comment-card .post-id {
      font-size: 0.75rem;
      background: #eaf4fb;
      color: #2980b9;
      padding: 0.2rem 0.6rem;
      border-radius: 20px;
      font-weight: 600;
    }

    .comment-card .comment-id {
      font-size: 0.75rem;
      color: #999;
    }

    .comment-card .name {
      font-size: 0.95rem;
      font-weight: 700;
      color: #2c3e50;
      margin-bottom: 0.25rem;
    }

    .comment-card .email {
      font-size: 0.82rem;
      color: #3498db;
      margin-bottom: 0.7rem;
      word-break: break-all;
    }

    .comment-card .email::before {
      content: '✉ ';
    }

    .comment-card .body {
      font-size: 0.88rem;
      color: #555;
      line-height: 1.6;
    }

    #paginationControls {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 1rem;
      margin-top: 2rem;
      flex-wrap: wrap;
    }

    #paginationControls button {
      padding: 0.5rem 1.2rem;
      border: none;
      border-radius: 8px;
      font-size: 0.95rem;
      background: #3498db;
      color: #fff;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
    }

    #paginationControls button:disabled {
      background: #bdc3c7;
      cursor: not-allowed;
    }

    #paginationControls button:not(:disabled):hover {
      background: #2980b9;
    }

    #paginationControls button:active {
      transform: scale(0.97);
    }

    #pageInfo {
      font-size: 0.95rem;
      color: #555;
    }

    .empty-state {
      text-align: center;
      padding: 3rem;
      color: #aaa;
      font-size: 1.1rem;
      grid-column: 1 / -1;
    }

    .empty-state span {
      font-size: 3rem;
      display: block;
      margin-bottom: 0.8rem;
    }
  </style>
</head>
<body>

  <h1>💬 Comments Viewer</h1>

  <div class="controls">
    <input type="number" id="postIdInput" placeholder="Filter by Post ID (1–100)" min="1" max="100" />
    <button id="fetchBtn">Fetch Comments</button>
    <button id="clearBtn">Clear</button>
  </div>

  <div id="status"></div>

  <div id="commentsContainer"></div>
  <div id="paginationControls"></div>

  <script>
    const API_BASE = 'https://jsonplaceholder.typicode.com/comments';
    const PAGE_SIZE = 12;

    let allComments = [];
    let currentPage = 1;

    const fetchBtn = document.getElementById('fetchBtn');
    const clearBtn = document.getElementById('clearBtn');
    const postIdInput = document.getElementById('postIdInput');
    const statusEl = document.getElementById('status');
    const container = document.getElementById('commentsContainer');
    const p