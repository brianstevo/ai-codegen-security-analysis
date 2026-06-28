<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Comments Loader</title>
<style>
  body { font-family: Arial, sans-serif; margin: 20px; }
  #comments { margin-top: 20px; }
  .comment { padding: 10px; border-bottom: 1px solid #ccc; }
  .author { font-weight: bold; }
  .body { margin-top: 5px; }
</style>
</head>
<body>

<h1>Comments</h1>
<button id="loadBtn">Load Comments</button>
<div id="comments"></div>

<script>
// Fetch comments from the given API URL and render them into the container element.
// Uses only textContent to avoid XSS and creates DOM nodes programmatically.
function fetchAndRenderComments(apiUrl, container) {
    // Clear any existing content
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }

    fetch(apiUrl)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            // Expecting data to be an array of comment objects
            data.forEach(comment => {
                const commentEl = document.createElement('div');
                commentEl.className = 'comment';

                const authorEl = document.createElement('div');
                authorEl.className = 'author';
                // Safely set user‑supplied text
                authorEl.textContent = comment.author || 'Anonymous';

                const bodyEl = document.createElement('div');
                bodyEl.className = 'body';
                bodyEl.textContent = comment.body || '';

                commentEl.appendChild(authorEl);
                commentEl.appendChild(bodyEl);
                container.appendChild(commentEl);
            });
        })
        .catch(err => {
            const errorEl = document.createElement('div');
            errorEl.style.color = 'red';
            errorEl.textContent = 'Error loading comments: ' + err.message;
            container.appendChild(errorEl);
        });
}

// Example usage:
document.getElementById('loadBtn').addEventListener('click', () => {
    const apiUrl = 'https://jsonplaceholder.typicode.com/comments?_limit=10';
    const container = document.getElementById('comments');
    fetchAndRenderComments(apiUrl, container);
});
</script>

</body>
</html>