<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API Comments Fetcher</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f4f7f6;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 2rem;
            margin: 0;
        }

        h1 {
            color: #333;
        }

        #comments-container {
            width: 100%;
            max-width: 600px;
            display: grid;
            gap: 1rem;
        }

        .comment-card {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            border-left: 5px solid #007bff;
            transition: transform 0.2s ease;
        }

        .comment-card:hover {
            transform: translateY(-2px);
        }

        .comment-name {
            font-weight: bold;
            font-size: 1.1rem;
            margin: 0 0 0.25rem 0;
            color: #222;
            text-transform: capitalize;
        }

        .comment-email {
            font-size: 0.85rem;
            color: #666;
            margin-bottom: 1rem;
            display: block;
        }

        .comment-body {
            font-size: 1rem;
            line-height: 1.5;
            color: #444;
            margin: 0;
        }

        .loading {
            text-align: center;
            font-style: italic;
            color: #888;
        }

        .error {
            color: #d9534f;
            background: #fdf7f7;
            padding: 1rem;
            border-radius: 4px;
            border: 1px solid #d9534f;
            text-align: center;
        }

        button {
            margin-bottom: 2rem;
            padding: 0.75rem 1.5rem;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 1rem;
        }

        button:hover {
            background-color: #0056b3;
        }
    </style>
</head>
<body>

    <h1>User Comments</h1>
    <button id="load-btn">Load Comments</button>
    <div id="comments-container"></div>

    <script>
        /**
         * Fetches comments from a public API and renders them to the DOM.
         */
        async function displayComments() {
            const container = document.getElementById('comments-container');
            const btn = document.getElementById('load-btn');
            
            // Show loading state
            container.innerHTML = '<p class="loading">Fetching comments from API...</p>';
            btn.disabled = true;

            try {
                // Fetch data from JSONPlaceholder (a free fake API)
                const response = await fetch('https://jsonplaceholder.typicode.com/comments');
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const comments = await response.json();

                // Clear loading text
                container.innerHTML = '';

                // Iterate through the array and create DOM elements
                comments.forEach(comment => {
                    const card = document.createElement('div');
                    card.className = 'comment-card';

                    // Using innerHTML for brevity, but using template literals 
                    // to structure the content of each comment
                    card.innerHTML = `
                        <p class="comment-name">${comment.name}</p>
                        <span class="comment-email">${comment.email}</span>
                        <p class="comment-body">${comment.body}</p>
                    `;

                    container.appendChild(card);
                });

            } catch (error) {
                console.error('Error fetching comments:', error);
                container.innerHTML = `
                    <div class="error">
                        <strong>Oops!</strong> Something went wrong while loading the comments.<br>
                        ${error.message}
                    </div>
                `;
            } finally {
                btn.disabled = false;
            }
        }

        // Event listener for the button
        document.getElementById('load-btn').addEventListener('click', displayComments);

        // Optional: Load comments automatically on page load
        // window.addEventListener('DOMContentLoaded', displayComments);
    </script>
</body>
</html>