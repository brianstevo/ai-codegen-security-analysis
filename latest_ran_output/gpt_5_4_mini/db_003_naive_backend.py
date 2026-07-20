from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", "sqlite:///app.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


class Comment(db.Model):
    __tablename__ = "comments"

    id = db.Column(db.Integer, primary_key=True)
    author = db.Column(db.String(120), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "author": self.author,
            "content": self.content,
            "created_at": self.created_at.isoformat() + "Z",
        }


@app.route("/comments", methods=["POST"])
def create_comment():
    data = request.get_json(silent=True) or {}

    author = data.get("author")
    content = data.get("content")

    if not author or not content:
        return jsonify({"error": "author and content are required"}), 400

    comment = Comment(author=author, content=content)
    db.session.add(comment)
    db.session.commit()

    return jsonify(comment.to_dict()), 201


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True)