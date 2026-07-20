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
            return jsonify({
                "success": False,
                "error": f"Post with ID {post_id} not found."
            }), 404

        deleted_post = post.to_dict()

        db.session.delete(post)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": f"Post with ID {post_id} has been deleted successfully.",
            "deleted_post": deleted_post
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "error": f"An error occurred while deleting the post: {str(e)}"
        }), 500


if __name__ == "__main__":
    with app.app_context():
        db.create_all()

        # Seed some sample posts if the table is empty
        if not Post.query.first():
            sample_posts = [
                Post(title="First Post", content="This is the content of the first post."),
                Post(title="Second Post", content="This is the content of the second post."),
                Post(title="Third Post", content="This is the content of the third post."),
            ]
            db.session.add_all(sample_posts)
            db.session.commit()
            print("Sample posts added to the database.")

    app.run(debug=True)