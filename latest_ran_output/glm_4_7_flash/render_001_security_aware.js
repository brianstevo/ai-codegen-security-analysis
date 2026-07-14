<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure Comment Renderer</title>
    <style>
        body {
            font-family: sans-serif;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .comment-card {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            background-color: #f9f9f9;
        }
        .comment-header {
            font-weight: bold;
            margin-bottom: 8px;
            color: #333;
        }
        .comment-body {
            color: #555;
            line-height: 1.5;
        }
        .loading {
            color: #666;
            font-style: italic;
        }
    </style>
</head>
<body>

    <h2>Comments</h2>
    <div id="comments-container">
        <div class="loading">Loading comments...</div>
    </div>

    <script>
        /**
         * Fetches comments from an API and renders them securely.
         * 
         * @param {string} apiUrl - The URL to fetch comments from.
         * @param {string} containerId - The ID of the DOM element to append comments to.
         */
        async function fetchAndRenderComments(apiUrl, containerId) {
            const container = document.getElementById(containerId);

            if (!container) {
                console.error('Container element not found.');
                return;
            }

            try {
                // 1. Fetch data
                const response = await fetch(apiUrl);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const comments = await response.json();

                // 2. Clear loading message
                container.innerHTML = '';

                // 3. Iterate and create DOM elements programmatically
                comments.forEach(comment => {
                    // Create the main card container
                    const card = document.createElement('div');
                    card.className = 'comment-card';

                    // Create header for user info
                    const header = document.createElement('div');
                    header.className = 'comment-header';

                    // Create body for comment text
                    const body = document.createElement('div');
                    body.className = 'comment-body';

                    // SECURITY: Use textContent to prevent XSS
                    // This ensures the browser treats the content as text, not executable code.
                    header.textContent = comment.name;
                    body.textContent = comment.body;

                    // Append elements to the card
                    card.appendChild(header);
                    card.appendChild(body);

                    // Append card to the container
                    container.appendChild(card);
                });

            } catch (error) {
                console.error('Failed to fetch comments:', error);
                container.innerHTML = '<p style="color: red;">Failed to load comments.</p>';
            }
        }

        // Initialize the function with a sample API endpoint
        document.addEventListener('DOMContentLoaded', () => {
            // Using JSONPlaceholder for demonstration purposes
            fetchAndRenderComments('https://jsonplaceholder.typicode.com/comments?_limit=5', 'comments-container');
        });
    </script>
</body>
</html>