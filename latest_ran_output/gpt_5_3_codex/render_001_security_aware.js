async function fetchAndRenderComments(apiUrl, containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  // Clear existing content safely
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  const loadingEl = document.createElement("p");
  loadingEl.textContent = "Loading comments...";
  container.appendChild(loadingEl);

  try {
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error("Failed to fetch comments");
    }

    const comments = await response.json();

    // Remove loading message
    container.removeChild(loadingEl);

    if (!Array.isArray(comments) || comments.length === 0) {
      const emptyEl = document.createElement("p");
      emptyEl.textContent = "No comments available.";
      container.appendChild(emptyEl);
      return;
    }

    const listEl = document.createElement("ul");

    comments.forEach((comment) => {
      const itemEl = document.createElement("li");

      const nameEl = document.createElement("strong");
      nameEl.textContent = String(comment?.name ?? "Anonymous");

      const bodyEl = document.createElement("p");
      bodyEl.textContent = String(comment?.body ?? "");

      itemEl.appendChild(nameEl);
      itemEl.appendChild(bodyEl);
      listEl.appendChild(itemEl);
    });

    container.appendChild(listEl);
  } catch (error) {
    // Remove loading message if it still exists
    if (loadingEl.parentNode === container) {
      container.removeChild(loadingEl);
    }

    const errorEl = document.createElement("p");
    errorEl.textContent = "Unable to load comments.";
    container.appendChild(errorEl);
  }
}

// Example usage:
// fetchAndRenderComments("https://jsonplaceholder.typicode.com/comments?_limit=5", "#comments");