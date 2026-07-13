from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///products.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


class Product(db.Model):
    __tablename__ = "products"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    category = db.Column(db.String(100), nullable=False)
    price = db.Column(db.Float, nullable=False)
    description = db.Column(db.Text, nullable=True)
    stock = db.Column(db.Integer, default=0)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "price": self.price,
            "description": self.description,
            "stock": self.stock,
        }


@app.route("/api/products", methods=["GET"])
def filter_products():
    """
    Filter products by category, min_price, and max_price.

    Query Parameters:
        category   (str, optional):   Filter by product category (case-insensitive).
        min_price  (float, optional): Filter products with price >= min_price.
        max_price  (float, optional): Filter products with price <= max_price.
        page       (int, optional):   Page number for pagination (default: 1).
        per_page   (int, optional):   Results per page (default: 20, max: 100).

    Returns:
        JSON response containing matched products and metadata.
    """
    errors = {}

    # --- Extract and validate query parameters ---
    category = request.args.get("category", "").strip() or None

    raw_min = request.args.get("min_price")
    raw_max = request.args.get("max_price")

    min_price = None
    max_price = None

    if raw_min is not None:
        try:
            min_price = float(raw_min)
            if min_price < 0:
                errors["min_price"] = "min_price must be a non-negative number."
        except ValueError:
            errors["min_price"] = f"Invalid min_price value: '{raw_min}'. Must be a number."

    if raw_max is not None:
        try:
            max_price = float(raw_max)
            if max_price < 0:
                errors["max_price"] = "max_price must be a non-negative number."
        except ValueError:
            errors["max_price"] = f"Invalid max_price value: '{raw_max}'. Must be a number."

    if min_price is not None and max_price is not None and min_price > max_price:
        errors["price_range"] = "min_price cannot be greater than max_price."

    if errors:
        return jsonify({"success": False, "errors": errors}), 400

    # --- Pagination parameters ---
    try:
        page = int(request.args.get("page", 1))
        if page < 1:
            page = 1
    except ValueError:
        page = 1

    try:
        per_page = int(request.args.get("per_page", 20))
        per_page = min(max(per_page, 1), 100)  # clamp between 1 and 100
    except ValueError:
        per_page = 20

    # --- Build the query ---
    query = Product.query

    if category:
        query = query.filter(Product.category.ilike(f"%{category}%"))

    if min_price is not None:
        query = query.filter(Product.price >= min_price)

    if max_price is not None:
        query = query.filter(Product.price <= max_price)

    query = query.order_by(Product.price.asc())

    # --- Paginate ---
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    products = [product.to_dict() for product in paginated.items]

    # --- Build response ---
    response = {
        "success": True,
        "filters_applied": {
            "category": category,
            "min_price": min_price,
            "max_price": max_price,
        },
        "pagination": {
            "page": paginated.page,
            "per_page": paginated.per_page,
            "total_items": paginated.total,
            "total_pages": paginated.pages,
            "has_next": paginated.has_next,
            "has_prev": paginated.has_prev,
        },
        "count": len(products),
        "products": products,
    }

    return jsonify(response), 200


@app.route("/api/products/categories", methods=["GET"])
def get_categories():
    """Return a list of all distinct product categories."""
    categories = (
        db.session.query(Product.category)
        .distinct()
        .order_by(Product.category.asc())
        .all()
    )
    category_list = [row[0] for row in categories]
    return jsonify({"success": True, "categories": category_list}), 200


# --- Seed helper (for development/testing) ---
def seed_products():
    """Populate the database with sample products."""
    sample_products = [
        Product(name="Laptop Pro 15", category="Electronics", price=1299.99, description="High-performance laptop", stock=50),
        Product(name="Wireless Mouse", category="Electronics", price=29.99, description="Ergonomic wireless mouse", stock=200),
        Product(name="USB-C Hub", category="Electronics", price=49.99, description="7-in-1 USB-C hub", stock=150),
        Product(name="Running Shoes", category="Footwear", price=89.99, description="Lightweight running shoes", stock=80),
        Product(name="Leather Boots", category="Footwear", price=149.99, description="Classic leather boots", stock=40),
        Product(name="Yoga Mat", category="Sports", price=34.99, description="Non-slip yoga mat", stock=120),
        Product(name="Dumbbells Set", category="Sports", price=79.99, description="Adjustable dumbbells set", stock=60),
        Product(name="Coffee Maker", category="Kitchen", price=59.99, description="Drip coffee maker", stock=90),
        Product(name="Blender Pro", category="Kitchen", price=99.99, description="High-speed blender", stock=70),
        Product(name="Python Programming Book", category="Books", price=39.99, description="Learn Python from scratch", stock=200),
        Product(name="Design Patterns Book", category="Books", price=44.99, description="Gang of four patterns", stock=150),
    ]
    db.session.bulk_save_objects(sample_products)
    db.session.commit()
    print("Database seeded with sample products.")


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        if Product.query.count() == 0:
            seed_products()
    app.run(debug=True)