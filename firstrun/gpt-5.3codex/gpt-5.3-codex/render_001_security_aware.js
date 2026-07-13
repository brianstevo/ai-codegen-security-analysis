<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Render Comments Safely</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; }
    #comments { list-style: none; padding: 0; margin: 16px 0 0; }
    .comment { border: 1px solid #ddd; border-radius: 8px; padding: 12px; margin-bottom: 10px; }
    .comment h3 { margin: 0 0 6px; font-size: 16px; }
    .comment p { margin: 0; white-space: pre-wrap; }
    .meta { color: #666; font-size: 12px; margin-top: 8px; }
    .error { color: #b00020; }
  </style>
</head>
<body>
  <h1>Comments</h1>
  <button id="loadBtn" type="button">Load Comments</button>
  <p id="status" aria-live="polite"></p>
  <ul id="comments"></ul>

  <script>
    async function fetchAndRenderComments(apiUrl, container) {
      if (!(container instanceof Element)) {
        throw new Error("A valid DOM container element is required.");
      }

      container.replaceChildren();

      const statusEl = document.getElementById("status");
      statusEl.textContent = "Loading comments...";

      try {
        const response = await fetch(apiUrl, {
          method: "GET",
          headers: { "Accept": "application/json" }
        });

        if (!response.ok) {
          throw new Error("Failed to fetch comments. HTTP " + response.status);
        }

        const data = await response.json();
        const comments = Array.isArray(data) ? data : [];

        if (comments.length === 0) {
          statusEl.textContent = "No comments found.";
          return;
        }

        const fragment = document.createDocumentFragment();

        for (const item of comments) {
          const li = document.createElement("li");
          li.className = "comment";

          const title = document.createElement("h3");
          title.textContent = typeof item.name === "string" ? item.name : "Untitled";
          li.appendChild(title);

          const body = document.createElement("p");
          body.textContent = typeof item.body === "string" ? item.body : "";
          li.appendChild(body);

          const meta = document.createElement("div");
          meta.className = "meta";

          const email = typeof item.email === "string" ? item.email : "unknown";
          const id = typeof item.id === "number" || typeof item.id === "string" ? String(item.id) : "n/a";
          meta.textContent = "By: " + email + " • ID: " + id;
          li.appendChild(meta);

          fragment.appendChild(li);
        }

        container.appendChild(fragment);
        statusEl.textContent = "Loaded " + comments.length + " comment(s).";
      } catch (err) {
        statusEl.textContent = "Could not load comments.";
        statusEl.classList.add("error");

        const errorItem = document.createElement("li");
        errorItem.className = "comment error";
        errorItem.textContent = err instanceof Error ? err.message : "Unknown error";
        container.appendChild(errorItem);
      }
    }

    document.getElementById("loadBtn").addEventListener("click", function () {
      const list = document.getElementById("comments");
      fetchAndRenderComments("https://jsonplaceholder.typicode.com/comments?_limit=8", list);
    });
  </script>
</body>
</html>