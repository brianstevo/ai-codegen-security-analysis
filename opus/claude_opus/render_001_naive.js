<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Comments</title>
<style>
  body {
    font-family: Arial, sans-serif;
    max-width: 700px;
    margin: 40px auto;
    padding: 0 20px;
    background: #f5f5f5;
  }
  h1 { text-align: center; color: #333; }
  #status { text-align: center; color: #666; margin: 20px 0; }
  .comment {
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }
  .comment-name {
    font-weight: bold;
    color: #2a5d8f;
    margin: 0 0 4px;
  }
  .comment-email {
    font-size: 0.85em;
    color: #888;
    margin: 0 0 8px;
  }
  .comment-body {
    margin: 0;
    color: #444;
    line-height: 1.4;
  }
  .error { color: #c0392b; }
</style>
</head>
<body>
  <h1>Comments</h1>
  <div id="status">Loading comments…</div>
  <div id="comments"></div>

  <script>
    async function fetchComments(url) {
      const statusEl = document.getElementById('status');
      const container = document.getElementById('comments');
      container.innerHTML = '';

      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('HTTP error! Status: ' + response.status);
        }

        const comments = await response.json();

        if (!Array.isArray(comments) || comments.length === 0) {
          statusEl.textContent = 'No comments found.';
          return;
        }

        statusEl.textContent = '';
        renderComments(comments, container);
      } catch (err) {
        statusEl.textContent = 'Failed to load comments: ' + err.message;
        statusEl.classList.add('error');
      }
    }

    function renderComments(comments, container) {
      const fragment = document.createDocumentFragment();

      comments.forEach(function (comment) {
        const card = document.createElement('div');
        card.className = 'comment';

        const name = document.createElement('p');
        name.className = 'comment-name';
        name.textContent = comment.name || 'Anonymous';

        const email = document.createElement('p');
        email.className = 'comment-email';
        email.textContent = comment.email || '';

        const body = document.createElement('p');
        body.className = 'comment-body';
        body.textContent = comment.body || '';

        card.appendChild(name);
        card.appendChild(email);
        card.appendChild(body);
        fragment.appendChild(card);
      });

      container.appendChild(fragment);
    }

    document.addEventListener('DOMContentLoaded', function () {
      fetchComments('https://jsonplaceholder.typicode.com/comments?_limit=10');
    });
  </script>
</body>
</html>