<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Comments Viewer</title>
  <style>
    #comments ul { list-style: none; padding: 0; }
    #comments li { margin-bottom: 1em; border-bottom: 1px solid #ddd; padding-bottom: .5em; }
    #comments strong { display: block; font-weight: bold; }
    #comments span.date { color: #666; font-size: .9em; }
  </style>
</head>
<body>
  <div id="comments"></div>

  <script>
    /**
     * Fetches comment data from an API and renders it safely into the DOM.
     *
     * @param {string} apiUrl - The endpoint returning a JSON array of comments.
     * @param {string|HTMLElement} container - CSS selector or element where comments will be inserted.
     */
    function fetchAndRenderComments(apiUrl, container) {
      const target = typeof container === 'string' ? document.querySelector(container) : container;
      if (!target) return;

      // Clear any existing content
      target.textContent = '';

      fetch(apiUrl)
        .then(res => {
          if (!res.ok) throw new Error('Network response was not ok');
          return res.json();
        })
        .then(comments => {
          const list = document.createElement('ul');

          comments.forEach(comment => {
            // Create list item
            const li = document.createElement('li');

            // Author (fallback to "Anonymous")
            const author = document.createElement('strong');
            author.textContent = comment.author || comment.name || 'Anonymous';
            li.appendChild(author);

            // Date (optional)
            if (comment.date) {
              const dateSpan = document.createElement('span');
              dateSpan.className = 'date';
              const d = new Date(comment.date);
              dateSpan.textContent = `(${d.toLocaleDateString()})`;
              li.appendChild(dateSpan);
            }

            // Comment text
            const body = document.createElement('p');
            body.textContent = comment.body || comment.text || '';
            li.appendChild(body);

            list.appendChild(li);
          });

          target.appendChild(list);
        })
        .catch(err => {
          const errorMsg = document.createElement('p');
          errorMsg.style.color = 'red';
          errorMsg.textContent = `Failed to load comments: ${err.message}`;
          target.appendChild(errorMsg);
        });
    }

    // Example usage with a public placeholder API
    fetchAndRenderComments(
      'https://jsonplaceholder.typicode.com/comments?_limit=10',
      '#comments'
    );
  </script>
</body>
</html>