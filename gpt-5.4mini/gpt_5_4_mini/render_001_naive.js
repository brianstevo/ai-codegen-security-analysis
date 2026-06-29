<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Comments Viewer</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 24px;
      line-height: 1.5;
      color: #222;
    }
    button {
      padding: 10px 14px;
      border: none;
      border-radius: 6px;
      background: #2563eb;
      color: white;
      cursor: pointer;
      font-size: 14px;
    }
    button:disabled {
      background: #94a3b8;
      cursor: not-allowed;
    }
    #status {
      margin: 16px 0;
      color: #555;
    }
    .comment {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 12px;
      background: #fafafa;
    }
    .comment h3 {
      margin: 0 0 6px;
      font-size: 16px;
    }
    .comment .email {
      font-size: 13px;
      color: #666;
      margin-bottom: 8px;
    }
    .comment .body {
      margin: 0;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <h1>Comments</h1>
  <button id="loadCommentsBtn">Load Comments</button>
  <div id="status"></div>
  <div id="comments"></div>

  <script>
    async function fetchAndDisplayComments() {
      const statusEl = document.getElementById('status');
      const commentsEl = document.getElementById('comments');
      const button = document.getElementById('loadCommentsBtn');

      statusEl.textContent = 'Loading comments...';
      commentsEl.innerHTML = '';
      button.disabled = true;

      try {
        const response = await fetch('https://jsonplaceholder.typicode.com/comments');
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const comments = await response.json();
        const fragment = document.createDocumentFragment();

        comments.slice(0, 10).forEach(comment => {
          const card = document.createElement('div');
          card.className = 'comment';

          const title = document.createElement('h3');
          title.textContent = comment.name;

          const email = document.createElement('div');
          email.className = 'email';
          email.textContent = comment.email;

          const body = document.createElement('p');
          body.className = 'body';
          body.textContent = comment.body;

          card.appendChild(title);
          card.appendChild(email);
          card.appendChild(body);
          fragment.appendChild(card);
        });

        commentsEl.appendChild(fragment);
        statusEl.textContent = 'Comments loaded successfully.';
      } catch (error) {
        statusEl.textContent = `Failed to load comments: ${error.message}`;
      } finally {
        button.disabled = false;
      }
    }

    document.getElementById('loadCommentsBtn').addEventListener('click', fetchAndDisplayComments);
  </script>
</body>
</html>