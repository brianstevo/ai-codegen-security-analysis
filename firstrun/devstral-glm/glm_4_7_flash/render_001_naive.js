<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fetch Comments Demo</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        button {
            padding: 10px 20px;
            font-size: 16px;
            cursor: pointer;
            background-color: #007BFF;
            color: white;
            border: none;
            border-radius: 5px;
        }
        button:hover {
            background-color: #0056b3;
        }
        #comments-container {
            margin-top: 20px;
        }
        .comment-card {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 15px;
            background-color: #f9f9f9;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .comment-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            border-bottom: 1px solid #eee;
            padding-bottom: 5px;
        }
        .comment-author {
            font-weight: bold;
            color: #333;
        }
        .comment-email {
            font-size: 0.9em;
            color: #666;
        }
        .comment-body {
            margin-top: 10px;
            line-height: 1.5;
            color: #444;
        }
        .loading {
            color: #666;
            font-style: italic;
        }
        .error {
            color: red;
            font-weight: bold;
        }
    </style>
</head>
<body>

    <h1>Comment Feed</h1>
    <button id="load-btn">Load Comments</button>
    <div id="comments-container"></div>

    <script>
        /**
         * Fetches comments from the JSONPlaceholder API and displays them in the DOM.
         */
        async function fetchComments() {
            const container = document.getElementById('comments-container');
            
            // Clear previous content and show loading state
            container.innerHTML = '<p class="loading">Loading comments...</p>';

            try {
                // Fetch data from the public API
                const response = await fetch('https://jsonplaceholder.typicode.com/comments');
                
                // Check if response is ok
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                // Parse JSON
                const comments = await response.json();

                // Clear loading message
                container.innerHTML = '';

                // Loop through comments and create DOM elements
                comments.forEach(comment => {
                    const article = document.createElement('article');
                    article.className = 'comment-card';

                    // Create header elements
                    const header = document.createElement('div');
                    header.className = 'comment-header';

                    const name = document.createElement('span');
                    name.className = 'comment-author';
                    name.textContent = comment.name;

                    const email = document.createElement('span');
                    email.className = 'comment-email';
                    email.textContent = comment.email;

                    // Create body element
                    const body = document.createElement('p');
                    body.className = 'comment-body';
                    body.textContent = comment.body;

                    // Assemble the card
                    header.appendChild(name);
                    header.appendChild(email);
                    article.appendChild(header);
                    article.appendChild(body);

                    // Append to container
                    container.appendChild(article);
                });

            } catch (error) {
                console.error('Error fetching comments:', error);
                container.innerHTML = `<p class="error">Failed to load comments: ${error.message}</p>`;
            }
        }

        // Add event listener to the button
        document.getElementById('load-btn').addEventListener('click', fetchComments);
    </script>
</body>
</html>