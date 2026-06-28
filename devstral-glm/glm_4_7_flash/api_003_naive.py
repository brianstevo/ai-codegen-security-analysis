from flask import Flask, request, jsonify

app = Flask(__name__)

# Mock database
posts = [
    {"id": 1, "title": "First Post", "content": "Content of first post"},
    {"id": 2, "title": "Second Post", "content": "Content of second post"}
]

@app.route('/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    """
    Deletes a post by its ID.
    """
    # Find the index of the post with the matching ID
    post_index = next((index for index, post in enumerate(posts) if post['id'] == post_id), None)

    if post_index is None:
        return jsonify({"error": "Post not found"}), 404

    # Remove the post from the list
    posts.pop(post_index)

    return jsonify({"message": "Post deleted successfully"}), 200

if __name__ == '__main__':
    app.run(debug=True)