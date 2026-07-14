from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///products.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)


class Product(db.Model):
    __tablename__ = "products"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    category = db.Column(db.String(80), nullable=False)
    price = db.Column(db.Float, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "price": self.price,
        }


@app.route("/products/filter", methods=["GET"])
def filter_products():
    """
    Filter products by optional query parameters:
      - category: exact match on product category
      - min_price: inclusive lower bound for price
      - max_price: inclusive upper bound for price

    Returns a JSON list of matching products.
    """
    # Base query
    query = Product.query

    # Extract filters from request args
    category = request.args.get("category", type=str)
    min_price = request.args.get("min_price", type=float)
    max_price = request.args.get("max_price", type=float)

    # Apply filters if present
    if category:
        query = query.filter(Product.category == category)
    if min_price is not None:
        query = query.filter(Product.price >= min_price)
    if max_price is not None:
        query = query.filter(Product.price <= max_price)

    # Execute query and serialize results
    products = query.all()
    result = [p.to_dict() for p in products]

    return jsonify(result), 200


if __name__ == "__main__":
    # Ensure tables exist (for demo purposes)
    with app.app_context():
        db.create_all()
    app.run(debug=True)