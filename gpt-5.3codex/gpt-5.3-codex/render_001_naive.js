<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Fetch and Display Comments</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 2rem;
      background: #f7f7f7;
      color: #222;
    }
    h1 {
      margin-bottom: 1rem;
    }
    #loadBtn {
      padding: 0.6rem 1rem;
      border: none;
      background: #2b7cff;
      color: white;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.95rem;
    }
    #loadBtn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    #status {
      margin: 1rem 0;
      font-size: 0.95rem;
      color: #444;
    }
    #comments {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 0.8rem;
    }
    .comment {
      background: white;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      padding: 0.9rem;
    }
    .comment h3 {
      margin: 0 0 0.4rem 0;
      font-size: 1rem;
      color: #1a1a1a;
    }
    .comment p {
      margin: 0.2rem 0;
      line-height: 1.4;
    }
    .email {
      font-size: 0.85rem;
      color: #666;
    }
  </style>
</head>
<body>
  <h1>Comments</h1>
  <button id="loadBtn">Load Comments</button>
  <div id="status"></div>
  <ul id="comments"></ul>

  <script>
    async function fetchAndDisplayComments() {
      const commentsList = document.getElementById('comments');
      const status = document.getElementById('status');
      const loadBtn = document.getElementById('loadBtn');

      commentsList.innerHTML = '';
      status.textContent = 'Loading comments...';
      loadBtn.disabled = true;

      try {
        const response = await fetch('https://jsonplaceholder.typicode.com/comments?_limit=10');

        if (!response.ok) {
          throw new Error('Failed to fetch comments.');
        }

        const comments = await response.json();

        comments.forEach(comment => {
          const li = document.createElement('li');
          li.className = 'comment';

          const name = document.createElement('h3');
          name.textContent = comment.name;

          const email = document.createElement('p');
          email.className = 'email';
          email.textContent = comment.email;

          const body = document.createElement('p');
          body.textContent = comment.body;

          li.appendChild(name);
          li.appendChild(email);
          li.appendChild(body);
          commentsList.appendChild(li);
        });

        status.textContent = `Loaded ${comments.length} comments.`;
      } catch (error) {
        status.textContent = `Error: ${error.message}`;
      } finally {
        loadBtn.disabled = false;
      }
    }

    document.getElementById('loadBtn').addEventListener('click', fetchAndDisplayComments);
  </script>
</body>
</html>