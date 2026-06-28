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

        .controls {
            display: flex;
            justify-content: center;
            margin-bottom: 2rem;
        }

        button {
            padding: 10px 20px;
            font-size: 1rem;
            cursor: pointer;
            background-color: #3498db;
            color: white;
            border: none;
            border-radius: 4px;
            transition: background-color 0.2s;
        }

        button:hover {
            background-color: #2980b9;
        }

        button:disabled {
            background-color: #bdc3c7;
            cursor: not-allowed;
        }

        #comments-container {
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }

        .comment-card {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            border-left: 4px solid #3498db;
        }

        .comment-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.5rem;
            font-size: 0.9rem;
            color: #7f8c8d;
        }

        .comment-author {
            font-weight: bold;
            color: #2c3e50;
        }

        .comment-body {
            line-height: 1.6;
        }

        .error-message {
            color: #e74c3c;
            text-align: center;
            font-weight: bold;
        }
    </style>
</head>
<body>

    <h1>Secure Comment Feed</h1>
    
    <div class="controls">
        <button id="fetch-btn">Load Comments</button>
    </div>

    <div id="comments-container"></div>

    <script>
        // Configuration
        const API_URL = 'https://jsonplaceholder.typicode.com/comments?_limit=5';
        
        // DOM Elements
        const container = document.getElementById('comments-container');
        const fetchBtn = document.getElementById('fetch-btn');

        /**
         * Fetches comments from the API and renders them securely.
         */
        async function loadComments() {
            // UI State: Loading
            fetchBtn.disabled = true;
            fetchBtn.textContent = 'Loading...';
            container.innerHTML = ''; // Clear previous content

            try {
                const response = await fetch(API_URL);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                renderComments(data);

            } catch (error) {
                console.error('Failed to fetch comments:', error);
                const errorNode = document.createElement('div');
                errorNode.className = 'error-message';
                // Safe text insertion
                errorNode.textContent = `Error: ${error.message}`;
                container.appendChild(errorNode);
            } finally {
                // UI State: Ready
                fetchBtn.disabled = false;
                fetchBtn.textContent = 'Load Comments';
            }
        }

        /**
         * Renders an array of comment objects into the DOM.
         * Uses programmatic DOM creation and textContent to prevent XSS.
         * 
         * @param {Array} comments - Array of comment objects from API
         */
        function renderComments(comments) {
            if (!Array.isArray(comments) || comments.length === 0) {
                const emptyMsg = document.createElement('p');
                emptyMsg.textContent = 'No comments found.';
                container.appendChild(emptyMsg);
                return;
            }

            // Create a DocumentFragment for efficient DOM insertion
            const fragment = document.createDocumentFragment();

            comments.forEach(comment => {
                // 1. Create the main card container
                const card = document.createElement('div');
                card.className = 'comment-card';

                // 2. Create header section (Author & ID)
                const header = document.createElement('div');
                header.className = 'comment-header';

                const authorSpan = document.createElement('span');
                authorSpan.className = 'comment-author';
                // SECURITY: Use textContent to render user data safely
                authorSpan.textContent = comment.name || 'Anonymous';

                const idSpan = document.createElement('span');
                idSpan.textContent = `ID: ${comment.id}`;

                header.appendChild(authorSpan);
                header.appendChild(idSpan);

                // 3. Create body section (The actual comment text)
                const body = document.createElement('div');
                body.className = 'comment-body';
                // SECURITY: Use textContent to render user data safely
                // This prevents execution of any <script> tags or event handlers in the string
                body.textContent = comment.body;

                // 4. Assemble the card
                card.appendChild(header);
                card.appendChild(body);

                // 5. Add to fragment
                fragment.appendChild(card);
            });

            // Append all comments at once
            container.appendChild(fragment);
        }

        // Event Listener
        fetchBtn.addEventListener('click', loadComments);

    </script>
</body>
</html>