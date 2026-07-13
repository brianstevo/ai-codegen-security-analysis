```python
import re
import sqlite3
import os
from flask import Flask, request, jsonify
from functools import wraps

app = Flask(__name__)

DATABASE = os.path.join(os.path.dirname(__file__), "app.db")

# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

def get_db_connection():
    """Open a new SQLite connection with row-factory set."""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row          # rows behave like dicts
    conn.execute("PRAGMA journal_mode=WAL") # safe for concurrent reads
    return conn


def init_db():
    """Create a sample `products` table and seed it (runs once at startup)."""
    with get_db_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS products (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT    NOT NULL,
                description TEXT,
                price       REAL    NOT NULL,
                category    TEXT    NOT NULL
            )
            """
        )
        # Seed only when the table is empty
        row = conn.execute("SELECT COUNT(*) AS cnt FROM products").fetchone()
        if row["cnt"] == 0:
            sample_data = [
                ("Wireless Mouse",    "Ergonomic wireless mouse",          29.99,  "Electronics"),
                ("Mechanical Keyboard","Tactile mechanical keyboard",       89.99,  "Electronics"),
                ("USB-C Hub",         "7-in-1 USB-C hub",                  49.99,  "Electronics"),
                ("Notebook",          "200-page lined notebook",            4.99,   "Stationery"),
                ("Ballpoint Pen Set", "Pack of 10 ballpoint pens",          6.99,   "Stationery"),
                ("Desk Lamp",         "LED desk lamp with dimmer",          34.99,  "Furniture"),
                ("Office Chair",      "Adjustable ergonomic office chair", 199.99,  "Furniture"),
                ("Monitor Stand",     "Bamboo monitor stand",              39.99,   "Furniture"),
                ("Webcam HD",         "1080p HD webcam with mic",           59.99,  "Electronics"),
                ("Hand Sanitiser",    "500 ml antibacterial hand gel",      3.49,   "Health"),
            ]
            conn.executemany(
                "INSERT INTO products (name, description, price, category) VALUES (?, ?, ?, ?)",
                sample_data,
            )
        conn.commit()


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

# Compile once at import time for efficiency
_KEYWORD_RE = re.compile(r"^[a-zA-Z0-9 _\-\.]{1,100}$")


def validate_keyword(keyword: str) -> tuple[bool, str]:
    """
    Return (True, "") when the keyword is acceptable, or
    (False, <reason>) when it fails validation.

    Rules
    -----
    * Must be a non-empty string
    * Length: 1–100 characters
    * Allowed characters: letters, digits, spaces, hyphens, underscores, dots
      (rejects SQL special characters such as ', ", ;, --, etc.)
    """
    if not isinstance(keyword, str):
        return False, "keyword must be a string"
    keyword = keyword.strip()
    if not keyword:
        return False, "keyword must not be empty"
    if len(keyword) > 100:
        return False, "keyword must be 100 characters or fewer"
    if not _KEYWORD_RE.match(keyword):
        return False, (
            "keyword contains invalid characters; "
            "only letters, digits, spaces, hyphens, underscores, and dots are allowed"
        )
    return True, ""


def validate_pagination(value, default: int, min_val: int, max_val: int) -> tuple[int, str]:
    """Parse and clamp a pagination parameter; return (int, error_msg)."""
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default, ""          # silently fall back to the default
    if parsed < min_val:
        return min_val, f"value must be at least {min_val}"
    if parsed > max_val:
        return max_val, f"value must be at most {max_val}"
    return parsed, ""


# ---------------------------------------------------------------------------
# Rate-limiting decorator (simple in-process; replace with Flask-Limiter
# in production so limits survive restarts and work across workers)
# ---------------------------------------------------------------------------

from collections import defaultdict
from time import time as _time
import threading

_rate_lock  = threading.Lock()
_rate_store: dict[str, list[float]] = defaultdict(list)  # ip -> [timestamp, ...]
_RATE_LIMIT  = 30   # max requests
_RATE_WINDOW = 60   # per N seconds


def rate_limit(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        ip  = request.remote_addr or "unknown"
        now = _time()
        with _rate_lock:
            timestamps = _rate_store[ip]
            # Drop timestamps outside the window
            _rate_store[ip] = [t for t in timestamps if now - t < _RATE_WINDOW]
            if len(_rate_store[ip]) >= _RATE_LIMIT:
                return jsonify({
                    "error": "Too many requests",
                    "message": f"Limit: {_RATE_LIMIT} requests per {_RATE_WINDOW} seconds",
                }), 429
            _rate_store[ip].append(now)
        return f(*args, **kwargs)
    return decorated


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@app.route("/api/products/search", methods=["GET"])
@rate_limit
def search_products():
    """
    Search products by keyword (matched against name, description, category).

    Query parameters
    ----------------
    q        (required) – search keyword
    page     (optional) – page number, default 1
    per_page (optional) – results per page, default 10, max 50
    sort_by  (optional) – field to sort by: name | price | category  (default: name)
    order    (optional) – asc | desc  (default: asc)

    Example
    -------
    GET /api/products/search?q=keyboard&page=1&per_page=5&sort_by=price&order=asc
    """

    # ---- 1. Extract & validate `q` ----------------------------------------
    raw_keyword = request.args.get("q", "")
    valid, reason = validate_keyword(raw_keyword)
    if not valid:
        return jsonify({"error": "Invalid keyword", "message": reason}), 400

    keyword = raw_keyword.strip()

    # ---- 2. Validate pagination parameters --------------------------------
    page, _     = validate_pagination(request.args.get("page",     1),  default=1,  min_val=1,  max_val=1000)
    per_page, _ = validate_pagination(request.args.get("per_page", 10), default=10, min_val=1,  max_val=50)
    offset      = (page - 1) * per_page

    # ---- 3. Validate sort_by and order (whitelist) -------------------------
    ALLOWED_SORT_FIELDS = {"name", "price", "category"}
    ALLOWED_ORDERS      = {"asc", "desc"}

    sort_by = request.args.get("sort_by", "name").lower()
    order   = request.args.get("order",   "asc" ).lower()

    if sort_by not in ALLOWED_SORT_FIELDS:
        return jsonify({
            "error":   "Invalid sort_by value",
            "message": f"Allowed values: {sorted(ALLOWED_SORT_FIELDS)}",
        }), 400

    if order not in ALLOWED_ORDERS:
        return jsonify({
            "error":   "Invalid order value",
            "message": f"Allowed values: {sorted(ALLOWED_ORDERS)}",
        }), 400

    # ---- 4. Build parameterised query ------------