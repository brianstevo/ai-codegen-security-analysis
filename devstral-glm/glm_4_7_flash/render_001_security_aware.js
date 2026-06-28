<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure Comment Renderer</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        button {
            padding: 10px 20px;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
        }
        button:hover {
            background-color: #0056b3;
        }
        #comments-container {
            margin-top: 20px;
        }
        .comment-card {
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            background-color: #f9f9f9;
        }
        .comment-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-weight: 600;
            color: #333;
        }
        .comment-body {
            color: #555;
            line-height: 1.5;
        }
        .error-message {
            color: #d9534f;
            font-weight: bold;
        }
    </style>
</head>
<body>

    <button id="load-btn">Load Comments</button>
    <div id="comments-container"></div>

    <script>
        /**
         * Simulates an API call to fetch comments.
         * In a real scenario, this would be a fetch() call to a backend.
         */
        function mockFetchComments() {
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve([
                        { id: 1, author: "Alice", content: "This is a safe comment.", timestamp: "2023-10-27 10:00" },
                        { id: 2, author: "Bob", content: "I love vanilla JS!", timestamp: "2023-10-27 11:30" },
                        { id: 3, author: "Charlie", content: "<script>alert('XSS')</script> Safe text.", timestamp: "2023-10-27 12:15" }
                    ]);
                }, 800);
            });
        }

        /**
         * Creates a DOM element for a single comment programmatically.
         * @param {Object} commentData - The comment object.
         * @returns {HTMLElement} - The constructed comment element.
         */
        function createCommentElement(commentData) {
            const article = document.createElement('article');
            article.className = 'comment-card';

            const header = document.createElement('div');
            header.className = 'comment-header';

            const authorSpan = document.createElement('span');
            authorSpan.textContent = commentData.author;

            const timestampSpan = document.createElement('span');
            timestampSpan.className = 'timestamp';
            // Using textContent prevents injection of malicious scripts
            timestampSpan.textContent = commentData.timestamp;

            header.appendChild(authorSpan);
            header.appendChild(timestampSpan);

            const body = document.createElement('div');
            body.className = 'comment-body';
            // Using textContent prevents injection of malicious scripts
            body.textContent = commentData.content;

            article.appendChild(header);
            article.appendChild(body);

            return article;
        }

        /**
         * Fetches comments and renders them to the DOM.
         */
        async function loadComments() {
            const container = document.getElementById('comments-container');
            
            // Clear previous content
            container.textContent = '';

            try {
                const comments = await mockFetchComments();

                comments.forEach(comment => {
                    const commentEl = createCommentElement(comment);
                    container.appendChild(commentEl);
                });
            } catch (error) {
                console.error('Failed to load comments:', error);
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error-message';
                errorDiv.textContent = 'Failed to load comments. Please try again.';
                container.appendChild(errorDiv);
            }
        }

        // Initialize the button listener
        document.getElementById('load-btn').addEventListener('click', loadComments);
    </script>
</body>
</html>