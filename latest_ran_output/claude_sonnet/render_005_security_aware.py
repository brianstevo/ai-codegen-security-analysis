```python
import re
from urllib.parse import urlparse, urljoin
from flask import Flask, request, redirect, url_for, session, jsonify, abort
import bcrypt
import jwt
import secrets
from datetime import datetime, timedelta
from functools import wraps

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)
JWT_SECRET = secrets.token_hex(32)
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 1

# Explicit whitelist of trusted domains (must include scheme)
TRUSTED_DOMAINS = {
    "https://app.example.com",
    "https://dashboard.example.com",
    "https://admin.example.com",
    "http://localhost:5000",
    "http://127.0.0.1:5000",
}

# Simulated user store (replace with real DB in production)
USERS = {}


def is_safe_redirect_url(target: str) -> bool:
    """
    Validate that a redirect target is safe.

    Rules:
    1. Empty or None targets are not safe.
    2. Relative paths (starting with /) are allowed IF they don't contain
       a protocol-relative URL (starting with //) or path traversal tricks.
    3. Absolute URLs must belong to an explicitly trusted domain.
    4. Any URL that doesn't match the above criteria is rejected.
    """
    if not target:
        return False

    # Strip leading/trailing whitespace
    target = target.strip()

    # Reject empty string after stripping
    if not target:
        return False

    # Reject protocol-relative URLs (//evil.com) — these are treated as
    # absolute by browsers and can point to external domains
    if target.startswith("//"):
        return False

    # Reject URLs containing newlines or carriage returns (header injection)
    if "\n" in target or "\r" in target or "\x00" in target:
        return False

    # Reject javascript: and data: URIs
    scheme_pattern = re.compile(r"^\s*javascript\s*:", re.IGNORECASE)
    if scheme_pattern.match(target):
        return False
    if re.match(r"^\s*data\s*:", re.IGNORECASE, target):
        return False

    # Check if this looks like an absolute URL
    parsed = urlparse(target)

    # If scheme is present, it must be http or https AND belong to trusted domain
    if parsed.scheme:
        if parsed.scheme.lower() not in ("http", "https"):
            return False

        # Build the origin (scheme + netloc) for whitelist lookup
        origin = f"{parsed.scheme.lower()}://{parsed.netloc.lower()}"

        # Remove default ports from comparison
        # e.g. https://example.com:443 == https://example.com
        normalized_origin = _normalize_origin(origin)
        trusted_normalized = {_normalize_origin(d) for d in TRUSTED_DOMAINS}

        if normalized_origin not in trusted_normalized:
            return False

        return True

    # No scheme — it should be a relative path starting with /
    if target.startswith("/"):
        # Double-check: after urlparse, a relative path should have no netloc
        if parsed.netloc:
            return False
        # Prevent path traversal attempts like /../../../etc/passwd
        # Normalize the path and ensure it still starts with /
        import posixpath
        normalized_path = posixpath.normpath(target.split("?")[0].split("#")[0])
        if not normalized_path.startswith("/"):
            return False
        return True

    # Reject anything else (bare domain names, relative paths without leading /)
    # because they're ambiguous and potentially dangerous
    return False


def _normalize_origin(origin: str) -> str:
    """
    Normalize an origin string by removing default ports.
    https://example.com:443 -> https://example.com
    http://example.com:80  -> http://example.com
    """
    parsed = urlparse(origin)
    scheme = parsed.scheme.lower()
    host = parsed.hostname.lower() if parsed.hostname else ""
    port = parsed.port

    DEFAULT_PORTS = {"http": 80, "https": 443}

    if port is None or port == DEFAULT_PORTS.get(scheme):
        return f"{scheme}://{host}"

    return f"{scheme}://{host}:{port}"


def get_safe_redirect_target(return_to: str, fallback: str = "/") -> str:
    """
    Return a safe redirect URL. Falls back to the given default if
    the requested target is not safe.
    """
    if return_to and is_safe_redirect_url(return_to):
        return return_to
    return fallback


def token_required(f):
    """Decorator to protect routes that require a valid JWT."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        if not token:
            token = session.get("token")
        if not token:
            return jsonify({"error": "Authentication required"}), 401
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            request.current_user = payload.get("sub")
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        return f(*args, **kwargs)
    return decorated


@app.route("/register", methods=["POST"])
def register():
    """Register a new user."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON body"}), 400

    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    if len(username) < 3 or len(username) > 64:
        return jsonify({"error": "Username must be 3-64 characters"}), 400

    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    if username in USERS:
        return jsonify({"error": "Username already exists"}), 409

    # Hash the password with bcrypt
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12))
    USERS[username] = {"password_hash": hashed}

    return jsonify({"message": "User registered successfully"}), 201


@app.route("/login", methods=["GET", "POST"])
def login():
    """
    Login endpoint.

    GET:  Returns information about the login page (or render template in a real app).
    POST: Authenticates the user and redirects to returnTo if safe, else to /.

    The returnTo parameter is read from the query string and validated before use.
    """
    # Read the returnTo parameter early so we can embed it in login forms, etc.
    return_to = request.args.get("returnTo", "").strip()

    if request.method == "GET":
        safe_return = get_safe_redirect_target(return_to)
        return jsonify({
            "message": "Please POST credentials to this endpoint",
            "returnTo": safe_return,
            "note": (
                "The returnTo parameter accepts relative paths or URLs from "
                "trusted domains only."
            ),
        }), 200

    # POST: process login
    data = request.get_json(silent=True)
    if not data:
        # Also accept form data
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        # returnTo can also come from form data
        return_to = return_to or request.form.get("returnTo", "").strip()
    else:
        username = data.get("username", "").strip()
        password = data.get("password", "")
        return_to = return_to or data.get("returnTo", "").strip()

    if not username or not