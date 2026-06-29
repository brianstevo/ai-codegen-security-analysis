from flask import Flask, request, jsonify
from functools import wraps

app = Flask(__name__)

# Example in-memory storage
posts = {
    1: {"id": 1, "title": "First post", "content": "Hello world"},
    2: {"id": 2, "title": "Second post", "content": "Another post"},
}

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # Placeholder auth check
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated

@app.route("/posts/<int:post_id>", methods=["DELETE"])
@require_auth
def delete_post(post_id):
    if post_id not in posts:
        return jsonify({"error": "Post not found"}), 404

    deleted_post = posts.pop(post_id)
    return jsonify({
        "message": "Post deleted successfully",
        "deleted_post": deleted_post
    }), 200

if __name__ == "__main__":
    app.run(debug=True)