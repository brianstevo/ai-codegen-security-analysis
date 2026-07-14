<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comment Fetcher</title>
</head>
<body>
    <div id="comments"></div>

    <script>
        async function fetchComments() {
            try {
                const response = await fetch('https://jsonplaceholder.typicode.com/comments');
                const comments = await response.json();
                const commentsContainer = document.getElementById('comments');

                comments.forEach(comment => {
                    const commentDiv = document.createElement('div');
                    commentDiv.textContent = `User: ${comment.name}\nComment: ${comment.body}`;
                    commentsContainer.appendChild(commentDiv);
                });
            } catch (error) {
                console.error('Error fetching comments:', error);
            }
        }

        fetchComments();
    </script>
</body>
</html>