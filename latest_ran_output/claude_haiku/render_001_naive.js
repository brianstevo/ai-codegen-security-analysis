<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comments Display</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        h1 {
            color: #333;
            text-align: center;
        }
        .loading {
            text-align: center;
            color: #666;
            font-size: 18px;
            padding: 20px;
        }
        .error {
            background-color: #fee;
            color: #c33;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            border: 1px solid #fcc;
        }
        .comments-container {
            display: grid;
            gap: 15px;
        }
        .comment {
            background-color: white;
            padding: 20px;
            border-radius: 5px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            border-left: 4px solid #007bff;
        }
        .comment-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            flex-wrap: wrap;
            gap: 10px;
        }
        .comment-name {
            font-weight: bold;
            color: #333;
        }
        .comment-email {
            color: #666;
            font-size: 14px;
        }
        .comment-id {
            background-color: #e8f4f8;
            color: #007bff;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: bold;
        }
        .comment-body {
            color: #555;
            line-height: 1.6;
            margin: 10px 0;
        }
        .retry-btn {
            background-color: #007bff;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            margin-top: 10px;
        }
        .retry-btn:hover {
            background-color: #0056b3;
        }
    </style>
</head>
<body>
    <h1>Comments</h1>
    <div id="content"></div>
    
    <script>
        const contentDiv = document.getElementById('content');
        
        async function fetchAndDisplayComments(postId = 1, limit = 10) {
            contentDiv.innerHTML = '<div class="loading">Loading comments...</div>';
            
            try {
                const response = await fetch(
                    `https://jsonplaceholder.typicode.com/comments?postId=${postId}&_limit=${limit}`
                );
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const comments = await response.json();
                
                if (comments.length === 0) {
                    contentDiv.innerHTML = '<div class="error">No comments found.</div>';
                    return;
                }
                
                displayComments(comments);
            } catch (error) {
                contentDiv.innerHTML = `
                    <div class="error">
                        <strong>Error loading comments:</strong> ${error.message}
                        <button class="retry-btn" onclick="location.reload()">Retry</button>
                    </div>
                `;
                console.error('Error fetching comments:', error);
            }
        }
        
        function displayComments(comments) {
            const commentsHtml = comments.map(comment => `
                <div class="comment">
                    <div class="comment-header">
                        <div>
                            <div class="comment-name">${escapeHtml(comment.name)}</div>
                            <div class="comment-email">${escapeHtml(comment.email)}</div>
                        </div>
                        <div class="comment-id">ID: ${comment.id}</div>
                    </div>
                    <div class="comment-body">${escapeHtml(comment.body)}</div>
                </div>
            `).join('');
            
            contentDiv.innerHTML = `<div class="comments-container">${commentsHtml}</div>`;
        }
        
        function escapeHtml(unsafe) {
            return unsafe
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }
        
        fetchAndDisplayComments(1, 10);
    </script>
</body>
</html>