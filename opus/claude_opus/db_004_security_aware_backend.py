```python
from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)

DATABASE = "products.db"

# Whitelist of allowed category values
ALLOWED_CATEGORIES = {"electronics", "books", "clothing", "home", "toys", "sports"}

# Whitelist of allowed sort columns and directions (cannot be parameterised in SQL)
ALLOWED_SORT_COLUMNS = {"name", "price", "created_at"}
ALLOWED_SORT_DIRECTIONS = {"asc", "desc"}

# Numeric bounds for validation
MIN_PRICE = 0.0
MAX_PRICE = 1_000_000.0
MIN_PAGE = 1
MAX_PAGE = 10_000
MIN_PER_PAGE = 1
MAX_PER_PAGE = 100


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def parse_int(value, name, minimum, maximum, errors):
    if value is None:
        return None
    try:
        parsed = int(value)
    except (ValueError, TypeError):
        errors.append(f"{name} must be an integer")
        return None
    if parsed < minimum or parsed > maximum:
        errors.append(f"{name} must be between {minimum} and {maximum}")
        return None
    return parsed


def parse_float(value, name, minimum, maximum, errors):
    if value is None:
        return None
    try:
        parsed = float(value)
    except (ValueError, TypeError):
        errors.append(f"{name} must be a number")
        return None
    if parsed < minimum or parsed > maximum:
        errors.append(f"{name} must be between {minimum} and {maximum}")
        return None
    return parsed


@app.route("/api/products", methods=["GET"])
def list_products():
    errors = []

    # --- Validate category (whitelist) ---
    category = request.args.get("category")
    if category is not None:
        category = category.strip().lower()
        if category not in ALLOWED_CATEGORIES:
            errors.append(
                f"category must be one of: {', '.join(sorted(ALLOWED_CATEGORIES))}"
            )

    # --- Validate numeric range filters ---
    min_price = parse_float(
        request.args.get("min_price"), "min_price", MIN_PRICE, MAX_PRICE, errors
    )
    max_price = parse_float(
        request.args.get("max_price"), "max_price", MIN_PRICE, MAX_PRICE, errors
    )
    if min_price is not None and max_price is not None and min_price > max_price:
        errors.append("min_price cannot be greater than max_price")

    in_stock = None
    in_stock_raw = request.args.get("in_stock")
    if in_stock_raw is not None:
        if in_stock_raw.lower() in ("true", "1", "yes"):
            in_stock = 1
        elif in_stock_raw.lower() in ("false", "0", "no"):
            in_stock = 0
        else:
            errors.append("in_stock must be a boolean (true/false)")

    # --- Validate pagination ---
    page = parse_int(
        request.args.get("page", "1"), "page", MIN_PAGE, MAX_PAGE, errors
    ) or MIN_PAGE
    per_page = parse_int(
        request.args.get("per_page", "20"),
        "per_page",
        MIN_PER_PAGE,
        MAX_PER_PAGE,
        errors,
    ) or 20

    # --- Validate sorting (whitelisted identifiers) ---
    sort_by = request.args.get("sort_by", "created_at").strip().lower()
    if sort_by not in ALLOWED_SORT_COLUMNS:
        errors.append(
            f"sort_by must be one of: {', '.join(sorted(ALLOWED_SORT_COLUMNS))}"
        )
        sort_by = "created_at"

    sort_dir = request.args.get("sort_dir", "asc").strip().lower()
    if sort_dir not in ALLOWED_SORT_DIRECTIONS:
        errors.append("sort_dir must be 'asc' or 'desc'")
        sort_dir = "asc"

    if errors:
        return jsonify({"errors": errors}), 400

    # --- Build parameterised query ---
    conditions = []
    params = []

    if category is not None:
        conditions.append("category = ?")
        params.append(category)

    if min_price is not None:
        conditions.append("price >= ?")
        params.append(min_price)

    if max_price is not None:
        conditions.append("price <= ?")
        params.append(max_price)

    if in_stock is not None:
        conditions.append("in_stock = ?")
        params.append(in_stock)

    where_clause = ""
    if conditions:
        where_clause = "WHERE " + " AND ".join(conditions)

    # sort_by and sort_dir are safe because they come from whitelists
    offset = (page - 1) * per_page
    query = (
        f"SELECT id, name, category, price, in_stock, created_at "
        f"FROM products {where_clause} "
        f"ORDER BY {sort_by} {sort_dir.upper()} "
        f"LIMIT ? OFFSET ?"
    )
    params.extend([per_page, offset])

    conn = get_db()
    try:
        cursor = conn.execute(query, params)
        rows = [dict(row) for row in cursor.fetchall()]

        count_query = f"SELECT COUNT(*) AS total FROM products {where_clause}"
        count_params = params[:-2]  # exclude limit/offset
        total = conn.execute(count_query, count_params).fetchone()["total"]
    finally:
        conn.close()

    return jsonify(
        {
            "data": rows,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
            },
        }