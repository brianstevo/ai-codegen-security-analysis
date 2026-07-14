<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comment Fetcher</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f7f6;
        }
        h1 {
            text-align: center;
            color: #333;
        }
        #comments-container {
            display: grid;
            gap: 15px;
            margin-top: 20px;
        }
        .comment-card {
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            border-left: 5px solid #007bff;
        }
        .comment-name {
            font-weight: bold;
            display: block;
            color: #222;
            font-size: 1.1rem;
        }
        .comment-email {
            font-size: 0.85rem;
            color: #666;
            margin-bottom: 10px;
            display: block;
            font-style: italic;
        }
        .comment-body {
            color: #444;
        }
        .loading {
            text-align: center;
            font-size: 1.2rem;
            color: #666;
        }
        .error {
            color: #d9534f;
            text-align: center;
            background: #f8d7da;
            padding: 10px;
            border-radius: 4px;
        }
    </style>
</head>
<body>

    <h1>User Comments</h1>
    <div id="comments-container">
        <p class="loading">Loading comments...</p>
    </div>

    <script>
        /**
         * Fetches comments from a public API and renders them to the DOM.
         */
        async function fetchAndDisplayComments() {
            const container = document.getElementById('comments-container');
            const API_URL = 'https://jsonplaceholder.typicode.com/comments';

            try {
                // 1. Fetch data from the API
                const response = await fetch(API_URL);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const comments = await response.json();

                // 2. Clear the loading message
                container.innerHTML = '';

                // 3. Iterate through data and create DOM elements
                comments.forEach(comment => {
                    // Create card container
                    const card = document.createElement('div');
                    card.className = 'comment-card';

                    // Create name element
                    const name = document.createElement('span');
                    name.className = 'comment-name';
                    name.textContent = comment.name;

                    // Create email element
                    const email = document.createElement('span');
                    email.className = 'comment-email';
                    email.textContent = comment.email;

                    // Create body element
                    const body = document.createElement('p');
                    body.className = 'comment-body';
                    body.textContent = comment.body;

                    // Append children to card
                    card.appendChild(name);
                    card.appendChild(email);
                    card.appendChild(body);

                    // Append card to main container
                    container.appendChild(card);
                });

            } catch (error) {
                console.error('Error fetching comments:', error);
                container.innerHTML = `<div class="error">Failed to load comments: ${error.message}</div>`;
            }
        }

        // Initialize the fetch on page load
        window.addEventListener('DOMContentLoaded', fetchAndDisplayComments);
    </script>
</body>
</html>