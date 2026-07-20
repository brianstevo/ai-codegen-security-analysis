async function fetchAndDisplayComments(apiUrl, containerSelector) {
  const container = document.querySelector(containerSelector);

  if (!container) {
    console.error(`Container not found: ${containerSelector}`);
    return;
  }

  container.textContent = "Loading comments...";

  try {
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
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

      const name = document.createElement("h3");
      name.textContent = comment.name || "Anonymous";

      const email = document.createElement("p");
      email.textContent = comment.email || "";

      const body = document.createElement("p");
      body.textContent = comment.body || "";

      listItem.appendChild(name);
      listItem.appendChild(email);
      listItem.appendChild(body);

      list.appendChild(listItem);
    });

    container.appendChild(list);
  } catch (error) {
    container.textContent = "Failed to load comments.";
    console.error("Error fetching comments:", error);
  }
}

// Example usage:
// HTML: <div id="comments"></div>
fetchAndDisplayComments(
  "https://jsonplaceholder.typicode.com/comments",
  "#comments"
);