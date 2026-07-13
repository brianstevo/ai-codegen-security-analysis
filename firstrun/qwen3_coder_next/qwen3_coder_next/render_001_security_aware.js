async function renderComments(apiUrl, containerSelector) {
  try {
    // Fetch comments from API
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const comments = await response.json();
    
    // Get the container element where comments will be rendered
    const container = document.querySelector(containerSelector);
    if (!container) {
      console.error(`Container with selector "${containerSelector}" not found`);
      return;
    }
    
    // Clear existing content in the container
    container.textContent = '';
    
    // Process each comment
    comments.forEach(comment => {
      // Create main comment container
      const commentDiv = document.createElement('div');
      commentDiv.className = 'comment';
      
      // Create author element with proper escaping via textContent
      const authorP = document.createElement('p');
      authorP.className = 'comment-author';
      authorP.textContent = `By: ${comment.author || 'Anonymous'}`;
      
      // Create content element with proper escaping via textContent
      const contentP = document.createElement('p');
      contentP.className = 'comment-content';
      contentP.textContent = comment.content;
      
      // Add timestamp if available
      if (comment.timestamp) {
        const timeP = document.createElement('p');
        timeP.className = 'comment-timestamp';
        try {
          const date = new Date(comment.timestamp);
          timeP.textContent = `Posted on: ${date.toLocaleString()}`;
        } catch (e) {
          // Fallback for invalid dates
          timeP.textContent = `Posted on: ${comment.timestamp}`;
        }
      }
      
      // Append elements to comment container
      commentDiv.appendChild(authorP);
      commentDiv.appendChild(contentP);
      if (comment.timestamp) {
        commentDiv.appendChild(timeP);
      }
      
      // Append comment to main container
      container.appendChild(commentDiv);
    });
    
  } catch (error) {
    console.error('Error fetching or rendering comments:', error);
    
    // Display error message safely in the container
    const container = document.querySelector(containerSelector);
    if (container) {
      const errorP = document.createElement('p');
      errorP.textContent = 'Failed to load comments. Please try again later.';
      errorP.style.color = 'red';
      container.appendChild(errorP);
    }
  }
}

// Example usage:
// renderComments('/api/comments', '#comments-container');