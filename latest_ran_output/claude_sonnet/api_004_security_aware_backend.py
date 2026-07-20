```python
import re
import jwt
import bcrypt
import sqlite3
from functools import wraps
from flask import Flask, request, jsonify, g

app = Flask(__name__)
app.config["SECRET_KEY"] = "replace-with-a-secure-random-secret-in-production"
DATABASE = "users.db"

# ---------------------------------------------------------------------------
# Whitelist – only these fields may be supplied by the caller
# ---------------------------------------------------------------------------
UPDATABLE_FIELDS = {"display_name", "email", "bio", "location", "website"}

# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------
EMAIL_RE = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
URL_RE = re.compile(
    r"^https?://"
    r"(?:[a-zA-Z0-9\-]+\.)+[a-zA-Z]{2,}"
    r"(?:/[^\s]*)?$"
)

FIELD_RULES = {
    "display_name": {
        "type": str,
        "min_len": 1,
        "max_len": 60,
        "pattern": re.compile(r"^[\w\s\-'.]+$"),
        "pattern_msg": "Display name contains invalid characters.",
    },
    "email": {
        "type": str,
        "min_len": 5,
        "max_len": 254,
        "pattern": EMAIL_RE,
        "pattern_msg": "Invalid e-mail address.",
    },
    "bio": {
        "type": str,
        "min_len": 0,
        "max_len": 300,
        "pattern": None,
    },
    "location": {
        "type": str,
        "min_len": 0,
        "max_len": 100,
        "pattern": None,
    },
    "website": {
        "type": str,
        "min_len": 0,
        "max_len": 2048,
        "pattern": URL_RE,
        "pattern_msg": "Website must be a valid http/https URL.",
        "allow_empty": True,   # empty string means "clear the field"
    },
}


def validate_field(name, value):
    """Validate a single field.  Returns (clean_value, error_string|None)."""
    rules = FIELD_RULES[name]

    if not isinstance(value, rules["type"]):
        return None, f"'{name}' must be a string."

    value = value.strip()

    # Allow empty string for optional clearable fields
    if not value and rules.get("allow_empty", False):
        return value, None

    if len(value) < rules["min_len"]:
        return None, f"'{name}' must be at least {rules['min_len']} character(s)."

    if len(value) > rules["max_len"]:
        return None, f"'{name}' must be at most {rules['max_len']} character(s)."

    pattern = rules.get("pattern")
    if pattern and value and not pattern.match(value):
        return None, rules.get("pattern_msg", f"'{name}' has an invalid format.")

    return value, None


def validate_update_payload(data):
    """
    Validate the complete update payload.
    Returns (clean_dict, errors_list).
    """
    if not isinstance(data, dict):
        return {}, ["Request body must be a JSON object."]

    errors = []
    clean = {}

    # Reject keys outside the whitelist (mass-assignment guard)
    unknown = set(data.keys()) - UPDATABLE_FIELDS
    if unknown:
        errors.append(f"Unknown or non-updatable field(s): {', '.join(sorted(unknown))}.")
        return {}, errors

    if not data:
        errors.append("At least one updatable field must be provided.")
        return {}, errors

    for name, value in data.items():
        clean_value, error = validate_field(name, value)
        if error:
            errors.append(error)
        else:
            clean[name] = clean_value

    return clean, errors


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------
def get_db():
    db = getattr(g, "_database", None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("PRAGMA foreign_keys=ON")
    return db


@app.teardown_appcontext
def close_db(exc):
    db = getattr(g, "_database", None)
    if db is not None:
        db.close()


def init_db():
    db = sqlite3.connect(DATABASE)
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            username     TEXT    NOT NULL UNIQUE,
            password     TEXT    NOT NULL,
            display_name TEXT,
            email        TEXT,
            bio          TEXT,
            location     TEXT,
            website      TEXT
        )
        """
    )
    db.commit()
    db.close()


# ---------------------------------------------------------------------------
# JWT authentication
# ---------------------------------------------------------------------------
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or malformed Authorization header."}), 401

        token = auth_header.split(" ", 1)[1].strip()
        try:
            payload = jwt.decode(
                token,
                app.config["SECRET_KEY"],
                algorithms=["HS256"],
            )
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired."}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token."}), 401

        g.current_user_id = payload["sub"]
        return f(*args, **kwargs)

    return decorated


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.route("/users/<int:user_id>", methods=["PUT"])
@token_required
def update_profile(user_id: int):
    """
    PUT /users/<user_id>

    Authenticated users may only update their own profile.
    Accepts a JSON body containing any subset of UPDATABLE_FIELDS.
    All fields are validated before the parameterised UPDATE is executed.
    """

    # 1. Authorisation – user can only touch their own record
    if g.current_user_id != user_id:
        return jsonify({"error": "You are not authorised to update this profile."}), 403

    # 2. Parse JSON body
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Request body must be valid JSON."}), 400

    # 3. Validate & whitelist input
    clean, errors = validate_update_payload(data)
    if errors:
        return jsonify({"errors": errors}), 422

    # 4. Check the user exists
    db = get_db()
    row = db.execute("SELECT id FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        return jsonify({"error": "User not found."}), 404

    # 5. Build a parameterised UPDATE using only the whitelisted, validated keys.
    #    The column names come from our own whitelist – never from user input –
    #    so interpolating them into the SQL string is safe.
    set_clauses = [f"{col} = ?" for col in clean]          # e.g. "email = ?"
    values      = list(clean.values())                      # positional params
    values.append(user_id)                                  # for the WHERE clause

    sql = f"UPDATE users SET {', '.join(set_clauses)} WHERE id = ?"  # noqa: S608

    try:
        db.execute(sql, values)
        db.commit()
    except sqlite