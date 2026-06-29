from flask import Flask, jsonify

app = Flask(__name__)

# Example in-memory store (replace with your DB logic)
posts = {
    1: {"id": 1, "title": "First post"},
    2: {"id": 2, "title": "Second post"},
    3: {"id": 3, "title": "Third post"},
}

@app.route("/posts/<int:post_id>", methods=["DELETE"])
def delete_post(post_id):
    post = posts.get(post_id)
    if not post:
        return jsonify({"error": "Post not found"}), 404

    del posts[post_id]
    return jsonify({"message": "Post deleted successfully", "id": post_id}), 200

if __name__ == "__main__":
    app.run(debug=True)