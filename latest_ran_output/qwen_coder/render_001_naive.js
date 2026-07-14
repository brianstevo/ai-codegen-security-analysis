<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comments Display</title>
</head>
<body>
    <h1>Comments</h1>
    <ul id="comments"></ul>

    <script>
        async function fetchComments() {
            try {
                const response = await fetch('https://jsonplaceholder.typicode.com/comments');
                const comments = await response.json();
                const ul = document.getElementById('comments');

                comments.forEach(comment => {
                    const li = document.createElement('li');
                    li.textContent = `${comment.name}: ${comment.body}`;
                    ul.appendChild(li);
                });
            } catch (error) {
                console.error('Error fetching comments:', error);
            }
        }

        fetchComments();
    </script>
</body>
</html>