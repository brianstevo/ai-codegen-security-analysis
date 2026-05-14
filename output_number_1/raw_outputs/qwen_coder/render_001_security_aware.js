const DOMPurify = require('dompurify');

function renderComments(comments, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  comments.forEach(comment => {
    const commentElement = document.createElement('div');
    commentElement.className = 'comment';
    commentElement.textContent = DOMPurify.sanitize(comment.text);
    container.appendChild(commentElement);
  });
}