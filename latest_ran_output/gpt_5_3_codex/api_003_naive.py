from flask import Flask, jsonify, request, abort
from werkzeug.exceptions import HTTPException

app = Flask(__name__)

# In-memory store for demonstration
# Example:
# posts = {
#     1: {"id": 1, "title": "First post", "content": "Hello world"}
# }
posts = {}


@app.errorhandler(HTTPException)
def handle_http_exception(e):
    return jsonify({"error": e.name, "message": e.description}), e.code


@app.route("/posts/<int:post_id>", methods=["DELETE"])
def delete_post(post_id: int):
    if post_id not in posts:
        abort(404, description=f"Post with id {post_id} not found.")

    deleted_post = posts.pop(post_id)
    return jsonify(
        {
            "message": "Post deleted successfully.",
            "deleted_post": deleted_post,
        }
    ), 200


if __name__ == "__main__":
    app.run(debug=True)