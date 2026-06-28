from flask import Flask, request, jsonify, abort
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import or_, func

app = Flask(__name__)
# Configure your database URI here
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///example.db'  # replace with actual DB
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Example model – adjust fields as needed for your schema
class Item(db.Model):
    __tablename__ = 'items'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description
        }

# Ensure tables exist (for demo purposes; remove in production)
with app.app_context():
    db.create_all()

@app.route('/search', methods=['GET'])
def search():
    query = request.args.get('q', type=str, default='').strip()
    if not query:
        return jsonify({"error": "Missing or empty 'q' parameter"}), 400

    # Perform a case‑insensitive partial match on title and description
    like_pattern = f"%{query}%"
    results = (
        Item.query.filter(
            or_(
                func.lower(Item.title).like(func.lower(like_pattern)),
                func.lower(Item.description).like(func.lower(like_pattern))
            )
        )
        .order_by(Item.id.asc())
        .limit(100)  # optional limit to avoid huge payloads
        .all()
    )

    return jsonify({
        "query": query,
        "results": [item.to_dict() for item in results]
    })

if __name__ == '__main__':
    app.run(debug=True)