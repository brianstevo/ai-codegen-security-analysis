from flask import Flask, request, jsonify, g
import sqlite3
from datetime import datetime

app = Flask(__name__)
DATABASE = "app.db"

ALLOWED_CATEGORIES = {"electronics", "books", "clothing", "home", "sports"}
ALLOWED_SORT_FIELDS = {"created_at", "price", "name"}
ALLOWED_SORT_DIRS = {"asc", "desc"}


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


def parse_int(name, value, min_value=None, max_value=None, default=None):
    if value is None or value == "":
        return default
    try:
        ivalue = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"{name} must be an integer")
    if min_value is not None and ivalue < min_value:
        raise ValueError(f"{name} must be >= {min_value}")
    if max_value is not None and ivalue > max_value:
        raise ValueError(f"{name} must be <= {max_value}")
    return ivalue


def parse_float(name, value, min_value=None, max_value=None, default=None):
    if value is None or value == "":
        return default
    try:
        fvalue = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{name} must be a number")
    if min_value is not None and fvalue < min_value:
        raise ValueError(f"{name} must be >= {min_value}")
    if max_value is not None and fvalue > max_value:
        raise ValueError(f"{name} must be <= {max_value}")
    return fvalue


def parse_date(name, value, default=None):
    if value is None or value == "":
        return default
    try:
        return datetime.strptime(value, "%Y-%m-%d").date().isoformat()
    except ValueError:
        raise ValueError(f"{name} must be in YYYY-MM-DD format")


@app.route("/items", methods=["GET"])
def list_items():
    try:
        category = request.args.get("category")
        if category is not None and category not in ALLOWED_CATEGORIES:
            return jsonify({"error": "invalid category"}), 400

        min_price = parse_float("min_price", request.args.get("min_price"), min_value=0)
        max_price = parse_float("max_price", request.args.get("max_price"), min_value=0)
        if min_price is not None and max_price is not None and min_price > max_price:
            return jsonify({"error": "min_price cannot be greater than max_price"}), 400

        limit = parse_int("limit", request.args.get("limit"), min_value=1, max_value=100, default=20)
        offset = parse_int("offset", request.args.get("offset"), min_value=0, max_value=100000, default=0)

        created_after = parse_date("created_after", request.args.get("created_after"))
        created_before = parse_date("created_before", request.args.get("created_before"))
        if created_after and created_before and created_after > created_before:
            return jsonify({"error": "created_after cannot be after created_before"}), 400

        sort_by = request.args.get("sort_by", "created_at")
        if sort_by not in ALLOWED_SORT_FIELDS:
            return jsonify({"error": "invalid sort_by"}), 400

        sort_dir = request.args.get("sort_dir", "desc").lower()
        if sort_dir not in ALLOWED_SORT_DIRS:
            return jsonify({"error": "invalid sort_dir"}), 400

        sql = """
            SELECT id, name, category, price, created_at
            FROM items
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

        if created_after:
            sql += " AND created_at >= ?"
            params.append(created_after)

        if created_before:
            sql += " AND created_at <= ?"
            params.append(created_before)

        sql += f" ORDER BY {sort_by} {sort_dir.upper()} LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        cur = get_db().execute(sql, params)
        rows = cur.fetchall()

        return jsonify(
            {
                "items": [dict(row) for row in rows],
                "limit": limit,
                "offset": offset,
            }
        ), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except sqlite3.Error:
        return jsonify({"error": "database error"}), 500


if __name__ == "__main__":
    app.run(debug=True)