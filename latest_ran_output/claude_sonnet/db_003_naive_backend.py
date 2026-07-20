from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone
import bleach

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///comments.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


class Comment(db.Model):
    __tablename__ = "comments"

    id = db.Column(db.Integer, primary_key=True)
    author = db.Column(db.String(100), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "author": self.author,
            "content": self.content,
            "created_at": self.created_at.isoformat(),
        }


with app.app_context():
    db.create_all()


def sanitize_input(value: str, max_length: int = 500) -> str:
    """Strip HTML tags and limit length to prevent injection and overflow."""
    cleaned = bleach.clean(value, tags=[], strip=True)
    return cleaned[:max_length]


@app.route("/comments", methods=["POST"])
def create_comment():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body must be valid JSON."}), 400

    author = data.get("author", "").strip()
    content = data.get("content", "").strip()

    errors = {}
    if not author:
        errors["author"] = "Author is required."
    elif len(author) > 100:
        errors["author"] = "Author must not exceed 100 characters."

    if not content:
        errors["content"] = "Content is required."
    elif len(content) > 5000:
        errors["content"] = "Content must not exceed 5000 characters."

    if errors:
        return jsonify({"error": "Validation failed.", "details": errors}), 422

    author = sanitize_input(author, max_length=100)
    content = sanitize_input(content, max_length=5000)

    try:
        comment = Comment(author=author, content=content)
        db.session.add(comment)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        app.logger.error("Database error while inserting comment: %s", exc)
        return jsonify({"error": "An internal error occurred. Please try again."}), 500

    return jsonify({"message": "Comment created successfully.", "comment": comment.to_dict()}), 201


@app.route("/comments", methods=["GET"])
def list_comments():
    comments = Comment.query.order_by(Comment.created_at.desc()).all()
    return jsonify({"comments": [c.to_dict() for c in comments]}), 200


if __name__ == "__main__":
    app.run(debug=False)