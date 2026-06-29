from flask import Flask, request, jsonify
import sqlite3
from datetime import datetime

app = Flask(__name__)

DATABASE = "app.db"

ALLOWED_CATEGORIES = {"books", "electronics", "clothing", "home", "sports"}
ALLOWED_SORT_FIELDS = {"created_at", "price", "name"}
ALLOWED_SORT_DIRS = {"asc", "desc"}


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def parse_int(value, field_name, min_value=None, max_value=None):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} must be an integer")
    if min_value is not None and parsed < min_value:
        raise ValueError(f"{field_name} must be >= {min_value}")
    if max_value is not None and parsed > max_value:
        raise ValueError(f"{field_name} must be <= {max_value}")
    return parsed


def parse_float(value, field_name, min_value=None, max_value=None):
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} must be a number")
    if min_value is not None and parsed < min_value:
        raise ValueError(f"{field_name} must be >= {min_value}")
    if max_value is not None and parsed > max_value:
        raise ValueError(f"{field_name} must be <= {max_value}")
    return parsed


def parse_date(value, field_name):
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} must be in YYYY-MM-DD format")


@app.route("/items", methods=["GET"])
def list_items():
    try:
        # Validate and normalize filters
        category = request.args.get("category")
        if category is not None:
            category = category.strip().lower()
            if category not in ALLOWED_CATEGORIES:
                return jsonify({"error": "Invalid category"}), 400

        min_price = request.args.get("min_price")
        max_price = request.args.get("max_price")
        min_price_val = parse_float(min_price, "min_price", min_value=0) if min_price is not None else None
        max_price_val = parse_float(max_price, "max_price", min_value=0) if max_price is not None else None
        if min_price_val is not None and max_price_val is not None and min_price_val > max_price_val:
            return jsonify({"error": "min_price cannot be greater than max_price"}), 400

        page = parse_int(request.args.get("page", 1), "page", min_value=1)
        per_page = parse_int(request.args.get("per_page", 20), "per_page", min_value=1, max_value=100)

        sort_by = request.args.get("sort_by", "created_at").strip().lower()
        if sort_by not in ALLOWED_SORT_FIELDS:
            return jsonify({"error": "Invalid sort_by"}), 400

        sort_dir = request.args.get("sort_dir", "desc").strip().lower()
        if sort_dir not in ALLOWED_SORT_DIRS:
            return jsonify({"error": "Invalid sort_dir"}), 400

        created_after = request.args.get("created_after")
        created_before = request.args.get("created_before")
        created_after_date = parse_date(created_after, "created_after") if created_after else None
        created_before_date = parse_date(created_before, "created_before") if created_before else None
        if created_after_date and created_before_date and created_after_date > created_before_date:
            return jsonify({"error": "created_after cannot be later than created_before"}), 400

        # Build parameterized query
        where_clauses = []
        params = []

        if category is not None:
            where_clauses.append("category = ?")
            params.append(category)

        if min_price_val is not None:
            where_clauses.append("price >= ?")
            params.append(min_price_val)

        if max_price_val is not None:
            where_clauses.append("price <= ?")
            params.append(max_price_val)

        if created_after_date is not None:
            where_clauses.append("date(created_at) >= date(?)")
            params.append(created_after_date.isoformat())

        if created_before_date is not None:
            where_clauses.append("date(created_at) <= date(?)")
            params.append(created_before_date.isoformat())

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        offset = (page - 1) * per_page

        # Whitelist sort fields/direction to safely interpolate identifiers
        sql = f"""
            SELECT id, name, category, price, created_at
            FROM items
            {where_sql}
            ORDER BY {sort_by} {sort_dir.upper()}
            LIMIT ? OFFSET ?
        """
        params.extend([per_page, offset])

        conn = get_db()
        try:
            rows = conn.execute(sql, params).fetchall()
        finally:
            conn.close()

        items = [dict(row) for row in rows]
        return jsonify({
            "items": items,
            "page": page,
            "per_page": per_page,
            "count": len(items)
        }), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except sqlite3.Error:
        return jsonify({"error": "Database error"}), 500


if __name__ == "__main__":
    app.run(debug=True)