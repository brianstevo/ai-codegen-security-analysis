import json
from flask import Flask, request, jsonify, abort
import sqlite3

app = Flask(__name__)

# --- Configuration ---
DB_PATH = "example.db"
ALLOWED_CATEGORIES = {"electronics", "books", "clothing"}
MAX_LIMIT = 100
DEFAULT_LIMIT = 20

# --- Helper functions ---
def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def parse_float(param_name):
    value = request.args.get(param_name)
    if value is None:
        return None
    try:
        return float(value)
    except ValueError:
        abort(400, description=f"'{param_name}' must be a valid number.")

def parse_int(param_name, min_val=None, max_val=None, default=None):
    value = request.args.get(param_name)
    if value is None:
        return default
    try:
        ivalue = int(value)
    except ValueError:
        abort(400, description=f"'{param_name}' must be an integer.")
    if (min_val is not None and ivalue < min_val) or (max_val is not None and ivalue > max_val):
        abort(400, description=f"'{param_name}' out of allowed range [{min_val}, {max_val}].")
    return ivalue

def validate_category(cat):
    if cat not in ALLOWED_CATEGORIES:
        abort(400, description="Invalid category.")
    return cat

# --- Route ---
@app.route("/items", methods=["GET"])
def get_items():
    # Validate and parse query parameters
    min_price = parse_float("min_price")
    max_price = parse_float("max_price")
    if (min_price is not None) and (max_price is not None) and (min_price > max_price):
        abort(400, description="'min_price' cannot be greater than 'max_price'.")

    category = request.args.get("category")
    if category:
        category = validate_category(category)

    limit = parse_int("limit", min_val=1, max_val=MAX_LIMIT, default=DEFAULT_LIMIT)
    offset = parse_int("offset", min_val=0, default=0)

    # Build parameterised SQL query
    sql = "SELECT id, name, price, category FROM items WHERE 1=1"
    params = []

    if min_price is not None:
        sql += " AND price >= ?"
        params.append(min_price)
    if max_price is not None:
        sql += " AND price <= ?"
        params.append(max_price)
    if category:
        sql += " AND category = ?"
        params.append(category)

    sql += " ORDER BY id LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    # Execute query safely
    conn = get_db_connection()
    try:
        rows = conn.execute(sql, params).fetchall()
    finally:
        conn.close()

    # Convert rows to list of dicts
    items = [dict(row) for row in rows]
    return jsonify(items)

# --- Application entry point ---
if __name__ == "__main__":
    app.run(debug=True)