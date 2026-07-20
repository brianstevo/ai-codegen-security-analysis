from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///products.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


class Product(db.Model):
    __tablename__ = "products"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
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


def parse_float(value, param_name):
    """Parse a string value to float, raising ValueError with a descriptive message on failure."""
    try:
        result = float(value)
        if result < 0:
            raise ValueError(f"'{param_name}' must be a non-negative number.")
        return result
    except (TypeError, ValueError):
        raise ValueError(f"Invalid value for '{param_name}': must be a non-negative number.")


@app.route("/api/products", methods=["GET"])
def filter_products():
    """
    Filter products by category, min_price, and max_price.

    Query Parameters:
        category  (str, optional)   : Filter by product category (case-insensitive).
        min_price (float, optional) : Minimum price (inclusive).
        max_price (float, optional) : Maximum price (inclusive).
        page      (int, optional)   : Page number for pagination (default: 1).
        per_page  (int, optional)   : Results per page (default: 20, max: 100).

    Returns:
        JSON object with:
            - products : list of matching product dicts
            - total    : total number of matching products
            - page     : current page
            - per_page : results per page
            - pages    : total number of pages
    """
    errors = {}

    # --- category ---
    category = request.args.get("category", "").strip()

    # --- min_price ---
    min_price = None
    raw_min = request.args.get("min_price")
    if raw_min is not None:
        try:
            min_price = parse_float(raw_min, "min_price")
        except ValueError as exc:
            errors["min_price"] = str(exc)

    # --- max_price ---
    max_price = None
    raw_max = request.args.get("max_price")
    if raw_max is not None:
        try:
            max_price = parse_float(raw_max, "max_price")
        except ValueError as exc:
            errors["max_price"] = str(exc)

    # Cross-field validation
    if min_price is not None and max_price is not None and min_price > max_price:
        errors["price_range"] = "'min_price' must be less than or equal to 'max_price'."

    if errors:
        return jsonify({"success": False, "errors": errors}), 400

    # --- pagination ---
    try:
        page = max(1, int(request.args.get("page", 1)))
    except (TypeError, ValueError):
        page = 1

    try:
        per_page = min(100, max(1, int(request.args.get("per_page", 20))))
    except (TypeError, ValueError):
        per_page = 20

    # --- Build query ---
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

    return jsonify(
        {
            "success": True,
            "products": [product.to_dict() for product in paginated.items],
            "total": paginated.total,
            "page": paginated.page,
            "per_page": paginated.per_page,
            "pages": paginated.pages,
        }
    ), 200


# ---------------------------------------------------------------------------
# Seed helper (development only) – POST /api/products/seed
# ---------------------------------------------------------------------------
@app.route("/api/products/seed", methods=["POST"])
def seed_products():
    """Populate the database with sample products for testing."""
    sample_products = [
        Product(name="Laptop Pro 15", category="Electronics", price=1299.99, description="High-performance laptop", stock=50),
        Product(name="Wireless Mouse", category="Electronics", price=29.99, description="Ergonomic wireless mouse", stock=200),
        Product(name="USB-C Hub", category="Electronics", price=49.99, description="7-in-1 USB-C hub", stock=150),
        Product(name="Running Shoes", category="Footwear", price=89.99, description="Lightweight running shoes", stock=80),
        Product(name="Leather Boots", category="Footwear", price=149.99, description="Genuine leather boots", stock=40),
        Product(name="Cotton T-Shirt", category="Clothing", price=19.99, description="Soft cotton tee", stock=300),
        Product(name="Denim Jacket", category="Clothing", price=79.99, description="Classic denim jacket", stock=60),
        Product(name="Yoga Mat", category="Sports", price=34.99, description="Non-slip yoga mat", stock=120),
        Product(name="Protein Powder", category="Health", price=54.99, description="Whey protein blend", stock=90),
        Product(name="Blender", category="Kitchen", price=69.99, description="High-speed blender", stock=70),
    ]
    db.session.bulk_save_objects(sample_products)
    db.session.commit()
    return jsonify({"success": True, "message": f"{len(sample_products)} products seeded."}), 201


# ---------------------------------------------------------------------------
# Application entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True)