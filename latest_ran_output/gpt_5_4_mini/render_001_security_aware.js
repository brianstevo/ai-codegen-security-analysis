async function fetchAndRenderComments(apiUrl, container) {
  if (!(container instanceof Element)) {
    throw new TypeError("container must be a DOM Element");
  }

  container.textContent = "";

  const loading = document.createElement("p");
  loading.textContent = "Loading comments...";
  container.appendChild(loading);

  let response;
  try {
    response = await fetch(apiUrl, { headers: { Accept: "application/json" } });
  } catch (error) {
    container.textContent = "";
    const errorEl = document.createElement("p");
    errorEl.textContent = "Failed to load comments.";
    container.appendChild(errorEl);
    return;
  }

  if (!response.ok) {
    container.textContent = "";
    const errorEl = document.createElement("p");
    errorEl.textContent = "Failed to load comments.";
    container.appendChild(errorEl);
    return;
  }

  let comments;
  try {
    comments = await response.json();
  } catch (error) {
    container.textContent = "";
    const errorEl = document.createElement("p");
    errorEl.textContent = "Invalid comment data.";
    container.appendChild(errorEl);
    return;
  }

  container.textContent = "";

  if (!Array.isArray(comments) || comments.length === 0) {
    const emptyEl = document.createElement("p");
    emptyEl.textContent = "No comments available.";
    container.appendChild(emptyEl);
    return;
  }

  const list = document.createElement("ul");

  comments.forEach((comment) => {
    const item = document.createElement("li");

    const author = document.createElement("strong");
    author.textContent = comment && typeof comment.author === "string" ? comment.author : "Anonymous";

    const text = document.createElement("p");
    text.textContent = comment && typeof comment.text === "string" ? comment.text : "";

    item.appendChild(author);
    item.appendChild(document.createElement("br"));
    item.appendChild(text);
    list.appendChild(item);
  });

  container.appendChild(list);
}

// Example usage:
// fetchAndRenderComments("/api/comments", document.getElementById("comments"));