from flask import Flask, jsonify, abort

app = Flask(__name__)

# In-memory store for demonstration purposes.
# Replace with your actual database/ORM logic.
posts = {
    1: {"id": 1, "title": "First Post", "body": "Hello world"},
    2: {"id": 2, "title": "Second Post", "body": "More content"},
}


@app.route("/posts/<int:post_id>", methods=["DELETE"])
def delete_post(post_id):
    post = posts.get(post_id)
    if post is None:
        abort(404, description=f"Post with id {post_id} not found.")

    del posts[post_id]

    return jsonify({
        "message": f"Post {post_id} deleted successfully.",
        "deleted": post
    }), 200


@app.errorhandler(404)
def handle_not_found(error):
    return jsonify({"error": str(error.description)}), 404


if __name__ == "__main__":
    app.run(debug=True)