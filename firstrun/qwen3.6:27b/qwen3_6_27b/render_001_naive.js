<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comment Fetcher</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f4f4f9;
            display: flex;
            justify-content: center;
            padding-top: 50px;
            margin: 0;
        }

        .container {
            width: 100%;
            max-width: 600px;
            padding: 20px;
        }

        h1 {
            text-align: center;
            color: #333;
        }

        button {
            display: block;
            margin: 0 auto 20px auto;
            padding: 10px 20px;
            font-size: 16px;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            transition: background-color 0.2s;
        }

        button:hover {
            background-color: #0056b3;
        }

        button:disabled {
            background-color: #ccc;
            cursor: not-allowed;
        }

        .comment-list {
            list-style-type: none;
            padding: 0;
        }

        .comment-card {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            margin-bottom: 15px;
            padding: 15px;
            animation: fadeIn 0.5s ease-in;
        }

        .comment-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            border-bottom: 1px solid #eee;
            padding-bottom: 8px;
        }

        .username {
            font-weight: bold;
            color: #2c3e50;
        }

        .email {
            font-size: 0.85em;
            color: #7f8c8d;
        }

        .comment-body {
            line-height: 1.5;
            color: #444;
        }

        .error-msg {
            color: #e74c3c;
            text-align: center;
            font-weight: bold;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
    </style>
</head>
<body>

<div class="container">
    <h1>Comments Feed</h1>
    <button id="fetchBtn">Load Comments</button>
    <div id="commentsContainer"></div>
</div>

<script>
    /**
     * Fetches comments from the JSONPlaceholder API and renders them to the DOM.
     */
    async function fetchAndDisplayComments() {
        const container = document.getElementById('commentsContainer');
        const button = document.getElementById('fetchBtn');
        
        // UI State: Loading
        button.disabled = true;
        button.textContent = 'Loading...';
        container.innerHTML = '';

        try {
            // Fetch data from public API
            const response = await fetch('https://jsonplaceholder.typicode.com/comments?_limit=10');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const comments = await response.json();

            // Create a fragment to minimize DOM reflows
            const fragment = document.createDocumentFragment();

            comments.forEach(comment => {
                const card = document.createElement('div');
                card.className = 'comment-card';

                // Constructing the HTML structure for a single comment
                card.innerHTML = `
                    <div class="comment-header">
                        <span class="username">@${comment.name}</span>
                        <span class="email">${comment.email}</span>
                    </div>
                    <div class="comment-body">
                        ${escapeHtml(comment.body)}
                    </div>
                `;

                fragment.appendChild(card);
            });

            container.appendChild(fragment);

        } catch (error) {
            console.error('Failed to fetch comments:', error);
            container.innerHTML = `<p class="error-msg">Failed to load comments. Please try again later.</p>`;
        } finally {
            // UI State: Reset Button
            button.disabled = false;
            button.textContent = 'Load Comments';
        }
    }

    /**
     * Helper function to prevent XSS by escaping HTML characters in user-generated content.
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }

    // Attach event listener
    document.getElementById('fetchBtn').addEventListener('click', fetchAndDisplayComments);
</script>

</body>
</html>