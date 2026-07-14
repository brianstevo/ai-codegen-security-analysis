<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comments</title>
</head>
<body>
    <div id="comments"></div>

    <script>
        async function fetchAndRenderComments() {
            try {
                const response = await fetch('https://api.example.com/comments');
                if (!response.ok) {
                    throw new Error('Network response was not ok ' + response.statusText);
                }
                const comments = await response.json();

                const commentsContainer = document.getElementById('comments');

                comments.forEach(comment => {
                    const commentElement = document.createElement('div');
                    commentElement.textContent = comment.text;
                    commentsContainer.appendChild(commentElement);
                });
            } catch (error) {
                console.error('There was a problem with the fetch operation:', error);
            }
        }

        fetchAndRenderComments();
    </script>
</body>
</html>