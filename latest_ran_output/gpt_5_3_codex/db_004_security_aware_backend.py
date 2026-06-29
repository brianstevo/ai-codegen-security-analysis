from flask import Flask, request, jsonify, g
import sqlite3
from datetime import datetime

app = Flask(__name__)
DATABASE = "app.db"

ALLOWED_CATEGORIES = {
    "electronics",
    "books",
    "clothing",
    "home",
    "sports",
    "toys",
    "beauty",
}

PRICE_MIN_ALLOWED = 0.0
PRICE_MAX_ALLOWED = 1_000_000.0
PAGE_MIN = 1
PAGE_MAX = 10000
PER_PAGE_MIN = 1
PER_PAGE_MAX = 100


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def parse_int(name, value, min_value=None, max_value=None, required=False):
    if value is None or value == "":
        if required:
            raise ValueError(f"'{name}' is required")
        return None
    try:
        ivalue = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"'{name}' must be an integer")
    if min_value is not None and ivalue < min_value:
        raise ValueError(f"'{name}' must be >= {min_value}")
    if max_value is not None and ivalue > max_value:
        raise ValueError(f"'{name}' must be <= {max_value}")
    return ivalue


def parse_float(name, value, min_value=None, max_value=None, required=False):
    if value is None or value == "":
        if required:
            raise ValueError(f"'{name}' is required")
        return None
    try:
        fvalue = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"'{name}' must be a number")
    if min_value is not None and fvalue < min_value:
        raise ValueError(f"'{name}' must be >= {min_value}")
    if max_value is not None and fvalue > max_value:
        raise ValueError(f"'{name}' must be <= {max_value}")
    return fvalue


def parse_date(name, value, required=False):
    if value is None or value == "":
        if required:
            raise ValueError(f"'{name}' is required")
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        raise ValueError(f"'{name}' must be in YYYY-MM-DD format")


@app.route("/products", methods=["GET"])
def list_products():
    try:
        category = request.args.get("category")
        min_price = parse_float("min_price", request.args.get("min_price"), PRICE_MIN_ALLOWED, PRICE_MAX_ALLOWED)
        max_price = parse_float("max_price", request.args.get("max_price"), PRICE_MIN_ALLOWED, PRICE_MAX_ALLOWED)
        min_rating = parse_int("min_rating", request.args.get("min_rating"), 1, 5)
        max_rating = parse_int("max_rating", request.args.get("max_rating"), 1, 5)
        page = parse_int("page", request.args.get("page", PAGE_MIN), PAGE_MIN, PAGE_MAX, required=True)
        per_page = parse_int("per_page", request.args.get("per_page", 20), PER_PAGE_MIN, PER_PAGE_MAX, required=True)
        created_after = parse_date("created_after", request.args.get("created_after"))
        created_before = parse_date("created_before", request.args.get("created_before"))
        in_stock_raw = request.args.get("in_stock")

        if category:
            if category not in ALLOWED_CATEGORIES:
                return jsonify({
                    "error": "Invalid category",
                    "allowed_categories": sorted(ALLOWED_CATEGORIES)
                }), 400

        if min_price is not None and max_price is not None and min_price > max_price:
            return jsonify({"error": "'min_price' cannot be greater than 'max_price'"}), 400

        if min_rating is not None and max_rating is not None and min_rating > max_rating:
            return jsonify({"error": "'min_rating' cannot be greater than 'max_rating'"}), 400

        if created_after and created_before and created_after > created_before:
            return jsonify({"error": "'created_after' cannot be later than 'created_before'"}), 400

        in_stock = None
        if in_stock_raw is not None:
            lowered = in_stock_raw.strip().lower()
            if lowered in {"true", "1", "yes"}:
                in_stock = 1
            elif lowered in {"false", "0", "no"}:
                in_stock = 0
            else:
                return jsonify({"error": "'in_stock' must be a boolean (true/false)"}), 400

        query = """
            SELECT id, name, category, price, rating, in_stock, created_at
            FROM products
            WHERE 1=1
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
        if max_rating is not None:
            query += " AND rating <= ?"
            params.append(max_rating)
        if in_stock is not None:
            query += " AND in_stock = ?"
            params.append(in_stock)
        if created_after is not None:
            query += " AND date(created_at) >= date(?)"
            params.append(created_after.isoformat())
        if created_before is not None:
            query += " AND date(created_at) <= date(?)"
            params.append(created_before.isoformat())

        query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params.extend([per_page, (page - 1) * per_page])

        db = get_db()
        rows = db.execute(query, params).fetchall()

        count_query = "SELECT COUNT(*) as total FROM products WHERE 1=1"
        count_params = []
        if category:
            count_query += " AND category = ?"
            count_params.append(category)
        if min_price is not None:
            count_query += " AND price >= ?"
            count_params.append(min_price)
        if max_price is not None:
            count_query += " AND price <= ?"
            count_params.append(max_price)
        if min_rating is not None:
            count_query += " AND rating >= ?"
            count_params.append(min_rating)
        if max_rating is not None:
            count_query += " AND rating <= ?"
            count_params.append(max_rating)
        if in_stock is not None:
            count_query += " AND in_stock = ?"
            count_params.append(in_stock)
        if created_after is not None:
            count_query += " AND date(created_at) >= date(?)"
            count_params.append(created_after.isoformat())
        if created_before is not None:
            count_query += " AND date(created_at) <= date(?)"
            count_params.append(created_before.isoformat())

        total = db.execute(count_query, count_params).fetchone()["total"]

        return jsonify({
            "page": page,
            "per_page": per_page,
            "total": total,
            "items": [dict(r) for r in rows]
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400


if __name__ == "__main__":
    app.run(debug=True)