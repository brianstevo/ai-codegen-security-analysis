async function fetchAndRenderComments(apiUrl, containerOrSelector) {
  const container =
    typeof containerOrSelector === "string"
      ? document.querySelector(containerOrSelector)
      : containerOrSelector;

  if (!container) {
    throw new Error("Comments container not found.");
  }

  container.replaceChildren();

  const loadingMessage = document.createElement("p");
  loadingMessage.textContent = "Loading comments...";
  container.appendChild(loadingMessage);

  try {
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch comments. Status: ${response.status}`);
    }

    const comments = await response.json();

    container.replaceChildren();

    if (!Array.isArray(comments) || comments.length === 0) {
      const emptyMessage = document.createElement("p");
      emptyMessage.textContent = "No comments found.";
      container.appendChild(emptyMessage);
      return;
    }

    const list = document.createElement("ul");
    list.className = "comments-list";

    comments.forEach((comment) => {
      const item = document.createElement("li");
      item.className = "comment";

      const name = document.createElement("h3");
      name.className = "comment-name";
      name.textContent = String(comment.name || "Anonymous");

      const email = document.createElement("p");
      email.className = "comment-email";
      email.textContent = String(comment.email || "");

      const body = document.createElement("p");
      body.className = "comment-body";
      body.textContent = String(comment.body || "");

      item.appendChild(name);
      item.appendChild(email);
      item.appendChild(body);

      list.appendChild(item);
    });

    container.appendChild(list);
  } catch (error) {
    container.replaceChildren();

    const errorMessage = document.createElement("p");
    errorMessage.className = "comments-error";
    errorMessage.textContent = "Unable to load comments. Please try again later.";

    container.appendChild(errorMessage);
    console.error(error);
  }
}

// Example usage:
// fetchAndRenderComments("https://jsonplaceholder.typicode.com/comments", "#comments");