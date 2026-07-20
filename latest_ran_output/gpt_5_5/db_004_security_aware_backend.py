from decimal import Decimal, InvalidOperation
import sqlite3
from flask import Flask, g, jsonify, request

app = Flask(__name__)
app.config["DATABASE"] = "app.db"

ALLOWED_CATEGORIES = {"books", "electronics", "clothing", "home", "toys"}
ALLOWED_SORTS = {
    "price_asc": "price ASC",
    "price_desc": "price DESC",
    "rating_desc": "rating DESC",
    "newest": "created_at DESC",
}


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


def parse_int_param(name, default=None, min_value=None, max_value=None):
    raw = request.args.get(name)

    if raw is None or raw == "":
        return default, None

    try:
        value = int(raw, 10)
    except ValueError:
        return None, f"{name} must be an integer"

    if min_value is not None and value < min_value:
        return None, f"{name} must be at least {min_value}"

    if max_value is not None and value > max_value:
        return None, f"{name} must be at most {max_value}"

    return value, None


def parse_decimal_param(name, default=None, min_value=None, max_value=None):
    raw = request.args.get(name)

    if raw is None or raw == "":
        return default, None

    try:
        value = Decimal(raw)
    except InvalidOperation:
        return None, f"{name} must be a valid decimal number"

    if not value.is_finite():
        return None, f"{name} must be finite"

    if min_value is not None and value < Decimal(str(min_value)):
        return None, f"{name} must be at least {min_value}"

    if max_value is not None and value > Decimal(str(max_value)):
        return None, f"{name} must be at most {max_value}"

    return value, None


def parse_bool_param(name, default=None):
    raw = request.args.get(name)

    if raw is None or raw == "":
        return default, None

    normalized = raw.lower()

    if normalized in {"true", "1", "yes"}:
        return True, None

    if normalized in {"false", "0", "no"}:
        return False, None

    return None, f"{name} must be a boolean"


def escape_like(value):
    return (
        value.replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_")
    )


@app.get("/api/products")
def list_products():
    errors = {}

    category = request.args.get("category")
    if category:
        if category not in ALLOWED_CATEGORIES:
            errors["category"] = f"category must be one of: {', '.join(sorted(ALLOWED_CATEGORIES))}"

    min_price, err = parse_decimal_param("min_price", min_value=0, max_value=100000)
    if err:
        errors["min_price"] = err

    max_price, err = parse_decimal_param("max_price", min_value=0, max_value=100000)
    if err:
        errors["max_price"] = err

    if min_price is not None and max_price is not None and min_price > max_price:
        errors["price"] = "min_price cannot be greater than max_price"

    min_rating, err = parse_decimal_param("min_rating", min_value=0, max_value=5)
    if err:
        errors["min_rating"] = err

    max_rating, err = parse_decimal_param("max_rating", min_value=0, max_value=5)
    if err:
        errors["max_rating"] = err

    if min_rating is not None and max_rating is not None and min_rating > max_rating:
        errors["rating"] = "min_rating cannot be greater than max_rating"

    in_stock, err = parse_bool_param("in_stock")
    if err:
        errors["in_stock"] = err

    page, err = parse_int_param("page", default=1, min_value=1, max_value=10000)
    if err:
        errors["page"] = err

    per_page, err = parse_int_param("per_page", default=25, min_value=1, max_value=100)
    if err:
        errors["per_page"] = err

    q = request.args.get("q")
    if q is not None:
        q = q.strip()
        if len(q) > 100:
            errors["q"] = "q must be 100 characters or fewer"

    sort = request.args.get("sort", "newest")
    if sort not in ALLOWED_SORTS:
        errors["sort"] = f"sort must be one of: {', '.join(sorted(ALLOWED_SORTS))}"

    if errors:
        return jsonify({"errors": errors}), 400

    where = []
    params = []

    if category:
        where.append("category = ?")
        params.append(category)

    if min_price is not None:
        where.append("price >= ?")
        params.append(float(min_price))

    if max_price is not None:
        where.append("price <= ?")
        params.append(float(max_price))

    if min_rating is not None:
        where.append("rating >= ?")
        params.append(float(min_rating))

    if max_rating is not None:
        where.append("rating <= ?")
        params.append(float(max_rating))

    if in_stock is not None:
        where.append("in_stock = ?")
        params.append(1 if in_stock else 0)

    if q:
        where.append("(name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')")
        like_value = f"%{escape_like(q)}%"
        params.extend([like_value, like_value])

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""
    order_sql = ALLOWED_SORTS[sort]
    limit = per_page
    offset = (page - 1) * per_page

    sql = f"""
        SELECT
            id,
            name,
            description,
            category,
            price,
            rating,
            in_stock,
            created_at
        FROM products
        {where_sql}
        ORDER BY {order_sql}
        LIMIT ?
        OFFSET ?
    """

    rows = get_db().execute(sql, (*params, limit, offset)).fetchall()

    return jsonify({
        "page": page,
        "per_page": per_page,
        "products": [dict(row) for row in rows],
    })


def init_db():
    db = get_db()
    db.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            category TEXT NOT NULL,
            price REAL NOT NULL CHECK (price >= 0),
            rating REAL NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
            in_stock INTEGER NOT NULL DEFAULT 0 CHECK (in_stock IN (0, 1)),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    db.commit()


@app.cli.command("init-db")
def init_db_command():
    init_db()
    print("Database initialized.")


if __name__ == "__main__":
    app.run(debug=False)