```python
import re
import sqlite3
import os
from flask import Flask, request, jsonify
from typing import Any

app = Flask(__name__)

DATABASE = os.environ.get("DATABASE_PATH", "app.db")

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_db_connection() -> sqlite3.Connection:
    """Return a SQLite connection with row-factory set for dict-like rows."""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create a sample table and seed it with demo data (runs once)."""
    with get_db_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS products (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                name      TEXT    NOT NULL,
                category  TEXT    NOT NULL,
                price     REAL    NOT NULL,
                stock     INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        # Seed only when the table is empty
        row = conn.execute("SELECT COUNT(*) AS cnt FROM products").fetchone()
        if row["cnt"] == 0:
            seed_data = [
                ("Laptop Pro 15",   "Electronics", 1299.99, 25),
                ("Wireless Mouse",  "Electronics",   29.99, 150),
                ("USB-C Hub",       "Electronics",   49.99, 80),
                ("Python Cookbook", "Books",          39.99, 60),
                ("Ergonomic Chair", "Furniture",     349.99, 10),
                ("Standing Desk",   "Furniture",     499.99,  5),
                ("Coffee Mug",      "Kitchen",        12.99, 200),
                ("Notebook A5",     "Stationery",      5.99, 500),
            ]
            conn.executemany(
                "INSERT INTO products (name, category, price, stock) VALUES (?, ?, ?, ?)",
                seed_data,
            )
        conn.commit()


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

class ValidationError(Exception):
    """Raised when user-supplied input fails validation."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def validate_keyword(keyword: Any) -> str:
    """
    Validate and sanitise the search keyword.

    Rules
    -----
    - Must be a non-empty string.
    - Length: 1–100 characters.
    - Allowed characters: letters, digits, spaces, hyphens, underscores,
      apostrophes, and dots.  No SQL meta-characters are needed by legitimate
      search terms (the parameterised query handles quoting anyway, but we
      still restrict the character set as defence-in-depth).
    """
    if not isinstance(keyword, str):
        raise ValidationError("'keyword' must be a string.")

    keyword = keyword.strip()

    if not keyword:
        raise ValidationError("'keyword' must not be empty.")

    if len(keyword) > 100:
        raise ValidationError("'keyword' must not exceed 100 characters.")

    # Allow only safe characters
    allowed_pattern = re.compile(r"^[a-zA-Z0-9 \-_'\.]+$")
    if not allowed_pattern.match(keyword):
        raise ValidationError(
            "'keyword' contains invalid characters. "
            "Allowed: letters, digits, spaces, hyphens, underscores, "
            "apostrophes, and dots."
        )

    return keyword


def validate_page(page_param: Any) -> int:
    """Validate the page query parameter (positive integer, default 1)."""
    if page_param is None:
        return 1
    try:
        page = int(page_param)
    except (ValueError, TypeError):
        raise ValidationError("'page' must be an integer.")
    if page < 1:
        raise ValidationError("'page' must be greater than 0.")
    if page > 10_000:
        raise ValidationError("'page' must not exceed 10 000.")
    return page


def validate_per_page(per_page_param: Any) -> int:
    """Validate the per_page query parameter (1–100, default 10)."""
    if per_page_param is None:
        return 10
    try:
        per_page = int(per_page_param)
    except (ValueError, TypeError):
        raise ValidationError("'per_page' must be an integer.")
    if per_page < 1:
        raise ValidationError("'per_page' must be at least 1.")
    if per_page > 100:
        raise ValidationError("'per_page' must not exceed 100.")
    return per_page


# ---------------------------------------------------------------------------
# Error handlers
# ---------------------------------------------------------------------------

@app.errorhandler(ValidationError)
def handle_validation_error(exc: ValidationError):
    return jsonify({"success": False, "error": exc.message}), exc.status_code


@app.errorhandler(404)
def handle_not_found(_):
    return jsonify({"success": False, "error": "Endpoint not found."}), 404


@app.errorhandler(405)
def handle_method_not_allowed(_):
    return jsonify({"success": False, "error": "Method not allowed."}), 405


@app.errorhandler(500)
def handle_server_error(_):
    return jsonify({"success": False, "error": "Internal server error."}), 500


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/api/products/search")
def search_products():
    """
    Search products by keyword (matches name or category).

    Query Parameters
    ----------------
    keyword  : str   – required, 1-100 chars, letters/digits/spaces/-_'.
    page     : int   – optional, default 1
    per_page : int   – optional, default 10, max 100

    Returns
    -------
    JSON with pagination metadata and a list of matching product objects.

    Security
    --------
    - Server-side input validation (type, length, character whitelist).
    - Parameterised (prepared) query — the DB driver handles escaping;
      user input is never interpolated into the SQL string.
    """
    # --- 1. Retrieve raw inputs -------------------------------------------
    raw_keyword  = request.args.get("keyword")
    raw_page     = request.args.get("page")
    raw_per_page = request.args.get("per_page")

    # --- 2. Validate all inputs (raises ValidationError on failure) -------
    if raw_keyword is None:
        raise ValidationError("Query parameter 'keyword' is required.")

    keyword  = validate_keyword(raw_keyword)
    page     = validate_page(raw_page)
    per_page = validate_per_page(raw_per_page)

    # --- 3. Build parameterised query ------------------------------------
    # '%' wildcards are part of the *parameter value*, not the SQL template,
    # so they are handled safely by the DB driver.
    search_term = f"%{keyword}%"
    offset = (page - 1) * per_page

    count_sql = """
        SELECT COUNT(*) AS total
        FROM   products
        WHERE  name     LIKE ?
            OR category LIKE ?
    """

    search_sql = """
        SELECT id, name, category, price, stock
        FROM   products
        WHERE  name     LIKE ?
            OR category LIKE ?
        ORDER  BY name
        LIMIT  ? OFFSET ?
    """

    # --- 4. Execute queries ----------------------------------------------
    try:
        with get_db_connection() as conn:
            total_row = conn.execute(
                count_sql, (search_term, search_term)
            ).fetchone()
            total = total_row["total"]

            rows = conn.execute(
                search_sql, (search_term, search_term, per_page, offset)
            ).fetchall()
    except sqlite3.Error as exc:
        app.logger.error("Database error during product search: %s", exc)
        return jsonify({"success": False, "error": "Database error."}), 500

    #