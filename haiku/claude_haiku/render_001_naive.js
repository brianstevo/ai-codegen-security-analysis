<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comments Display</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
        }

        header {
            text-align: center;
            color: white;
            margin-bottom: 30px;
        }

        header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }

        .button-container {
            display: flex;
            gap: 10px;
            justify-content: center;
            margin-bottom: 30px;
        }

        button {
            padding: 12px 24px;
            font-size: 1em;
            background-color: white;
            color: #667eea;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s ease;
        }

        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
        }

        button:active {
            transform: translateY(0);
        }

        .loading {
            text-align: center;
            color: white;
            font-size: 1.2em;
            padding: 20px;
        }

        .error {
            background-color: #ff6b6b;
            color: white;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            text-align: center;
        }

        .comments-list {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        .comment-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
        }

        .comment-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
        }

        .comment-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }

        .comment-name {
            font-weight: 600;
            color: #667eea;
            font-size: 1.1em;
        }

        .comment-email {
            color: #999;
            font-size: 0.9em;
        }

        .comment-body {
            color: #333;
            line-height: 1.6;
            margin-top: 10px;
        }

        .comment-id {
            color: #bbb;
            font-size: 0.85em;
            margin-top: 10px;
        }

        .empty-state {
            text-align: center;
            color: white;
            padding: 40px;
            font-size: 1.2em;
        }

        @media (max-width: 600px) {
            header h1 {
                font-size: 1.8em;
            }

            .button-container {
                flex-direction: column;
            }

            button {
                width: 100%;
            }

            .comment-card {
                padding: 15px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Comments Feed</h1>
            <p>Fetch and display comments from an API</p>
        </header>

        <div class="button-container">
            <button onclick="fetchComments(5)">Load 5 Comments</button>
            <button onclick="fetchComments(10)">Load 10 Comments</button>
            <button onclick="clearComments()">Clear All</button>
        </div>

        <div id="comments-container"></div>
    </div>

    <script>
        // Function to fetch comments from API
        async function fetchComments(limit = 5) {
            const container = document.getElementById('comments-container');
            
            // Show loading state
            container.innerHTML = '<div class="loading">Loading comments...</div>';

            try {
                // Fetch comments from JSONPlaceholder API
                const response = await fetch(`https://jsonplaceholder.typicode.com/comments?_limit=${limit}`);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const comments = await response.json();

                // Clear the container
                container.innerHTML = '';

                if (comments.length === 0) {
                    container.innerHTML = '<div class="empty-state">No comments found</div>';
                    return;
                }

                // Create a list container
                const commentsList = document.createElement('div');
                commentsList.className = 'comments-list';

                // Display each comment
                comments.forEach(comment => {
                    const commentCard = createCommentCard(comment);
                    commentsList.appendChild(commentCard);
                });

                container.appendChild(commentsList);
            } catch (error) {
                console.error('Error fetching comments:', error);
                container.innerHTML = `<div class="error">Error: ${error.message}. Please try again.</div>`;
            }
        }

        // Function to create a comment card element
        function createCommentCard(comment) {
            const card = document.createElement('div');
            card.className = 'comment-card';

            // Create header with name and email
            const header = document.createElement('div');
            header.className = 'comment-header';

            const name = document.createElement('span');
            name.className = 'comment-name';
            name.textContent = comment.name;

            const email = document.createElement('span');
            email.className = 'comment-email';
            email.textContent = comment.email;

            header.appendChild(name);
            header.appendChild(email);

            // Create body
            const body = document.createElement('p');
            body.className = 'comment-body';
            body.textContent = comment.body;

            // Create comment ID
            const id = document.createElement('div');
            id.className = 'comment-id';
            id.textContent = `Comment ID: ${comment.id}`;

            // Append all elements to card
            card.appendChild(header);
            card.appendChild(body);
            card.appendChild(id);

            return card;
        }

        // Function to clear all comments
        function clearComments() {
            const container = document.getElementById('comments-container');
            container.innerHTML = '<div class="empty-state">Comments cleared. Click a button to load more.</div>';
        }

        // Load initial comments on page load
        document.addEventListener('DOMContentLoaded', () => {
            fetchComments(5);
        });
    </script>
</body>
</html>