from flask import Flask, request, jsonify, g
import sqlite3
from decimal import Decimal, InvalidOperation

app = Flask(__name__)
app.config["DATABASE"] = "app.db"

ALLOWED_CATEGORIES = {"books", "electronics", "clothing", "home", "toys"}
ALLOWED_SORT_FIELDS = {
    "price": "price",
    "created_at": "created_at",
    "name": "name",
}
ALLOWED_SORT_DIRECTIONS = {"asc": "ASC", "desc": "DESC"}

MAX_LIMIT = 100


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(app.config["DATABASE"])
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def parse_decimal_param(name, min_value=None, max_value=None):
    raw = request.args.get(name)

    if raw is None or raw == "":
        return None, None

    try:
        value = Decimal(raw)
    except InvalidOperation:
        return None, f"{name} must be a valid number"

    if min_value is not None and value < Decimal(str(min_value)):
        return None, f"{name} must be at least {min_value}"

    if max_value is not None and value > Decimal(str(max_value)):
        return None, f"{name} must be at most {max_value}"

    return str(value), None


def parse_int_param(name, default=None, min_value=None, max_value=None):
    raw = request.args.get(name)

    if raw is None or raw == "":
        return default, None

    try:
        value = int(raw)
    except ValueError:
        return None, f"{name} must be an integer"

    if min_value is not None and value < min_value:
        return None, f"{name} must be at least {min_value}"

    if max_value is not None and value > max_value:
        return None, f"{name} must be at most {max_value}"

    return value, None


@app.route("/items", methods=["GET"])
def list_items():
    errors = {}

    category = request.args.get("category")
    if category:
        if category not in ALLOWED_CATEGORIES:
            errors["category"] = f"category must be one of: {sorted(ALLOWED_CATEGORIES)}"

    min_price, error = parse_decimal_param("min_price", min_value=0, max_value=1_000_000)
    if error:
        errors["min_price"] = error

    max_price, error = parse_decimal_param("max_price", min_value=0, max_value=1_000_000)
    if error:
        errors["max_price"] = error

    if min_price is not None and max_price is not None and Decimal(min_price) > Decimal(max_price):
        errors["price_range"] = "min_price must be less than or equal to max_price"

    min_rating, error = parse_int_param("min_rating", min_value=1, max_value=5)
    if error:
        errors["min_rating"] = error

    limit, error = parse_int_param("limit", default=25, min_value=1, max_value=MAX_LIMIT)
    if error:
        errors["limit"] = error

    offset, error = parse_int_param("offset", default=0, min_value=0, max_value=100_000)
    if error:
        errors["offset"] = error

    sort_by = request.args.get("sort_by", "created_at")
    if sort_by not in ALLOWED_SORT_FIELDS:
        errors["sort_by"] = f"sort_by must be one of: {sorted(ALLOWED_SORT_FIELDS)}"

    sort_dir = request.args.get("sort_dir", "desc").lower()
    if sort_dir not in ALLOWED_SORT_DIRECTIONS:
        errors["sort_dir"] = f"sort_dir must be one of: {sorted(ALLOWED_SORT_DIRECTIONS)}"

    if errors:
        return jsonify({"errors": errors}), 400

    query = """
        SELECT id, name, category, price, rating, created_at
        FROM items
        WHERE 1 = 1
    """
    params = []

    if category:
        query += " AND category = ?"
        params.append(category)

    if min_price is not None:
        query += " AND price >= ?"
        params.append(min_price)

    if max_price is not None:
        query += " AND price <= ?"
        params.append(max_price)

    if min_rating is not None:
        query += " AND rating >= ?"
        params.append(min_rating)

    query += f" ORDER BY {ALLOWED_SORT_FIELDS[sort_by]} {ALLOWED_SORT_DIRECTIONS[sort_dir]}"
    query += " LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    db = get_db()
    rows = db.execute(query, params).fetchall()

    return jsonify({
        "items": [dict(row) for row in rows],
        "limit": limit,
        "offset": offset,
    })


if __name__ == "__main__":
    app.run(debug=False)