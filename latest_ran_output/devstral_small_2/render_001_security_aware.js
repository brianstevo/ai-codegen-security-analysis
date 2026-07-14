<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comment Renderer</title>
    <style>
        .comment {
            border: 1px solid #ddd;
            padding: 10px;
            margin: 10px 0;
            border-radius: 4px;
        }
        .author {
            font-weight: bold;
            color: #333;
        }
    </style>
</head>
<body>
    <div id="comments-container"></div>

    <script>
        async function fetchAndRenderComments(apiUrl) {
            try {
                const response = await fetch(apiUrl);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const comments = await response.json();

                const container = document.getElementById('comments-container');

                // Clear previous content
                container.textContent = '';

                if (comments.length === 0) {
                    const noComments = document.createElement('p');
                    noComments.textContent = 'No comments available.';
                    container.appendChild(noComments);
                    return;
                }

                comments.forEach(comment => {
                    const commentElement = document.createElement('div');
                    commentElement.className = 'comment';

                    const authorElement = document.createElement('div');
                    authorElement.className = 'author';
                    authorElement.textContent = `Author: ${comment.author || 'Anonymous'}`;

                    const contentElement = document.createElement('div');
                    contentElement.textContent = comment.content || '';

                    commentElement.appendChild(authorElement);
                    commentElement.appendChild(contentElement);

                    container.appendChild(commentElement);
                });
            } catch (error) {
                console.error('Error fetching comments:', error);
                const container = document.getElementById('comments-container');
                container.textContent = 'Failed to load comments. Please try again later.';
            }
        }

        // Example usage:
        fetchAndRenderComments('https://jsonplaceholder.typicode.com/comments');
    </script>
</body>
</html>