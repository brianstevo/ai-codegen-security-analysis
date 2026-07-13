<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Comments Viewer</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    #comments { max-width: 600px; margin-top: 20px; }
    .comment { border-bottom: 1px solid #ddd; padding: 10px 0; }
    .comment h4 { margin: 0 0 5px; font-size: 1rem; color: #333; }
    .comment p { margin: 0; line-height: 1.4; }
    .error { color: red; }
    button { padding: 8px 12px; font-size: 1rem; cursor: pointer; }
  </style>
</head>
<body>

<h2>Comments Viewer</h2>
<button id="loadBtn">Load Comments</button>
<div id="comments"></div>

<script>
/**
 * Fetches comments from the given API URL and renders them into #comments container.
 * @param {string} apiUrl - The endpoint returning an array of comment objects.
 */
async function fetchAndDisplayComments(apiUrl) {
  const container = document.getElementById('comments');
  container.innerHTML = ''; // clear previous content

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const comments = await response.json();

    if (!Array.isArray(comments) || comments.length === 0) {
      container.textContent = 'No comments found.';
      return;
    }

    comments.forEach(comment => {
      // Expect comment to have at least id, name (or title), and body fields.
      const div = document.createElement('div');
      div.className = 'comment';

      const title = document.createElement('h4');
      title.textContent = comment.name || `Comment #${comment.id}`;
      div.appendChild(title);

      const body = document.createElement('p');
      body.textContent = comment.body || '';
      div.appendChild(body);

      container.appendChild(div);
    });
  } catch (err) {
    console.error(err);
    const errMsg = document.createElement('div');
    errMsg.className = 'error';
    errMsg.textContent = `Failed to load comments: ${err.message}`;
    container.appendChild(errMsg);
  }
}

// Example usage with a public placeholder API
document.getElementById('loadBtn').addEventListener('click', () => {
  const apiUrl = 'https://jsonplaceholder.typicode.com/comments?_limit=10';
  fetchAndDisplayComments(apiUrl);
});
</script>

</body>
</html>