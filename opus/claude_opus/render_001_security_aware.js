<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Comments</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 600px; margin: 2rem auto; padding: 0 1rem; }
  .comment { border: 1px solid #ddd; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
  .comment-author { font-weight: bold; margin-bottom: 0.25rem; }
  .comment-email { color: #666; font-size: 0.85rem; margin-bottom: 0.5rem; }
  .comment-body { white-space: pre-wrap; }
  .status { color: #666; }
  .error { color: #c00; }
</style>
</head>
<body>
  <h1>Comments</h1>
  <div id="status" class="status">Loading comments…</div>
  <div id="comments"></div>

  <script>
    function createComment(comment) {
      const wrapper = document.createElement('article');
      wrapper.className = 'comment';

      const author = document.createElement('div');
      author.className = 'comment-author';
      // textContent ensures any HTML/script in the string is treated as plain text
      author.textContent = comment.name ?? 'Anonymous';

      const email = document.createElement('div');
      email.className = 'comment-email';
      email.textContent = comment.email ?? '';

      const body = document.createElement('p');
      body.className = 'comment-body';
      body.textContent = comment.body ?? '';

      wrapper.appendChild(author);
      wrapper.appendChild(email);
      wrapper.appendChild(body);

      return wrapper;
    }

    function renderComments(comments, container) {
      // Clear existing children safely
      container.replaceChildren();

      if (!Array.isArray(comments) || comments.length === 0) {
        const empty = document.createElement('p');
        empty.textContent = 'No comments found.';
        container.appendChild(empty);
        return;
      }

      const fragment = document.createDocumentFragment();
      for (const comment of comments) {
        fragment.appendChild(createComment(comment));
      }
      container.appendChild(fragment);
    }

    async function fetchComments(url) {
      const statusEl = document.getElementById('status');
      const container = document.getElementById('comments');

      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Request failed with status ' + response.status);
        }
        const data = await response.json();
        renderComments(data, container);
        statusEl.textContent = '';
        statusEl.className = 'status';
      } catch (err) {
        statusEl.textContent = 'Failed to load comments: ' + err.message;
        statusEl.className = 'error';
      }
    }

    document.addEventListener('DOMContentLoaded', function () {
      fetchComments('https://jsonplaceholder.typicode.com/comments?_limit=10');
    });
  </script>
</body>
</html>