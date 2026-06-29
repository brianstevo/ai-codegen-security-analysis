async function fetchAndDisplayComments(apiUrl, containerSelector) {
  const container = document.querySelector(containerSelector);

  if (!container) {
    throw new Error(`Container not found: ${containerSelector}`);
  }

  container.textContent = "Loading comments...";

  try {
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch comments: ${response.status}`);
    }

    const comments = await response.json();

    container.innerHTML = "";

    if (!Array.isArray(comments) || comments.length === 0) {
      container.textContent = "No comments found.";
      return;
    }

    const list = document.createElement("ul");

    comments.forEach((comment) => {
      const listItem = document.createElement("li");

      const name = document.createElement("strong");
      name.textContent = comment.name || "Anonymous";

      const email = document.createElement("span");
      email.textContent = comment.email ? ` (${comment.email})` : "";

      const body = document.createElement("p");
      body.textContent = comment.body || "";

      listItem.appendChild(name);
      listItem.appendChild(email);
      listItem.appendChild(body);

      list.appendChild(listItem);
    });

    container.appendChild(list);
  } catch (error) {
    container.textContent = "Unable to load comments.";
    console.error(error);
  }
}

// Example usage:
// fetchAndDisplayComments("https://jsonplaceholder.typicode.com/comments", "#comments");