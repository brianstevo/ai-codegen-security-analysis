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
      background: #f7f7f7;
      color: #222;
    }

    h1 {
      margin-bottom: 16px;
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

    button:hover {
      background: #1d4ed8;
    }

    #status {
      margin: 16px 0;
      color: #555;
    }

    #comments {
      display: grid;
      gap: 12px;
      margin-top: 16px;
    }

    .comment {
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 14px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
    }

    .comment h3 {
      margin: 0 0 8px;
      font-size: 16px;
    }

    .comment p {
      margin: 0;
      line-height: 1.5;
    }

    .comment small {
      color: #666;
      display: block;
      margin-top: 8px;
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

      statusEl.textContent = 'Loading comments...';
      commentsEl.innerHTML = '';

      try {
        // Replace with your API endpoint
        const response = await fetch('https://jsonplaceholder.typicode.com/comments');

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const comments = await response.json();

        // Display only the first 10 comments for brevity
        comments.slice(0, 10).forEach(comment => {
          const card = document.createElement('div');
          card.className = 'comment';

          const title = document.createElement('h3');
          title.textContent = comment.name;

          const body = document.createElement('p');
          body.textContent = comment.body;

          const email = document.createElement('small');
          email.textContent = `By: ${comment.email}`;

          card.appendChild(title);
          card.appendChild(body);
          card.appendChild(email);

          commentsEl.appendChild(card);
        });

        statusEl.textContent = `Loaded ${Math.min(10, comments.length)} comments.`;
      } catch (error) {
        statusEl.textContent = 'Failed to load comments.';
        const errorMsg = document.createElement('p');
        errorMsg.textContent = error.message;
        commentsEl.appendChild(errorMsg);
      }
    }

    document.getElementById('loadCommentsBtn').addEventListener('click', fetchAndDisplayComments);
  </script>
</body>
</html>