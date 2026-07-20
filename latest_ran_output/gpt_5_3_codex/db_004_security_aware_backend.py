from flask import Flask, request, jsonify, g
import sqlite3
from typing import Optional, Tuple

app = Flask(__name__)
DATABASE = "app.db"

# Whitelisted category values
ALLOWED_CATEGORIES = {
    "electronics",
    "books",
    "fashion",
    "home",
    "toys",
    "sports",
    "beauty",
    "automotive",
}

# Validation constraints
MIN_PRICE = 0.0
MAX_PRICE = 1_000_000.0
MIN_RATING = 0.0
MAX_RATING = 5.0
DEFAULT_LIMIT = 25
MAX_LIMIT = 100
DEFAULT_OFFSET = 0


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exception):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def parse_float(name: str, value: Optional[str], min_val: float, max_val: float) -> Tuple[Optional[float], Optional[str]]:
    if value is None or value == "":
        return None, None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None, f"'{name}' must be a number."
    if parsed < min_val or parsed > max_val:
        return None, f"'{name}' must be between {min_val} and {max_val}."
    return parsed, None


def parse_int(name: str, value: Optional[str], min_val: int, max_val: int, default: Optional[int] = None) -> Tuple[Optional[int], Optional[str]]:
    if value is None or value == "":
        return default, None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None, f"'{name}' must be an integer."
    if parsed < min_val or parsed > max_val:
        return None, f"'{name}' must be between {min_val} and {max_val}."
    return parsed, None


@app.route("/products", methods=["GET"])
def get_products():
    category = request.args.get("category")
    min_price_raw = request.args.get("min_price")
    max_price_raw = request.args.get("max_price")
    min_rating_raw = request.args.get("min_rating")
    limit_raw = request.args.get("limit")
    offset_raw = request.args.get("offset")

    errors = {}

    if category:
        if category not in ALLOWED_CATEGORIES:
            errors["category"] = f"'category' must be one of: {sorted(ALLOWED_CATEGORIES)}"

    min_price, err = parse_float("min_price", min_price_raw, MIN_PRICE, MAX_PRICE)
    if err:
        errors["min_price"] = err

    max_price, err = parse_float("max_price", max_price_raw, MIN_PRICE, MAX_PRICE)
    if err:
        errors["max_price"] = err

    if min_price is not None and max_price is not None and min_price > max_price:
        errors["price_range"] = "'min_price' cannot be greater than 'max_price'."

    min_rating, err = parse_float("min_rating", min_rating_raw, MIN_RATING, MAX_RATING)
    if err:
        errors["min_rating"] = err

    limit, err = parse_int("limit", limit_raw, 1, MAX_LIMIT, default=DEFAULT_LIMIT)
    if err:
        errors["limit"] = err

    offset, err = parse_int("offset", offset_raw, 0, 1_000_000, default=DEFAULT_OFFSET)
    if err:
        errors["offset"] = err

    if errors:
        return jsonify({"errors": errors}), 400

    sql = """
        SELECT id, name, category, price, rating
        FROM products
        WHERE 1=1
    """
    params = []

    if category:
        sql += " AND category = ?"
        params.append(category)

    if min_price is not None:
        sql += " AND price >= ?"
        params.append(min_price)

    if max_price is not None:
        sql += " AND price <= ?"
        params.append(max_price)

    if min_rating is not None:
        sql += " AND rating >= ?"
        params.append(min_rating)

    sql += " ORDER BY id DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    db = get_db()
    rows = db.execute(sql, params).fetchall()

    data = [
        {
            "id": row["id"],
            "name": row["name"],
            "category": row["category"],
            "price": row["price"],
            "rating": row["rating"],
        }
        for row in rows
    ]

    return jsonify(
        {
            "filters": {
                "category": category,
                "min_price": min_price,
                "max_price": max_price,
                "min_rating": min_rating,
                "limit": limit,
                "offset": offset,
            },
            "count": len(data),
            "results": data,
        }
    ), 200


if __name__ == "__main__":
    app.run(debug=True)