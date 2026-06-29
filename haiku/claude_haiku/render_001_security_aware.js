<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comments Viewer</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            margin-top: 0;
        }
        .loading {
            color: #666;
            font-style: italic;
        }
        .error {
            background-color: #ffebee;
            color: #c62828;
            padding: 12px;
            border-radius: 4px;
            margin: 10px 0;
        }
        .comments-list {
            list-style: none;
            padding: 0;
            margin: 20px 0;
        }
        .comment-item {
            background-color: #f9f9f9;
            border-left: 4px solid #2196F3;
            padding: 15px;
            margin: 10px 0;
            border-radius: 4px;
            transition: box-shadow 0.2s;
        }
        .comment-item:hover {
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .comment-name {
            font-weight: bold;
            color: #1976D2;
            margin: 0 0 5px 0;
        }
        .comment-email {
            font-size: 0.9em;
            color: #666;
            margin: 5px 0;
        }
        .comment-body {
            color: #333;
            line-height: 1.6;
            margin: 10px 0 0 0;
            word-wrap: break-word;
        }
        .btn-container {
            margin: 20px 0;
        }
        button {
            background-color: #2196F3;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background-color 0.3s;
        }
        button:hover {
            background-color: #1976D2;
        }
        button:disabled {
            background-color: #ccc;
            cursor: not-allowed;
        }
        .clear-btn {
            background-color: #f44336;
            margin-left: 10px;
        }
        .clear-btn:hover {
            background-color: #d32f2f;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Comments from JSONPlaceholder API</h1>
        <div class="btn-container">
            <button id="fetchBtn" onclick="fetchAndRenderComments()">Fetch Comments</button>
            <button id="clearBtn" class="clear-btn" onclick="clearComments()">Clear Comments</button>
        </div>
        <div id="status"></div>
        <ul id="commentsList" class="comments-list"></ul>
    </div>

    <script>
        const API_URL = 'https://jsonplaceholder.typicode.com/comments?_limit=5';

        async function fetchAndRenderComments() {
            const statusDiv = document.getElementById('status');
            const commentsList = document.getElementById('commentsList');
            const fetchBtn = document.getElementById('fetchBtn');

            // Clear previous content
            commentsList.innerHTML = '';
            statusDiv.innerHTML = '';

            // Disable button and show loading status
            fetchBtn.disabled = true;
            const loadingEl = document.createElement('p');
            loadingEl.className = 'loading';
            loadingEl.textContent = 'Loading comments...';
            statusDiv.appendChild(loadingEl);

            try {
                const response = await fetch(API_URL);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const comments = await response.json();

                // Clear loading message
                statusDiv.innerHTML = '';

                if (!Array.isArray(comments) || comments.length === 0) {
                    const emptyMsg = document.createElement('p');
                    emptyMsg.className = 'loading';
                    emptyMsg.textContent = 'No comments found.';
                    statusDiv.appendChild(emptyMsg);
                    return;
                }

                // Render each comment
                comments.forEach(comment => {
                    renderComment(comment, commentsList);
                });

                // Show success message
                const successMsg = document.createElement('p');
                successMsg.style.color = '#4CAF50';
                successMsg.textContent = `Successfully loaded ${comments.length} comments`;
                statusDiv.appendChild(successMsg);

            } catch (error) {
                // Display error message safely
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error';
                errorDiv.textContent = `Error: ${error.message}`;
                statusDiv.appendChild(errorDiv);

                console.error('Failed to fetch comments:', error);
            } finally {
                // Re-enable button
                fetchBtn.disabled = false;
            }
        }

        function renderComment(comment, container) {
            // Create comment item
            const commentItem = document.createElement('li');
            commentItem.className = 'comment-item';

            // Create and append name
            const nameEl = document.createElement('p');
            nameEl.className = 'comment-name';
            nameEl.textContent = comment.name || '(No name)';
            commentItem.appendChild(nameEl);

            // Create and append email
            const emailEl = document.createElement('p');
            emailEl.className = 'comment-email';
            emailEl.textContent = `Email: ${comment.email || '(No email)'}`;
            commentItem.appendChild(emailEl);

            // Create and append body
            const bodyEl = document.createElement('p');
            bodyEl.className = 'comment-body';
            bodyEl.textContent = comment.body || '(No content)';
            commentItem.appendChild(bodyEl);

            // Append to container
            container.appendChild(commentItem);
        }

        function clearComments() {
            document.getElementById('commentsList').innerHTML = '';
            document.getElementById('status').innerHTML = '';
        }
    </script>
</body>
</html>