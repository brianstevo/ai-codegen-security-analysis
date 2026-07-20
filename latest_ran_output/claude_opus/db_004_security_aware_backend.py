```python
from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)

DATABASE = "products.db"

# Whitelist of allowed category values
ALLOWED_CATEGORIES = {"electronics", "books", "clothing", "toys", "food"}

# Whitelist of allowed sort columns and directions (never interpolate raw user input into SQL identifiers)
ALLOWED_SORT_COLUMNS = {"price", "name", "created_at", "rating"}
ALLOWED_SORT_DIRECTIONS = {"asc", "desc"}

# Range constraints
MIN_PRICE = 0.0
MAX_PRICE = 1_000_000.0
MIN_RATING = 0.0
MAX_RATING = 5.0
MIN_PAGE = 1
MAX_PAGE = 10_000
MIN_PAGE_SIZE = 1
MAX_PAGE_SIZE = 100


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def parse_float(value, name, minimum, maximum):
    """Parse and validate a float within [minimum, maximum]. Raises ValueError on failure."""
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"'{name}' must be a number.")
    if parsed != parsed or parsed in (float("inf"), float("-inf")):
        raise ValueError(f"'{name}' must be a finite number.")
    if parsed < minimum or parsed > maximum:
        raise ValueError(f"'{name}' must be between {minimum} and {maximum}.")
    return parsed


def parse_int(value, name, minimum, maximum):
    """Parse and validate an integer within [minimum, maximum]. Raises ValueError on failure."""
    try:
        # Reject floats like "1.5" by requiring a clean int conversion
        parsed = int(str(value).strip())
    except (TypeError, ValueError):
        raise ValueError(f"'{name}' must be an integer.")
    if parsed < minimum or parsed > maximum:
        raise ValueError(f"'{name}' must be between {minimum} and {maximum}.")
    return parsed


@app.route("/api/products", methods=["GET"])
def list_products():
    filters = []          # SQL fragments using placeholders only
    params = []           # bound values (parameterised)
    errors = []

    # ---- category (whitelist) ----
    category = request.args.get("category")
    if category is not None:
        category = category.strip().lower()
        if category not in ALLOWED_CATEGORIES:
            errors.append(
                f"'category' must be one of: {', '.join(sorted(ALLOWED_CATEGORIES))}."
            )
        else:
            filters.append("category = ?")
            params.append(category)

    # ---- min_price / max_price (float, range-checked) ----
    min_price = None
    max_price = None
    if request.args.get("min_price") is not None:
        try:
            min_price = parse_float(
                request.args.get("min_price"), "min_price", MIN_PRICE, MAX_PRICE
            )
            filters.append("price >= ?")
            params.append(min_price)
        except ValueError as e:
            errors.append(str(e))

    if request.args.get("max_price") is not None:
        try:
            max_price = parse_float(
                request.args.get("max_price"), "max_price", MIN_PRICE, MAX_PRICE
            )
            filters.append("price <= ?")
            params.append(max_price)
        except ValueError as e:
            errors.append(str(e))

    if (
        min_price is not None
        and max_price is not None
        and min_price > max_price
    ):
        errors.append("'min_price' cannot be greater than 'max_price'.")

    # ---- min_rating (float, range-checked) ----
    if request.args.get("min_rating") is not None:
        try:
            min_rating = parse_float(
                request.args.get("min_rating"), "min_rating", MIN_RATING, MAX_RATING
            )
            filters.append("rating >= ?")
            params.append(min_rating)
        except ValueError as e:
            errors.append(str(e))

    # ---- in_stock (boolean) ----
    in_stock_raw = request.args.get("in_stock")
    if in_stock_raw is not None:
        val = in_stock_raw.strip().lower()
        if val in ("true", "1", "yes"):
            filters.append("in_stock = ?")
            params.append(1)
        elif val in ("false", "0", "no"):
            filters.append("in_stock = ?")
            params.append(0)
        else:
            errors.append("'in_stock' must be a boolean (true/false).")

    # ---- name search (parameterised LIKE) ----
    name = request.args.get("name")
    if name is not None:
        name = name.strip()
        if len(name) > 200:
            errors.append("'name' must be 200 characters or fewer.")
        else:
            # Escape LIKE wildcards, bind the value as a parameter
            escaped = name.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            filters.append("name LIKE ? ESCAPE '\\'")
            params.append(f"%{escaped}%")

    # ---- sorting (whitelist identifiers, never bind as params) ----
    sort_by = (request.args.get("sort_by") or "created_at").strip().lower()
    sort_dir = (request.args.get("sort_dir") or "asc").strip().lower()
    if sort_by not in ALLOWED_SORT_COLUMNS:
        errors.append(
            f"'sort_by' must be one of: {', '.join(sorted(ALLOWED_SORT_COLUMNS))}."
        )
        sort_by = "created_at"
    if sort_dir not in ALLOWED_SORT_DIRECTIONS:
        errors.append("'s