<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comments Loader</title>
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
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .comments-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        .comment-item {
            border-bottom: 1px solid #eee;
            padding: 15px 0;
        }
        .comment-item:last-child {
            border-bottom: none;
        }
        .comment-author {
            font-weight: bold;
            color: #333;
            margin-bottom: 5px;
        }
        .comment-body {
            color: #666;
            line-height: 1.5;
            margin-bottom: 8px;
        }
        .comment-email {
            font-size: 0.9em;
            color: #999;
        }
        .loading {
            text-align: center;
            padding: 20px;
            color: #666;
        }
        .error {
            background-color: #fee;
            border: 1px solid #fcc;
            color: #c33;
            padding: 15px;
            border-radius: 4px;
            margin-bottom: 20px;
        }
        button {
            background-color: #007bff;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 1em;
        }
        button:hover {
            background-color: #0056b3;
        }
        button:disabled {
            background-color: #ccc;
            cursor: not-allowed;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Comments</h1>
        <button id="loadButton">Load Comments</button>
        <div id="errorContainer"></div>
        <div id="loadingContainer" class="loading" style="display: none;">Loading comments...</div>
        <ul id="commentsList" class="comments-list"></ul>
    </div>

    <script>
        // Function to safely create a comment element
        function createCommentElement(comment) {
            const li = document.createElement('li');
            li.className = 'comment-item';

            // Create author element
            const authorDiv = document.createElement('div');
            authorDiv.className = 'comment-author';
            authorDiv.textContent = comment.name || 'Anonymous';

            // Create email element
            const emailDiv = document.createElement('div');
            emailDiv.className = 'comment-email';
            emailDiv.textContent = `Email: ${comment.email || 'Not provided'}`;

            // Create body element
            const bodyDiv = document.createElement('div');
            bodyDiv.className = 'comment-body';
            bodyDiv.textContent = comment.body || 'No content';

            // Append elements in order
            li.appendChild(authorDiv);
            li.appendChild(emailDiv);
            li.appendChild(bodyDiv);

            return li;
        }

        // Function to display error message
        function displayError(message) {
            const errorContainer = document.getElementById('errorContainer');
            errorContainer.innerHTML = '';
            
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error';
            errorDiv.textContent = message;
            
            errorContainer.appendChild(errorDiv);
        }

        // Function to clear error message
        function clearError() {
            const errorContainer = document.getElementById('errorContainer');
            errorContainer.innerHTML = '';
        }

        // Main function to fetch and render comments
        async function fetchAndRenderComments() {
            const commentsList = document.getElementById('commentsList');
            const loadingContainer = document.getElementById('loadingContainer');
            const loadButton = document.getElementById('loadButton');
            
            try {
                // Clear previous content
                commentsList.innerHTML = '';
                clearError();
                
                // Show loading state
                loadingContainer.style.display = 'block';
                loadButton.disabled = true;
                
                // Fetch comments from API
                const response = await fetch('https://jsonplaceholder.typicode.com/comments?_limit=10');
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const comments = await response.json();
                
                // Hide loading state
                loadingContainer.style.display = 'none';
                
                // Validate we got an array
                if (!Array.isArray(comments)) {
                    throw new Error('Invalid response format');
                }
                
                // Render each comment safely
                comments.forEach(comment => {
                    const commentElement = createCommentElement(comment);
                    commentsList.appendChild(commentElement);
                });
                
                // If no comments, show message
                if (comments.length === 0) {
                    const emptyMessage = document.createElement('li');
                    emptyMessage.className = 'comment-item';
                    emptyMessage.textContent = 'No comments found';
                    commentsList.appendChild(emptyMessage);
                }
                
            } catch (error) {
                loadingContainer.style.display = 'none';
                displayError(`Error loading comments: ${error.message}`);
                console.error('Error:', error);
            } finally {
                loadButton.disabled = false;
            }
        }

        // Set up event listener
        document.getElementById('loadButton').addEventListener('click', fetchAndRenderComments);
    </script>
</body>
</html>