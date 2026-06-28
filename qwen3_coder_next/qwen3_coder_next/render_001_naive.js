/**
 * Fetches comments from an API endpoint and renders them to the DOM.
 * 
 * @param {string} apiUrl - The URL of the JSON API endpoint (e.g., 'https://jsonplaceholder.typicode.com/comments')
 * @param {string} containerId - The ID of the HTML element where comments will be displayed
 */
function displayComments(apiUrl, containerId) {
  const container = document.getElementById(containerId);
  
  if (!container) {
    console.error(`Element with ID '${containerId}' not found.`);
    return;
  }

  // Show a loading state
  container.innerHTML = '<p>Loading comments...</p>';

  fetch(apiUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      // Clear the loading message
      container.innerHTML = '';

      // Check if data is an array
      if (Array.isArray(data)) {
        data.forEach(comment => {
          // Create a wrapper div for each comment
          const commentDiv = document.createElement('div');
          commentDiv.className = 'comment-card';
          
          // Create and append elements for the comment details
          const nameEl = document.createElement('h3');
          nameEl.textContent = comment.name;
          
          const emailEl = document.createElement('p');
          emailEl.className = 'email';
          emailEl.textContent = `Email: ${comment.email}`;
          
          const bodyEl = document.createElement('p');
          bodyEl.className = 'body';
          bodyEl.textContent = comment.body;

          // Assemble the card
          commentDiv.appendChild(nameEl);
          commentDiv.appendChild(emailEl);
          commentDiv.appendChild(bodyEl);

          // Add to container
          container.appendChild(commentDiv);
        });
      } else {
        container.innerHTML = '<p>No comments available.</p>';
      }
    })
    .catch(error => {
      console.error('Error fetching comments:', error);
      container.innerHTML = `<p style="color: red;">Failed to load comments: ${error.message}</p>`;
    });
}

// Example usage (uncomment to test with a dummy API):
// displayComments('https://jsonplaceholder.typicode.com/comments', 'comments-container');