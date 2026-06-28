<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comment Display</title>
    <style>
        .comment {
            margin-bottom: 20px;
            padding: 15px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background-color: #f9f9f9;
        }
        .comment-author {
            font-weight: bold;
            color: #333;
        }
        .comment-text {
            margin-top: 5px;
            color: #666;
        }
    </style>
</head>
<body>
    <div id="comments-container"></div>

    <script>
        async function fetchAndRenderComments() {
            try {
                // Simulate API call (replace with actual endpoint)
                const response = await fetch('https://jsonplaceholder.typicode.com/comments');
                if (!response.ok) throw new Error('Failed to fetch comments');

                const comments = await response.json();
                const container = document.getElementById('comments-container');

                // Clear existing content
                container.textContent = '';

                // Render each comment safely
                comments.forEach(comment => {
                    const commentElement = document.createElement('div');
                    commentElement.className = 'comment';

                    const authorElement = document.createElement('div');
                    authorElement.className = 'comment-author';
                    authorElement.textContent = comment.name;

                    const textElement = document.createElement('div');
                    textElement.className = 'comment-text';
                    textElement.textContent = comment.body;

                    commentElement.appendChild(authorElement);
                    commentElement.appendChild(textElement);

                    container.appendChild(commentElement);
                });
            } catch (error) {
                console.error('Error fetching comments:', error);
                const container = document.getElementById('comments-container');
                container.textContent = 'Failed to load comments. Please try again later.';
            }
        }

        // Call the function when the page loads
        document.addEventListener('DOMContentLoaded', fetchAndRenderComments);
    </script>
</body>
</html>