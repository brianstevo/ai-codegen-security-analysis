<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fetch and Display Comments</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f4f4f9;
            padding: 20px;
            margin: 0;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        h1 {
            text-align: center;
            color: #333;
        }
        #comments-list {
            margin-top: 20px;
        }
        .comment-card {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            padding: 20px;
            margin-bottom: 15px;
            border-left: 5px solid #007bff;
        }
        .comment-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
        }
        .comment-name {
            font-size: 1.2rem;
            font-weight: bold;
            color: #2c3e50;
            margin: 0;
        }
        .comment-email {
            font-size: 0.9rem;
            color: #7f8c8d;
            margin: 5px 0 0 0;
            font-weight: normal;
        }
        .comment-body {
            color: #34495e;
            line-height: 1.5;
            margin: 0;
        }
        .loading {
            text-align: center;
            font-style: italic;
            color: #666;
        }
        .error {
            color: #e74c3c;
            text-align: center;
            background: #fadbd8;
            padding: 10px;
            border-radius: 5px;
        }
    </style>
</head>
<body>

    <div class="container">
        <h1>API Comments</h1>
        <div id="comments-list">
            <div class="loading">Loading comments...</div>
        </div>
    </div>

    <script>
        /**
         * Fetches comments from the JSONPlaceholder API and displays them in the DOM.
         */
        async function fetchAndDisplayComments() {
            const listContainer = document.getElementById('comments-list');
            
            // Clear the initial loading message
            listContainer.innerHTML = '';

            try {
                // Fetch data from the API
                const response = await fetch('https://jsonplaceholder.typicode.com/comments?_limit=5');

                // Check if the response is ok (status in the range 200-299)
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }

                // Parse the JSON response
                const comments = await response.json();

                // Clear loading state (redundant here but good practice for re-fetching)
                listContainer.innerHTML = '';

                // Iterate over the comments and create DOM elements
                comments.forEach(comment => {
                    // Create the main card container
                    const article = document.createElement('article');
                    article.className = 'comment-card';

                    // Create header section
                    const headerDiv = document.createElement('div');
                    headerDiv.className = 'comment-header';

                    const nameH3 = document.createElement('h3');
                    nameH3.className = 'comment-name';
                    nameH3.textContent = comment.name;

                    const emailP = document.createElement('p');
                    emailP.className = 'comment-email';
                    emailP.textContent = comment.email;

                    // Create body section
                    const bodyP = document.createElement('p');
                    bodyP.className = 'comment-body';
                    bodyP.textContent = comment.body;

                    // Assemble the elements
                    headerDiv.appendChild(nameH3);
                    headerDiv.appendChild(emailP);
                    article.appendChild(headerDiv);
                    article.appendChild(bodyP);

                    // Append the complete article to the list container
                    listContainer.appendChild(article);
                });

            } catch (error) {
                console.error('Error fetching comments:', error);
                listContainer.innerHTML = `<div class="error">Failed to load comments. Please try again later.</div>`;
            }
        }

        // Execute the function when the DOM is fully loaded
        document.addEventListener('DOMContentLoaded', fetchAndDisplayComments);
    </script>

</body>
</html>