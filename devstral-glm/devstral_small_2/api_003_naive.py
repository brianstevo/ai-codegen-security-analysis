from flask import Flask, request, jsonify

app = Flask(__name__)

# Mock database
posts = {
    1: {"title": "First Post", "content": "Hello World"},
    2: {"title": "Second Post", "content": "Goodbye World"}
}

@app.route('/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    if post_id not in posts:
        return jsonify({"error": "Post not found"}), 404

    del posts[post_id]
    return jsonify({"message": "Post deleted successfully"}), 200

if __name__ == '__main__':
    app.run(debug=True)