from flask import Flask, request, jsonify

app = Flask(__name__)

# Mock database (in a real app, use a proper database like SQLite, PostgreSQL, etc.)
posts_db = {
    1: {"id": 1, "title": "First Post", "content": "Hello World!"},
    2: {"id": 2, "title": "Second Post", "content": "Flask is awesome!"}
}

@app.route('/api/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    if post_id not in posts_db:
        return jsonify({"error": "Post not found"}), 404

    del posts_db[post_id]
    return jsonify({"message": "Post deleted successfully"}), 200

if __name__ == '__main__':
    app.run(debug=True)