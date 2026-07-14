from flask import Flask, jsonify, request

app = Flask(__name__)

# Mock database: A list of posts represented as dictionaries
posts = [
    {"id": 1, "title": "First Post", "content": "Hello World!"},
    {"id": 2, "title": "Second Post", "content": "Flask is great."},
    {"id": 3, "title": "Third Post", "content": "Learning REST APIs."}
]

@app.route('/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    """
    Deletes a post by its ID.
    Returns 204 No Content on success, or 404 Not Found if the post doesn't exist.
    """
    global posts
    
    # Find the index of the post with the matching ID
    post_index = next((index for (index, post) in enumerate(posts) if post["id"] == post_id), None)

    if post_index is None:
        return jsonify({"error": "Post not found"}), 404

    # Remove the post from the list
    del posts[post_index]

    # 204 No Content is the standard response for a successful DELETE request 
    # where no body is returned.
    return '', 204

if __name__ == '__main__':
    app.run(debug=True)