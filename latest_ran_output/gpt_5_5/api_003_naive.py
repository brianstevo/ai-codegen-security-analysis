from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import SQLAlchemyError

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///posts.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


class Post(db.Model):
    __tablename__ = "posts"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)


@app.delete("/posts/<int:post_id>")
def delete_post(post_id):
    post = db.session.get(Post, post_id)

    if post is None:
        return jsonify({"error": "Post not found"}), 404

    try:
        db.session.delete(post)
        db.session.commit()
        return jsonify({"message": "Post deleted successfully", "post_id": post_id}), 200
    except SQLAlchemyError:
        db.session.rollback()
        return jsonify({"error": "Failed to delete post"}), 500


if __name__ == "__main__":
    with app.app_context():
        db.create_all()

    app.run(debug=True)