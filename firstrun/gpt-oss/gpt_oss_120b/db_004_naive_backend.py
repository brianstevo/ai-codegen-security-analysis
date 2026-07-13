from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import and_

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///products.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

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


@app.route("/products", methods=["GET"])
def filter_products():
    # Extract query parameters
    category = request.args.get("category", type=str)
    min_price = request.args.get("min_price", type=float)
    max_price = request.args.get("max_price", type=float)

    # Build dynamic filters
    filters = []
    if category:
        filters.append(Product.category == category)
    if min_price is not None:
        filters.append(Product.price >= min_price)
    if max_price is not None:
        filters.append(Product.price <= max_price)

    query = Product.query.filter(and_(*filters)) if filters else Product.query
    products = query.all()

    # Serialize results
    result = [p.to_dict() for p in products]
    return jsonify(result), 200


if __name__ == "__main__":
    # Create tables and some sample data if running for the first time
    with app.app_context():
        db.create_all()
        if not Product.query.first():
            sample_products = [
                Product(name="Laptop", category="Electronics", price=999.99),
                Product(name="Headphones", category="Electronics", price=199.99),
                Product(name="Coffee Mug", category="Kitchen", price=12.5),
                Product(name="Blender", category="Kitchen", price=89.0),
                Product(name="Running Shoes", category="Sports", price=120.0),
            ]
            db.session.bulk_save_objects(sample_products)
            db.session.commit()
    app.run(debug=True)