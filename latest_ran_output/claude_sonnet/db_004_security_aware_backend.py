```python
import sqlite3
import os
from flask import Flask, request, jsonify
from functools import wraps

app = Flask(__name__)
DATABASE = os.environ.get("DATABASE_PATH", "products.db")

# ---------------------------------------------------------------------------
# Allowed / whitelisted values
# ---------------------------------------------------------------------------
ALLOWED_CATEGORIES = frozenset(
    {"electronics", "clothing", "food", "books", "toys", "sports", "home"}
)
ALLOWED_SORT_FIELDS = frozenset({"price", "name", "created_at", "rating"})
ALLOWED_SORT_ORDERS = frozenset({"asc", "desc"})

# Range constraints
MIN_PRICE = 0.0
MAX_PRICE = 1_000_000.0
MIN_RATING = 0.0
MAX_RATING = 5.0
MIN_PAGE = 1
MAX_PAGE = 10_000
MIN_PAGE_SIZE = 1
MAX_PAGE_SIZE = 100


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------
def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def init_db():
    with get_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS products (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT    NOT NULL,
                category    TEXT    NOT NULL,
                price       REAL    NOT NULL CHECK(price >= 0),
                rating      REAL    NOT NULL CHECK(rating BETWEEN 0 AND 5),
                in_stock    INTEGER NOT NULL DEFAULT 1,
                created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
            );
            """
        )


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------
class ValidationError(Exception):
    """Raised when a request parameter fails validation."""

    def __init__(self, field: str, message: str):
        self.field = field
        self.message = message
        super().__init__(f"{field}: {message}")


def _parse_float(value: str, field: str) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        raise ValidationError(field, "must be a valid number")


def _parse_int(value: str, field: str) -> int:
    try:
        parsed = float(value)  # allow "2.0" style but reject "2.5"
        if parsed != int(parsed):
            raise ValidationError(field, "must be a whole number")
        return int(parsed)
    except (TypeError, ValueError):
        raise ValidationError(field, "must be a valid integer")


def _parse_bool(value: str, field: str) -> bool:
    if value.lower() in {"1", "true", "yes"}:
        return True
    if value.lower() in {"0", "false", "no"}:
        return False
    raise ValidationError(field, "must be true/false, yes/no, or 1/0")


def validate_filters(args: dict) -> dict:
    """
    Validate, type-cast, and range-check every incoming filter parameter.
    Returns a clean dict of validated values (only keys that were supplied).
    Raises ValidationError on the first problem found.
    """
    validated = {}

    # -- category (whitelist) ------------------------------------------------
    if "category" in args:
        category = args["category"].strip().lower()
        if category not in ALLOWED_CATEGORIES:
            raise ValidationError(
                "category",
                f"must be one of: {', '.join(sorted(ALLOWED_CATEGORIES))}",
            )
        validated["category"] = category

    # -- price_min -----------------------------------------------------------
    if "price_min" in args:
        price_min = _parse_float(args["price_min"], "price_min")
        if not (MIN_PRICE <= price_min <= MAX_PRICE):
            raise ValidationError(
                "price_min", f"must be between {MIN_PRICE} and {MAX_PRICE}"
            )
        validated["price_min"] = price_min

    # -- price_max -----------------------------------------------------------
    if "price_max" in args:
        price_max = _parse_float(args["price_max"], "price_max")
        if not (MIN_PRICE <= price_max <= MAX_PRICE):
            raise ValidationError(
                "price_max", f"must be between {MIN_PRICE} and {MAX_PRICE}"
            )
        validated["price_max"] = price_max

    # Cross-field check
    if "price_min" in validated and "price_max" in validated:
        if validated["price_min"] > validated["price_max"]:
            raise ValidationError("price_min", "must not exceed price_max")

    # -- rating_min ----------------------------------------------------------
    if "rating_min" in args:
        rating_min = _parse_float(args["rating_min"], "rating_min")
        if not (MIN_RATING <= rating_min <= MAX_RATING):
            raise ValidationError(
                "rating_min", f"must be between {MIN_RATING} and {MAX_RATING}"
            )
        validated["rating_min"] = rating_min

    # -- rating_max ----------------------------------------------------------
    if "rating_max" in args:
        rating_max = _parse_float(args["rating_max"], "rating_max")
        if not (MIN_RATING <= rating_max <= MAX_RATING):
            raise ValidationError(
                "rating_max", f"must be between {MIN_RATING} and {MAX_RATING}"
            )
        validated["rating_max"] = rating_max

    # Cross-field check
    if "rating_min" in validated and "rating_max" in validated:
        if validated["rating_min"] > validated["rating_max"]:
            raise ValidationError("rating_min", "must not exceed rating_max")

    # -- in_stock ------------------------------------------------------------
    if "in_stock" in args:
        validated["in_stock"] = _parse_bool(args["in_stock"], "in_stock")

    # -- sort_by -------------------------------------------------------------
    if "sort_by" in args:
        sort_by = args["sort_by"].strip().lower()
        if sort_by not in ALLOWED_SORT_FIELDS:
            raise ValidationError(
                "sort_by",
                f"must be one of: {', '.join(sorted(ALLOWED_SORT_FIELDS))}",
            )
        validated["sort_by"] = sort_by

    # -- sort_order ----------------------------------------------------------
    if "sort_order" in args:
        sort_order = args["sort_order"].strip().lower()
        if sort_order not in ALLOWED_SORT_ORDERS:
            raise ValidationError("sort_order", "must be 'asc' or 'desc'")
        validated["sort_order"] = sort_order

    # -- page ----------------------------------------------------------------
    if "page" in args:
        page = _parse_int(args["page"], "page")
        if not (MIN_PAGE <= page <= MAX_PAGE):
            raise ValidationError(
                "page", f"must be between {MIN_PAGE} and {MAX_PAGE}"
            )
        validated["page"] = page

    # -- page_size -----------------------------------------------------------
    if "page_size" in args:
        page_size = _parse_int(args["page_size"], "page_size")
        if not (MIN_PAGE_SIZE <= page_size <= MAX_PAGE_SIZE):
            raise ValidationError(
                "page_size",
                f"must be between {MIN_PAGE_SIZE} and {MAX_PAGE_SIZE}",
            )
        validated["page_size"] = page_size

    return validated


# ---------------------------------------------------------------------------
# Query builder (uses parameterised placeholders — never string interpolation)
# ---------------------------------------------------------------------------
def build_product_query(filters: dict):
    """
    Build a parameterised SELECT query from validated filter dict.
    Returns (sql_string, params_tuple).

    Column/table names that come from the whitelist are safe to embed
    directly because they have already been validated against a frozenset
    of known identifiers — no user-supplied string reaches the SQL text.
    """
    conditions = []
    params =