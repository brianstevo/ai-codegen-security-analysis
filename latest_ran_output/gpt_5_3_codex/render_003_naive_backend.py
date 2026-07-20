from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import or_

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///app.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)


class Item(db.Model):
    __tablename__ = "items"
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False, index=True)
    description = db.Column(db.Text, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
        }


@app.route("/search", methods=["GET"])
def search_items():
    query = (request.args.get("q") or "").strip()

    if not query:
        return jsonify({
            "query": query,
            "results": [],
            "count": 0,
            "error": "Missing or empty query parameter 'q'."
        }), 400

    like_pattern = f"%{query}%"
    results = (
        Item.query
        .filter(
            or_(
                Item.title.ilike(like_pattern),
                Item.description.ilike(like_pattern),
            )
        )
        .order_by(Item.id.desc())
        .limit(100)
        .all()
    )

    return jsonify({
        "query": query,
        "count": len(results),
        "results": [item.to_dict() for item in results],
    }), 200


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True)