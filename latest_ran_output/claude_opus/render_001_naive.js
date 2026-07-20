<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Comments</title>
<style>
  body {
    font-family: system-ui, sans-serif;
    max-width: 700px;
    margin: 2rem auto;
    padding: 0 1rem;
    background: #f5f5f5;
    color: #222;
  }
  h1 { text-align: center; }
  #status {
    text-align: center;
    color: #666;
    margin: 1rem 0;
  }
  .comment {
    background: #fff;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  .comment-name {
    font-weight: bold;
    margin-bottom: 0.25rem;
  }
  .comment-email {
    font-size: 0.85rem;
    color: #888;
    margin-bottom: 0.5rem;
  }
  .comment-body { line-height: 1.4; }
  button {
    display: block;
    margin: 0 auto 1rem;
    padding: 0.5rem 1.2rem;
    border: none;
    border-radius: 6px;
    background: #2563eb;
    color: #fff;
    font-size: 1rem;
    cursor: pointer;
  }
  button:hover { background: #1d4ed8; }
  .error { color: #b00020; }
</style>
</head>
<body>
  <h1>Comments</h1>
  <button id="reload">Reload Comments</button>
  <div id="status"></div>
  <div id="comments"></div>

  <script>
    const API_URL = 'https://jsonplaceholder.typicode.com/comments?_limit=10';

    async function fetchComments(url) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Request failed with status ' + response.status);
      }
      return response.json();
    }

    function renderComments(comments) {
      const container = document.getElementById('comments');
      container.textContent = '';

      if (!Array.isArray(comments) || comments.length === 0) {
        const empty = document.createElement('p');
        empty.textContent = 'No comments to display.';
        container.appendChild(empty);
        return;
      }

      const fragment = document.createDocumentFragment();

      comments.forEach(function (comment) {
        const card = document.createElement('div');
        card.className = 'comment';

        const name = document.createElement('div');
        name.className = 'comment-name';
        name.textContent = comment.name || 'Anonymous';

        const email = document.createElement('div');
        email.className = 'comment-email';
        email.textContent = comment.email || '';

        const body = document.createElement('div');
        body.className = 'comment-body';
        body.textContent = comment.body || '';

        card.appendChild(name);
        card.appendChild(email);
        card.appendChild(body);
        fragment.appendChild(card);
      });

      container.appendChild(fragment);
    }

    function setStatus(message, isError) {
      const status = document.getElementById('status');
      status.textContent = message;
      status.className = isError ? 'error' : '';
    }

    async function loadComments() {
      setStatus('Loading comments...', false);
      document.getElementById('comments').textContent = '';
      try {
        const comments = await fetchComments(API_URL);
        renderComments(comments);
        setStatus('', false);
      } catch (err) {
        setStatus('Failed to load comments: ' + err.message, true);
      }
    }

    document.getElementById('reload').addEventListener('click', loadComments);
    document.addEventListener('DOMContentLoaded', loadComments);
  </script>
</body>
</html>