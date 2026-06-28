import sqlite3
from flask import Flask, request, jsonify, abort

app = Flask(__name__)

# --- Configuration ---
DB_PATH = "data.db"
ALLOWED_CATEGORIES = {"electronics", "books", "clothing"}
MAX_LIMIT = 100
DEFAULT_LIMIT = 20


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def validate_float(param_name, value, min_val=None, max_val=None):
    try:
        f = float(value)
    except (TypeError, ValueError):
        abort(400, description=f"'{param_name}' must be a valid number.")
    if min_val is not None and f < min_val:
        abort(400, description=f"'{param_name}' cannot be less than {min_val}.")
    if max_val is not None and f > max_val:
        abort(400, description=f"'{param_name}' cannot be greater than {max_val}.")
    return f


def validate_int(param_name, value, min_val=None, max_val=None):
    try:
        i = int(value)
    except (TypeError, ValueError):
        abort(400, description=f"'{param_name}' must be an integer.")
    if min_val is not None and i < min_val:
        abort(400, description=f"'{param_name}' cannot be less than {min_val}.")
    if max_val is not None and i > max_val:
        abort(400, description=f"'{param_name}' cannot be greater than {max_val}.")
    return i


@app.route("/items", methods=["GET"])
def get_items():
    # --- Extract & Validate Query Parameters ---
    min_price = request.args.get("min_price")
    max_price = request.args.get("max_price")
    category = request.args.get("category")
    page = request.args.get("page", "1")
    limit = request.args.get("limit", str(DEFAULT_LIMIT))

    filters = []
    params = []

    if min_price is not None:
        min_price_val = validate_float("min_price", min_price, min_val=0)
        filters.append("price >= ?")
        params.append(min_price_val)

    if max_price is not None:
        max_price_val = validate_float("max_price", max_price, min_val=0)
        filters.append("price <= ?")
        params.append(max_price_val)

    if category is not None:
        if category not in ALLOWED_CATEGORIES:
            abort(400, description=f"Invalid 'category'. Allowed values: {sorted(ALLOWED_CATEGORIES)}.")
        filters.append("category = ?")
        params.append(category)

    page_num = validate_int("page", page, min_val=1)
    limit_num = validate_int("limit", limit, min_val=1, max_val=MAX_LIMIT)

    offset = (page_num - 1) * limit_num

    # --- Build Parameterised SQL Query ---
    base_query = "SELECT id, name, price, category FROM items"
    if filters:
        where_clause = " WHERE " + " AND ".join(filters)
    else:
        where_clause = ""

    pagination_clause = " ORDER BY id LIMIT ? OFFSET ?"
    final_params = params + [limit_num, offset]

    sql = base_query + where_clause + pagination_clause

    # --- Execute Query ---
    conn = get_db_connection()
    try:
        cur = conn.execute(sql, final_params)
        rows = cur.fetchall()
    finally:
        conn.close()

    # --- Serialize Result ---
    items = [
        {
            "id": row["id"],
            "name": row["name"],
            "price": row["price"],
            "category": row["category"]
        }
        for row in rows
    ]

    return jsonify({
        "page": page_num,
        "limit": limit_num,
        "total_returned": len(items),
        "items": items
    })


if __name__ == "__main__":
    app.run(debug=True)