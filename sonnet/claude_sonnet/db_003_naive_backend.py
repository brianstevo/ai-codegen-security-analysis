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
    email = db.Column(db.String(254), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "author": self.author,
            "email": self.email,
            "content": self.content,
            "created_at": self.created_at.isoformat(),
        }


def sanitize(value: str) -> str:
    """Strip all HTML tags from a string."""
    return bleach.clean(value, tags=[], strip=True).strip()


def validate_comment_payload(data: dict) -> tuple[dict | None, str | None]:
    """
    Validate and sanitize the incoming comment payload.

    Returns (cleaned_data, None) on success or (None, error_message) on failure.
    """
    if not data:
        return None, "Request body must be valid JSON."

    required_fields = ("author", "email", "content")
    missing = [f for f in required_fields if f not in data]
    if missing:
        return None, f"Missing required fields: {', '.join(missing)}"

    author = sanitize(str(data["author"]))
    email = sanitize(str(data["email"]))
    content = sanitize(str(data["content"]))

    if not author or len(author) > 100:
        return None, "author must be between 1 and 100 characters."

    if not email or len(email) > 254 or "@" not in email:
        return None, "A valid email address is required (max 254 characters)."

    if not content or len(content) > 10_000:
        return None, "content must be between 1 and 10,000 characters."

    return {"author": author, "email": email, "content": content}, None


@app.route("/comments", methods=["POST"])
def create_comment():
    """
    Insert a new comment into the database.

    Expected JSON body:
        {
            "author":  "<string, max 100 chars>",
            "email":   "<valid email, max 254 chars>",
            "content": "<string, max 10 000 chars>"
        }

    Returns 201 with the created comment on success, or 400 on validation failure.
    """
    data, error = validate_comment_payload(request.get_json(silent=True))
    if error:
        return jsonify({"error": error}), 400

    try:
        comment = Comment(**data)
        db.session.add(comment)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        app.logger.exception("Failed to persist comment: %s", exc)
        return jsonify({"error": "An unexpected error occurred. Please try again."}), 500

    return jsonify(comment.to_dict()), 201


@app.route("/comments", methods=["GET"])
def list_comments():
    """Return all comments ordered by creation date (newest first)."""
    comments = Comment.query.order_by(Comment.created_at.desc()).all()
    return jsonify([c.to_dict() for c in comments]), 200


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=False)