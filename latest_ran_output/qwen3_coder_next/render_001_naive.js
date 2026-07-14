/**
 * Fetches comments from an API endpoint and renders them to the page.
 * 
 * @param {string} apiUrl - The URL of the JSON API endpoint (e.g., 'https://jsonplaceholder.typicode.com/comments')
 */
async function displayComments(apiUrl) {
  try {
    // Get a reference to the container where we want to display the comments
    const container = document.getElementById('comments-container');
    
    if (!container) {
      console.error("Error: Element with ID 'comments-container' not found in DOM.");
      return;
    }

    // Show a loading state
    container.innerHTML = '<p>Loading comments...</p>';

    // Fetch data from the API
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const comments = await response.json();

    // Clear the loading text
    container.innerHTML = '';

    // Create a header for the list
    const title = document.createElement('h2');
    title.textContent = 'Comments';
    container.appendChild(title);

    // Iterate over the data and create DOM elements
    comments.forEach(comment => {
      // Create a card/container for each comment
      const commentCard = document.createElement('div');
      commentCard.className = 'comment-card';

      // Create Name element
      const nameEl = document.createElement('h3');
      nameEl.textContent = comment.name;
      
      // Create Email element (optional styling)
      const emailEl = document.createElement('p');
      emailEl.className = 'comment-email';
      emailEl.textContent = `Email: ${comment.email}`;

      // Create Body element
      const bodyEl = document.createElement('p');
      bodyEl.className = 'comment-body';
      bodyEl.textContent = comment.body;

      // Append elements to the card
      commentCard.appendChild(nameEl);
      commentCard.appendChild(emailEl);
      commentCard.appendChild(bodyEl);

      // Append the card to the main container
      container.appendChild(commentCard);
    });

  } catch (error) {
    console.error('Failed to fetch comments:', error);
    const container = document.getElementById('comments-container');
    if (container) {
      container.innerHTML = `<p style="color: red;">Error loading comments: ${error.message}</p>`;
    }
  }
}

// Example usage:
// displayComments('https://jsonplaceholder.typicode.com/comments');