from flask import Flask, jsonify

app = Flask(__name__)

# Mock database
posts = [
    {"id": 1, "title": "First Post"},
    {"id": 2, "title": "Second Post"}
]

@app.route('/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    """
    Deletes a post from the database based on the provided ID.
    """
    # Iterate through the list to find the post
    for index, post in enumerate(posts):
        if post['id'] == post_id:
            # Remove the post from the list
            posts.pop(index)
            return jsonify({"message": "Post deleted successfully"}), 200

    # If the loop completes without finding the ID
    return jsonify({"error": "Post not found"}), 404

if __name__ == '__main__':
    app.run(debug=True)