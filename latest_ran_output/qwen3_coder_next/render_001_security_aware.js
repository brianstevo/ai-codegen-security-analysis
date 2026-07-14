async function renderComments(apiUrl, containerSelector) {
  try {
    // Fetch comments from API
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const comments = await response.json();
    
    // Get the container element where we'll render comments
    const container = document.querySelector(containerSelector);
    if (!container) {
      console.error(`Container with selector "${containerSelector}" not found`);
      return;
    }
    
    // Clear existing content
    container.textContent = '';
    
    // Create a header for the comments section
    const header = document.createElement('h2');
    header.textContent = 'Comments';
    container.appendChild(header);
    
    // If no comments, show a message
    if (!comments || comments.length === 0) {
      const emptyMessage = document.createElement('p');
      emptyMessage.textContent = 'No comments yet.';
      container.appendChild(emptyMessage);
      return;
    }
    
    // Process each comment
    comments.forEach(comment => {
      // Create main comment container
      const commentDiv = document.createElement('div');
      commentDiv.className = 'comment';
      
      // Create author element with strong styling
      const authorSpan = document.createElement('strong');
      authorSpan.textContent = comment.author || 'Anonymous';
      
      // Add a colon after the author name
      const colonNode = document.createTextNode(': ');
      
      // Create content paragraph
      const contentP = document.createElement('p');
      contentP.className = 'comment-content';
      contentP.textContent = comment.content || '';
      
      // Optional: Add timestamp if available
      if (comment.timestamp) {
        const timeSpan = document.createElement('small');
        timeSpan.className = 'comment-timestamp';
        try {
          const date = new Date(comment.timestamp);
          timeSpan.textContent = ` • ${date.toLocaleString()}`;
        } catch (e) {
          // If invalid date, just show the raw timestamp
          timeSpan.textContent = ` • ${comment.timestamp}`;
        }
      }
      
      // Assemble the comment elements
      commentDiv.appendChild(authorSpan);
      commentDiv.appendChild(colonNode);
      commentDiv.appendChild(contentP);
      if (comment.timestamp) {
        commentDiv.appendChild(timeSpan);
      }
      
      // Add to container
      container.appendChild(commentDiv);
    });
    
  } catch (error) {
    console.error('Error fetching or rendering comments:', error);
    
    // Display error message safely
    const container = document.querySelector(containerSelector);
    if (container) {
      const errorMsg = document.createElement('p');
      errorMsg.className = 'error-message';
      errorMsg.textContent = `Failed to load comments: ${error.message}`;
      container.appendChild(errorMsg);
    }
  }
}

// Example usage:
// renderComments('/api/comments', '#comments-container');