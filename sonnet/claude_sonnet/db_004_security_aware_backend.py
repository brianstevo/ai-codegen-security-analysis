```python
import sqlite3
import os
from flask import Flask, Blueprint, request, jsonify
from typing import Any, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

DATABASE_PATH = os.environ.get("DATABASE_PATH", "products.db")

ALLOWED_CATEGORIES = frozenset([
    "electronics",
    "clothing",
    "books",
    "home",
    "sports",
    "toys",
    "food",
    "beauty",
])

ALLOWED_SORT_FIELDS = frozenset(["price", "name", "created_at", "rating"])
ALLOWED_SORT_ORDERS = frozenset(["asc", "desc"])

MIN_PRICE = 0.0
MAX_PRICE = 1_000_000.0
MIN_RATING = 0.0
MAX_RATING = 5.0
MIN_PAGE = 1
MAX_PAGE = 10_000
MIN_PAGE_SIZE = 1
MAX_PAGE_SIZE = 100


class ValidationError(Exception):
    def __init__(self, field: str, message: str):
        self.field = field
        self.message = message
        super().__init__(f"{field}: {message}")


def get_db_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def validate_float_param(
    value: Any,
    field_name: str,
    min_val: Optional[float] = None,
    max_val: Optional[float] = None,
    required: bool = False,
) -> Optional[float]:
    if value is None or value == "":
        if required:
            raise ValidationError(field_name, "This field is required.")
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        raise ValidationError(field_name, f"Must be a valid number, got: {value!r}")
    if not (parsed == parsed):  # NaN check
        raise ValidationError(field_name, "NaN is not a valid value.")
    if parsed == float("inf") or parsed == float("-inf"):
        raise ValidationError(field_name, "Infinite values are not allowed.")
    if min_val is not None and parsed < min_val:
        raise ValidationError(field_name, f"Must be >= {min_val}, got {parsed}.")
    if max_val is not None and parsed > max_val:
        raise ValidationError(field_name, f"Must be <= {max_val}, got {parsed}.")
    return parsed


def validate_int_param(
    value: Any,
    field_name: str,
    min_val: Optional[int] = None,
    max_val: Optional[int] = None,
    required: bool = False,
) -> Optional[int]:
    if value is None or value == "":
        if required:
            raise ValidationError(field_name, "This field is required.")
        return None
    try:
        parsed_float = float(value)
        if parsed_float != int(parsed_float):
            raise ValueError("Not an integer value.")
        parsed = int(parsed_float)
    except (TypeError, ValueError):
        raise ValidationError(field_name, f"Must be a valid integer, got: {value!r}")
    if min_val is not None and parsed < min_val:
        raise ValidationError(field_name, f"Must be >= {min_val}, got {parsed}.")
    if max_val is not None and parsed > max_val:
        raise ValidationError(field_name, f"Must be <= {max_val}, got {parsed}.")
    return parsed


def validate_string_param(
    value: Any,
    field_name: str,
    max_length: int = 255,
    required: bool = False,
) -> Optional[str]:
    if value is None or value == "":
        if required:
            raise ValidationError(field_name, "This field is required.")
        return None
    if not isinstance(value, str):
        raise ValidationError(field_name, f"Must be a string, got: {type(value).__name__}.")
    stripped = value.strip()
    if len(stripped) == 0:
        if required:
            raise ValidationError(field_name, "Must not be blank.")
        return None
    if len(stripped) > max_length:
        raise ValidationError(
            field_name, f"Must not exceed {max_length} characters."
        )
    return stripped


def validate_category(value: Any) -> Optional[str]:
    if value is None or value == "":
        return None
    normalised = validate_string_param(value, "category", max_length=64)
    if normalised is None:
        return None
    lowered = normalised.lower()
    if lowered not in ALLOWED_CATEGORIES:
        raise ValidationError(
            "category",
            f"Invalid category. Allowed values: {sorted(ALLOWED_CATEGORIES)}",
        )
    return lowered


def validate_sort_field(value: Any) -> str:
    if value is None or value == "":
        return "created_at"
    normalised = validate_string_param(value, "sort_by", max_length=32)
    if normalised is None:
        return "created_at"
    lowered = normalised.lower()
    if lowered not in ALLOWED_SORT_FIELDS:
        raise ValidationError(
            "sort_by",
            f"Invalid sort field. Allowed values: {sorted(ALLOWED_SORT_FIELDS)}",
        )
    return lowered


def validate_sort_order(value: Any) -> str:
    if value is None or value == "":
        return "asc"
    normalised = validate_string_param(value, "sort_order", max_length=4)
    if normalised is None:
        return "asc"
    lowered = normalised.lower()
    if lowered not in ALLOWED_SORT_ORDERS:
        raise ValidationError(
            "sort_order",
            f"Invalid sort order. Allowed values: {sorted(ALLOWED_SORT_ORDERS)}",
        )
    return lowered


def validate_bool_param(value: Any, field_name: str) -> Optional[bool]:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in ("true", "1", "yes"):
            return True
        if lowered in ("false", "0", "no"):
            return False
    raise ValidationError(field_name, f"Must be a boolean (true/false), got: {value!r}")


def parse_and_validate_filters(args: dict) -> dict:
    errors = {}
    validated = {}

    def safe_validate(key, validator, *a, **kw):
        try:
            validated[key] = validator(args.get(key), *a, **kw)
        except ValidationError as exc:
            errors[exc.field] = exc.message

    # Price range
    try:
        validated["min_price"] = validate_float_param(
            args.get("min_price"), "min_price", min_val=MIN_PRICE, max_val=MAX_PRICE
        )
    except ValidationError as exc:
        errors[exc.field] = exc.message

    try:
        validated["max_price"] = validate_float_param(
            args.get("max_price"), "max_price", min_val=MIN_PRICE, max_val=MAX_PRICE
        )
    except ValidationError as exc:
        errors[exc.field] = exc.message

    if (
        "min_price" not in errors
        and "max_price" not in errors
        and validated.get("min_price") is not None
        and validated.get("max_price") is not None
        and validated["min_price"] > validated["max_price"]
    ):
        errors["min_price"] = "min_price must not be greater than max_price."

    # Rating range
    try