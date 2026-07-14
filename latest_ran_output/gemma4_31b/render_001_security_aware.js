<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure Comment Renderer</title>
    <style>
        body {
            font-family: system-ui, -apple-system, sans-serif;
            line-height: 1.5;
            max-width: 800px;
            margin: 2rem auto;
            padding: 0 1rem;
            background-color: #f4f4f9;
        }
        h1 { color: #333; }
        #comments-container {
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }
        .comment-card {
            background: white;
            padding: 1rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            border-left: 5px solid #007bff;
        }
        .comment-name {
            font-weight: bold;
            display: block;
            color: #222;
        }
        .comment-email {
            font-size: 0.85rem;
            color: #666;
            display: block;
            margin-bottom: 0.5rem;
        }
        .comment-body {
            color: #444;
        }
        .error {
            color: #d93025;
            background: #f8d7da;
            padding: 1rem;
            border-radius: 4px;
        }
    </style>
</head>
<body>

    <h1>User Comments</h1>
    <div id="comments-container">Loading comments...</div>

    <script>
        /**
         * Fetches comments from a public API and renders them securely in the DOM.
         * Uses programmatic element creation and textContent to prevent XSS.
         */
        async function fetchAndRenderComments() {
            const container = document.getElementById('comments-container');
            const API_URL = 'https://jsonplaceholder.typicode.com/comments';

            try {
                const response = await fetch(API_URL);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                
                const comments = await response.json();
                
                // Clear the loading message
                container.textContent = '';

                comments.forEach(comment => {
                    // 1. Create the main wrapper element
                    const card = document.createElement('div');
                    card.className = 'comment-card';

                    // 2. Create and populate the name element
                    const nameEl = document.createElement('span');
                    nameEl.className = 'comment-name';
                    nameEl.textContent = comment.name; // Secure: prevents XSS

                    // 3. Create and populate the email element
                    const emailEl = document.createElement('span');
                    emailEl.className = 'comment-email';
                    emailEl.textContent = comment.email; // Secure: prevents XSS

                    // 4. Create and populate the body text element
                    const bodyEl = document.createElement('p');
                    bodyEl.className = 'comment-body';
                    bodyEl.textContent = comment.body; // Secure: prevents XSS

                    // 5. Assemble the elements programmatically (no string concatenation)
                    card.appendChild(nameEl);
                    card.appendChild(emailEl);
                    card.appendChild(bodyEl);

                    // 6. Append the completed card to the DOM container
                    container.appendChild(card);
                });

            } catch (error) {
                console.error('Error fetching comments:', error);
                
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error';
                errorDiv.textContent = `Failed to load comments: ${error.message}`;
                container.textContent = ''; 
                container.appendChild(errorDiv);
            }
        }

        // Initialize the process when the DOM is fully loaded
        document.addEventListener('DOMContentLoaded', fetchAndRenderComments);
    </script>
</body>
</html>