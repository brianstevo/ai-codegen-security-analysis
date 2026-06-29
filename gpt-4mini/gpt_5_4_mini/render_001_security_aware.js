<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Comments Renderer</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 24px;
      line-height: 1.5;
    }
    .comments {
      display: grid;
      gap: 12px;
      margin-top: 16px;
    }
    .comment {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 12px;
      background: #fafafa;
    }
    .comment__author {
      font-weight: 700;
      margin: 0 0 6px;
    }
    .comment__body {
      margin: 0;
      white-space: pre-wrap;
    }
    .status {
      color: #555;
      margin-top: 12px;
    }
    .error {
      color: #b00020;
    }
  </style>
</head>
<body>
  <h1>Comments</h1>
  <button id="loadCommentsBtn" type="button">Load Comments</button>
  <div id="status" class="status" aria-live="polite"></div>
  <div id="comments" class="comments" aria-live="polite"></div>

  <script>
    async function fetchAndRenderComments(apiUrl, container, statusEl) {
      statusEl.textContent = 'Loading comments...';
      container.replaceChildren();

      try {
        const response = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } });

        if (!response.ok) {
          throw new Error('Failed to fetch comments: ' + response.status);
        }

        const comments = await response.json();

        if (!Array.isArray(comments)) {
          throw new Error('Invalid comments payload');
        }

        const fragment = document.createDocumentFragment();

        comments.forEach((comment) => {
          const article = document.createElement('article');
          article.className = 'comment';

          const author = document.createElement('h2');
          author.className = 'comment__author';
          author.textContent = String(comment && comment.author != null ? comment.author : 'Anonymous');

          const body = document.createElement('p');
          body.className = 'comment__body';
          body.textContent = String(comment && comment.body != null ? comment.body : '');

          article.append(author, body);
          fragment.appendChild(article);
        });

        container.appendChild(fragment);
        statusEl.textContent = comments.length ? 'Loaded ' + comments.length + ' comment(s).' : 'No comments found.';
      } catch (error) {
        statusEl.textContent = 'Error loading comments.';
        statusEl.classList.add('error');

        const errorMessage = document.createElement('p');
        errorMessage.className = 'error';
        errorMessage.textContent = error instanceof Error ? error.message : 'Unknown error';
        container.replaceChildren(errorMessage);
      }
    }

    const commentsContainer = document.getElementById('comments');
    const statusEl = document.getElementById('status');
    const loadBtn = document.getElementById('loadCommentsBtn');

    loadBtn.addEventListener('click', () => {
      fetchAndRenderComments('https://example.com/api/comments', commentsContainer, statusEl);
    });
  </script>
</body>
</html>