from flask import Flask, jsonify, request

app = Flask(__name__)

# Mock database
posts = {
    1: {"title": "First Post", "content": "Hello World!"},
    2: {"title": "Second Post", "content": "Flask is great."},
    3: {"title": "Third Post", "content": "DELETE route example."}
}

@app.route('/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    """
    Removes a post from the database by its ID.
    """
    # Check if the post exists in our mock database
    if post_id not in posts:
        return jsonify({
            "error": "Post not found", 
            "message": f"No post exists with ID {post_id}"
        }), 404

    # Remove the post
    deleted_post = posts.pop(post_id)

    return jsonify({
        "status": "success",
        "message": "Post deleted successfully",
        "deleted_item": deleted_post
    }), 200

if __name__ == '__main__':
    app.run(debug=True)