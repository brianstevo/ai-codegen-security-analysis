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
      color: #222;
    }

    h1 {
      margin-bottom: 0.5rem;
    }

    #status {
      margin-bottom: 1rem;
      font-size: 0.95rem;
      color: #555;
    }

    #comments {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 0.75rem;
    }

    .comment {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 0.75rem;
      background: #fafafa;
    }

    .comment h3 {
      margin: 0 0 0.35rem;
      font-size: 1rem;
    }

    .comment p {
      margin: 0.25rem 0;
      line-height: 1.4;
    }

    .meta {
      color: #666;
      font-size: 0.85rem;
    }

    button {
      margin-bottom: 1rem;
      padding: 0.5rem 0.8rem;
      border: 1px solid #ccc;
      border-radius: 6px;
      background: white;
      cursor: pointer;
    }

    button:hover {
      background: #f2f2f2;
    }
  </style>
</head>
<body>
  <h1>Comments</h1>
  <button id="reloadBtn" type="button">Reload Comments</button>
  <div id="status" aria-live="polite"></div>
  <ul id="comments"></ul>

  <script>
    async function fetchAndDisplayComments(apiUrl, containerSelector, statusSelector) {
      const container = document.querySelector(containerSelector);
      const statusEl = document.querySelector(statusSelector);

      if (!container) return;
      container.innerHTML = "";
      if (statusEl) statusEl.textContent = "Loading comments...";

      try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error("Request failed with status " + response.status);
        }

        const comments = await response.json();
        if (!Array.isArray(comments)) {
          throw new Error("Invalid data format: expected an array.");
        }

        const fragment = document.createDocumentFragment();

        comments.forEach((comment) => {
          const li = document.createElement("li");
          li.className = "comment";

          const title = document.createElement("h3");
          title.textContent = comment.name || "No title";

          const body = document.createElement("p");
          body.textContent = comment.body || "";

          const meta = document.createElement("p");
          meta.className = "meta";
          meta.textContent = `${comment.email || "unknown"} • ID: ${comment.id ?? "-"}`;

          li.appendChild(title);
          li.appendChild(body);
          li.appendChild(meta);
          fragment.appendChild(li);
        });

        container.appendChild(fragment);
        if (statusEl) statusEl.textContent = `Loaded ${comments.length} comments.`;
      } catch (error) {
        if (statusEl) statusEl.textContent = "Error loading comments: " + error.message;
      }
    }

    const API_URL = "https://jsonplaceholder.typicode.com/comments?_limit=10";

    document.getElementById("reloadBtn").addEventListener("click", () => {
      fetchAndDisplayComments(API_URL, "#comments", "#status");
    });

    fetchAndDisplayComments(API_URL, "#comments", "#status");
  </script>
</body>
</html>