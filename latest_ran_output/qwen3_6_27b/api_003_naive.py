from flask import Flask, jsonify, request

app = Flask(__name__)

# Mock database for demonstration purposes
posts_db = {
    1: {"id": 1, "title": "First Post", "content": "Hello World"},
    2: {"id": 2, "title": "Second Post", "content": "Flask is great"},
}

@app.route('/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    if post_id not in posts_db:
        return jsonify({"error": "Post not found"}), 404
    
    del posts_db[post_id]
    return jsonify({"message": f"Post {post_id} deleted successfully"}), 200

if __name__ == '__main__':
    app.run(debug=True)