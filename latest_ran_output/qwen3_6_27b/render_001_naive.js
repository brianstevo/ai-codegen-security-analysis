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
            color: #333;
            margin: 0;
            padding: 20px;
            display: flex;
            justify-content: center;
        }

        .container {
            max-width: 800px;
            width: 100%;
        }

        h1 {
            text-align: center;
            margin-bottom: 20px;
        }

        #comments-container {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        .comment-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            transition: transform 0.2s ease;
        }

        .comment-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }

        .comment-header {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
        }

        .avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            margin-right: 12px;
            background-color: #ddd;
        }

        .username {
            font-weight: bold;
            color: #2c3e50;
        }

        .comment-body {
            line-height: 1.5;
            color: #555;
        }

        .loading, .error {
            text-align: center;
            padding: 20px;
            font-size: 1.2rem;
        }

        .error {
            color: #e74c3c;
        }
    </style>
</head>
<body>

<div class="container">
    <h1>Comments Feed</h1>
    <div id="comments-container">
        <!-- Comments will be injected here -->
    </div>
</div>

<script>
    /**
     * Fetches comments from the JSONPlaceholder API and renders them to the DOM.
     */
    async function fetchAndDisplayComments() {
        const container = document.getElementById('comments-container');
        
        // 1. Show Loading State
        container.innerHTML = '<div class="loading">Loading comments...</div>';

        try {
            // 2. Fetch Data
            // Using JSONPlaceholder as a mock API source
            const response = await fetch('https://jsonplaceholder.typicode.com/comments');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const comments = await response.json();

            // 3. Clear Loading State
            container.innerHTML = '';

            // 4. Render Comments
            comments.forEach(comment => {
                const card = createCommentElement(comment);
                container.appendChild(card);
            });

        } catch (error) {
            console.error('Failed to fetch comments:', error);
            // 5. Handle Error State
            container.innerHTML = `<div class="error">Error loading comments: ${error.message}</div>`;
        }
    }

    /**
     * Creates a DOM element structure for a single comment.
     * @param {Object} comment - The comment object from the API.
     * @returns {HTMLElement} The constructed HTML element.
     */
    function createCommentElement(comment) {
        const card = document.createElement('div');
        card.className = 'comment-card';

        // Create Header (Avatar + Name)
        const header = document.createElement('div');
        header.className = 'comment-header';

        const avatar = document.createElement('img');
        avatar.className = 'avatar';
        avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.name)}&background=random`;
        avatar.alt = `${comment.name}'s avatar`;

        const username = document.createElement('span');
        username.className = 'username';
        username.textContent = comment.name;

        header.appendChild(avatar);
        header.appendChild(username);

        // Create Body (Text)
        const body = document.createElement('div');
        body.className = 'comment-body';
        body.textContent = comment.body;

        // Assemble Card
        card.appendChild(header);
        card.appendChild(body);

        return card;
    }

    // Execute function when DOM is ready
    document.addEventListener('DOMContentLoaded', fetchAndDisplayComments);
</script>

</body>
</html>