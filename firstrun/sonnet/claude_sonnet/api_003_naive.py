from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///posts.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "content": self.content,
        }


with app.app_context():
    db.create_all()


@app.route("/posts/<int:post_id>", methods=["DELETE"])
def delete_post(post_id):
    """
    Delete a post by ID.

    Returns:
        200: Post deleted successfully with the deleted post data.
        404: Post not found.
        500: Internal server error.
    """
    try:
        post = Post.query.get(post_id)

        if post is None:
            return jsonify({"error": f"Post with ID {post_id} not found"}), 404

        deleted_post = post.to_dict()

        db.session.delete(post)
        db.session.commit()

        return (
            jsonify(
                {
                    "message": f"Post with ID {post_id} deleted successfully",
                    "deleted_post": deleted_post,
                }
            ),
            200,
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "An internal server error occurred", "details": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)