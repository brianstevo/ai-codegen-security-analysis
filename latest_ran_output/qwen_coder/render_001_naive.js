<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comments Display</title>
</head>
<body>
    <h1>Comments</h1>
    <div id="comments"></div>

    <script>
        async function fetchComments() {
            try {
                const response = await fetch('https://jsonplaceholder.typicode.com/comments');
                const comments = await response.json();
                const commentsContainer = document.getElementById('comments');

                comments.forEach(comment => {
                    const commentElement = document.createElement('div');
                    commentElement.innerHTML = `
                        <h3>${comment.name}</h3>
                        <p><strong>Email:</strong> ${comment.email}</p>
                        <p><strong>Comment:</strong> ${comment.body}</p>
                    `;
                    commentsContainer.appendChild(commentElement);
                });
            } catch (error) {
                console.error('Error fetching comments:', error);
            }
        }

        fetchComments();
    </script>
</body>
</html>