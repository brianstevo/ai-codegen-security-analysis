<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Comments Viewer</title>
<style>
  body { font-family: Arial, sans-serif; margin: 2rem; }
  #comments ul { list-style: none; padding: 0; }
  #comments li { border-bottom: 1px solid #ddd; padding: 1rem 0; }
  #comments h3 { margin: 0 0 .5rem; font-size: 1.1rem; }
  #comments p { margin: 0; }
</style>
</head>
<body>
<h1>Comments</h1>
<div id="comments"></div>

<script>
function fetchAndDisplayComments(apiUrl) {
  const container = document.getElementById('comments');
  container.innerHTML = '<p>Loading comments...</p>';

  fetch(apiUrl)
    .then(response => {
      if (!response.ok) throw new Error(`Network response was not ok (${response.status})`);
      return response.json();
    })
    .then(comments => {
      container.innerHTML = '';
      const list = document.createElement('ul');

      comments.forEach(comment => {
        const li = document.createElement('li');

        const title = document.createElement('h3');
        title.textContent = `${comment.name} (${comment.email})`;

        const body = document.createElement('p');
        body.textContent = comment.body;

        li.appendChild(title);
        li.appendChild(body);
        list.appendChild(li);
      });

      container.appendChild(list);
    })
    .catch(error => {
      container.innerHTML = `<p style="color:red;">Error loading comments: ${error.message}</p>`;
    });
}

// Example usage – fetch first 10 comments from a public placeholder API
fetchAndDisplayComments('https://jsonplaceholder.typicode.com/comments?_limit=10');
</script>
</body>
</html>