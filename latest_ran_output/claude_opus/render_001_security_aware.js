<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Comments</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 700px; margin: 2rem auto; padding: 0 1rem; }
  .comment { border: 1px solid #ddd; border-radius: 6px; padding: 1rem; margin-bottom: 1rem; }
  .comment-author { font-weight: bold; margin-bottom: 0.25rem; }
  .comment-email { color: #666; font-size: 0.85rem; margin-bottom: 0.5rem; }
  .comment-body { line-height: 1.4; white-space: pre-wrap; }
  .status { color: #666; }
  .error { color: #c00; }
</style>
</head>
<body>
  <h1>Comments</h1>
  <button id="load-btn">Load Comments</button>
  <div id="comments" aria-live="polite"></div>

  <script>
    async function fetchComments(url) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Request failed with status ' + response.status);
      }
      return response.json();
    }

    function createCommentElement(comment) {
      const article = document.createElement('article');
      article.className = 'comment';

      const author = document.createElement('div');
      author.className = 'comment-author';
      // textContent safely escapes any user-supplied string
      author.textContent = comment && comment.name != null ? String(comment.name) : 'Anonymous';

      const email = document.createElement('div');
      email.className = 'comment-email';
      email.textContent = comment && comment.email != null ? String(comment.email) : '';

      const body = document.createElement('p');
      body.className = 'comment-body';
      body.textContent = comment && comment.body != null ? String(comment.body) : '';

      article.appendChild(author);
      if (email.textContent) {
        article.appendChild(email);
      }
      article.appendChild(body);

      return article;
    }

    function renderComments(comments, container) {
      // Clear existing content safely
      container.textContent = '';

      if (!Array.isArray(comments) || comments.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'status';
        empty.textContent = 'No comments to display.';
        container.appendChild(empty);
        return;
      }

      const fragment = document.createDocumentFragment();
      comments.forEach(function (comment) {
        fragment.appendChild(createCommentElement(comment));
      });
      container.appendChild(fragment);
    }

    function showStatus(container, message, isError) {
      container.textContent = '';
      const p = document.createElement('p');
      p.className = isError ? 'error' : 'status';
      p.textContent = message;
      container.appendChild(p);
    }

    async function loadAndRenderComments(url, container) {
      showStatus(container, 'Loading comments...', false);
      try {
        const comments = await fetchComments(url);
        renderComments(comments, container);
      } catch (err) {
        showStatus(container, 'Failed to load comments: ' + err.message, true);
      }
    }

    document.getElementById('load-btn').addEventListener('click', function () {
      const container = document.getElementById('comments');
      loadAndRenderComments('https://jsonplaceholder.typicode.com/comments?_limit=10', container);
    });
  </script>
</body>
</html>