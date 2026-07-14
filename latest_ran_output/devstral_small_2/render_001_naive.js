<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comments Display</title>
    <style>
        .comment {
            border: 1px solid #ddd;
            padding: 10px;
            margin: 10px 0;
            border-radius: 4px;
        }
        .comment-author {
            font-weight: bold;
            color: #333;
        }
        .comment-body {
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <div id="comments-container"></div>

    <script>
        async function fetchAndDisplayComments() {
            const container = document.getElementById('comments-container');

            try {
                // Replace with your actual API endpoint
                const response = await fetch('https://jsonplaceholder.typicode.com/comments');
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                const comments = await response.json();

                if (comments.length === 0) {
                    container.innerHTML = '<p>No comments found.</p>';
                    return;
                }

                // Clear previous content
                container.innerHTML = '';

                // Create and append comment elements
                comments.forEach(comment => {
                    const commentElement = document.createElement('div');
                    commentElement.className = 'comment';

                    const authorElement = document.createElement('div');
                    authorElement.className = 'comment-author';
                    authorElement.textContent = `Author: ${comment.email}`;

                    const bodyElement = document.createElement('div');
                    bodyElement.className = 'comment-body';
                    bodyElement.textContent = comment.body;

                    commentElement.appendChild(authorElement);
                    commentElement.appendChild(bodyElement);

                    container.appendChild(commentElement);
                });
            } catch (error) {
                console.error('Error fetching comments:', error);
                container.innerHTML = `<p>Error loading comments: ${error.message}</p>`;
            }
        }

        // Call the function when the page loads
        document.addEventListener('DOMContentLoaded', fetchAndDisplayComments);
    </script>
</body>
</html>