<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure Comment Renderer</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f4f4f9;
            color: #333;
            max-width: 800px;
            margin: 2rem auto;
            padding: 0 1rem;
        }

        h1 {
            text-align: center;
            color: #2c3e50;
        }

        .comment-container {
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }

        .comment-card {
            background: white;
            border-radius: 8px;
            padding: 1.5rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            border-left: 5px solid #3498db;
        }

        .comment-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.5rem;
            font-size: 0.9rem;
            color: #666;
        }

        .author-name {
            font-weight: bold;
            color: #2c3e50;
        }

        .comment-body {
            line-height: 1.6;
            white-space: pre-wrap; /* Preserves newlines in text */
        }

        .error-message {
            color: #e74c3c;
            background-color: #fadbd8;
            padding: 1rem;
            border-radius: 4px;
            text-align: center;
        }

        button {
            display: block;
            margin: 2rem auto;
            padding: 0.75rem 1.5rem;
            background-color: #3498db;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 1rem;
        }

        button:hover {
            background-color: #2980b9;
        }
    </style>
</head>
<body>

    <h1>Comments</h1>
    <div id="comments-list" class="comment-container">
        <!-- Comments will be injected here -->
    </div>
    <button id="fetch-btn">Load Comments</button>

    <script>
        /**
         * Renders a single comment object into the DOM.
         * Uses programmatic DOM creation and textContent to prevent XSS.
         * 
         * @param {Object} comment - The comment data object.
         * @returns {HTMLElement} The created comment element.
         */
        function createCommentElement(comment) {
            // Create the main container for the comment
            const card = document.createElement('div');
            card.className = 'comment-card';

            // Create header section (Author + Date)
            const header = document.createElement('div');
            header.className = 'comment-header';

            // Author Name
            const authorSpan = document.createElement('span');
            authorSpan.className = 'author-name';
            // Safe insertion: textContent escapes HTML entities automatically
            authorSpan.textContent = comment.author || 'Anonymous';

            // Date (optional, if present in data)
            const dateSpan = document.createElement('span');
            if (comment.date) {
                dateSpan.textContent = new Date(comment.date).toLocaleDateString();
            } else {
                dateSpan.textContent = '';
            }

            header.appendChild(authorSpan);
            header.appendChild(dateSpan);

            // Comment Body
            const body = document.createElement('div');
            body.className = 'comment-body';
            // Safe insertion: textContent escapes HTML entities automatically
            body.textContent = comment.body || '';

            // Assemble the card
            card.appendChild(header);
            card.appendChild(body);

            return card;
        }

        /**
         * Fetches comments from an API and renders them.
         */
        async function fetchAndRenderComments() {
            const container = document.getElementById('comments-list');
            const btn = document.getElementById('fetch-btn');

            // Clear previous content
            container.innerHTML = '';
            
            // Show loading state (optional)
            btn.disabled = true;
            btn.textContent = 'Loading...';

            try {
                // Using JSONPlaceholder as a mock API source
                const response = await fetch('https://jsonplaceholder.typicode.com/comments?_limit=5');
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const comments = await response.json();

                // Render each comment
                comments.forEach(comment => {
                    const commentElement = createCommentElement(comment);
                    container.appendChild(commentElement);
                });

            } catch (error) {
                console.error('Failed to fetch comments:', error);
                
                // Render error message safely
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error-message';
                errorDiv.textContent = 'Failed to load comments. Please try again later.';
                container.appendChild(errorDiv);

            } finally {
                btn.disabled = false;
                btn.textContent = 'Load Comments';
            }
        }

        // Attach event listener
        document.getElementById('fetch-btn').addEventListener('click', fetchAndRenderComments);

    </script>
</body>
</html>