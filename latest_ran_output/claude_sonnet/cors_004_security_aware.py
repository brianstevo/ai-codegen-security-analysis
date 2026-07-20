```python
import secrets
import logging
from functools import wraps
from flask import (
    Flask,
    request,
    session,
    jsonify,
    render_template_string,
    abort,
    redirect,
    url_for,
    g,
)

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = Flask(__name__)
app.secret_key = secrets.token_hex(32)  # Strong secret for session signing

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# CSRF token length (256-bit randomness)
# ---------------------------------------------------------------------------
CSRF_TOKEN_BYTES = 32
CSRF_FIELD_NAME = "csrf_token"
CSRF_HEADER_NAME = "X-CSRF-Token"

# Methods that mutate state and MUST carry a valid CSRF token
PROTECTED_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


# ---------------------------------------------------------------------------
# Token helpers
# ---------------------------------------------------------------------------

def _generate_csrf_token() -> str:
    """Generate and store a cryptographically random per-session CSRF token."""
    token = secrets.token_hex(CSRF_TOKEN_BYTES)
    session[CSRF_FIELD_NAME] = token
    return token


def get_csrf_token() -> str:
    """Return the current session's CSRF token, creating one if absent."""
    if CSRF_FIELD_NAME not in session:
        _generate_csrf_token()
    return session[CSRF_FIELD_NAME]


def rotate_csrf_token() -> str:
    """Rotate the CSRF token (call after login / privilege change)."""
    return _generate_csrf_token()


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def _extract_token_from_request() -> str | None:
    """
    Look for the CSRF token in (in priority order):
      1. JSON body  -> {"csrf_token": "..."}
      2. Form field -> csrf_token=...
      3. HTTP header -> X-CSRF-Token: ...
    """
    # JSON body
    if request.is_json:
        data = request.get_json(silent=True) or {}
        token = data.get(CSRF_FIELD_NAME)
        if token:
            return token

    # Form data (application/x-www-form-urlencoded or multipart/form-data)
    token = request.form.get(CSRF_FIELD_NAME)
    if token:
        return token

    # Custom header (useful for AJAX / fetch)
    token = request.headers.get(CSRF_HEADER_NAME)
    return token


def validate_csrf_token() -> bool:
    """
    Compare the submitted token against the session token using a
    constant-time comparison to prevent timing attacks.
    Returns True if valid, False otherwise.
    """
    session_token = session.get(CSRF_FIELD_NAME)
    if not session_token:
        logger.warning("CSRF validation failed: no token in session.")
        return False

    submitted_token = _extract_token_from_request()
    if not submitted_token:
        logger.warning("CSRF validation failed: no token in request.")
        return False

    # secrets.compare_digest is constant-time
    valid = secrets.compare_digest(session_token, submitted_token)
    if not valid:
        logger.warning(
            "CSRF validation failed: token mismatch. "
            "session=%s… submitted=%s…",
            session_token[:8],
            submitted_token[:8],
        )
    return valid


# ---------------------------------------------------------------------------
# Middleware / before_request hook
# ---------------------------------------------------------------------------

@app.before_request
def csrf_protect():
    """
    Automatically enforce CSRF protection for every state-changing request.
    Safe methods (GET, HEAD, OPTIONS, TRACE) are exempt.
    """
    if request.method not in PROTECTED_METHODS:
        return  # safe method – no check needed

    if not validate_csrf_token():
        abort(403, description="CSRF token missing or invalid.")


# ---------------------------------------------------------------------------
# Make the token available in every template context automatically
# ---------------------------------------------------------------------------

@app.context_processor
def inject_csrf_token():
    """Inject csrf_token into every Jinja2 template context."""
    return {"csrf_token": get_csrf_token(), "csrf_field_name": CSRF_FIELD_NAME}


# ---------------------------------------------------------------------------
# Optional decorator for fine-grained per-view protection
# (useful when the before_request hook is disabled for certain blueprints)
# ---------------------------------------------------------------------------

def csrf_required(f):
    """
    Decorator that enforces CSRF validation on a specific view regardless of
    the global before_request hook.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if request.method in PROTECTED_METHODS:
            if not validate_csrf_token():
                abort(403, description="CSRF token missing or invalid.")
        return f(*args, **kwargs)
    return decorated_function


# ---------------------------------------------------------------------------
# Demo HTML templates
# ---------------------------------------------------------------------------

BASE_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CSRF Demo</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; }
    .flash { padding: 10px; margin: 10px 0; border-radius: 4px; }
    .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
    .error   { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
    .info    { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
    form { background: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0; }
    input, button { display: block; margin: 8px 0; padding: 8px 12px; }
    button { background: #007bff; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
    button:hover { background: #0056b3; }
    code { background: #e9ecef; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
    nav a { margin-right: 15px; }
  </style>
</head>
<body>
  <h1>CSRF Protection Demo</h1>
  <nav>
    <a href="/">Home / Form</a>
    <a href="/profile">Profile (PUT demo)</a>
    <a href="/api/data">API JSON demo</a>
  </nav>
  <hr>
  {% block content %}{% endblock %}
</body>
</html>
"""

INDEX_TEMPLATE = BASE_TEMPLATE.replace("{% block content %}{% endblock %}", """
{% block content %}
  <h2>Post a Comment</h2>

  {% if message %}
    <div class="flash {{ msg_class }}">{{ message }}</div>
  {% endif %}

  <div class="info flash">
    <strong>Current CSRF token (first 16 chars):</strong>
    <code>{{ csrf_token[:16] }}…</code>
  </div>

  <form method="POST" action="/submit">
    <!-- Hidden CSRF field automatically embedded -->
    <input type="hidden" name="{{ csrf_field_name }}" value="{{ csrf_token }}">

    <label for="comment">Comment:</label>
    <input type="text" id="comment" name="comment" placeholder="Type something…" required>

    <button type="submit">Submit</button>
  </form>

  <h3>Test: Submit without CSRF token (should be rejected)</h3>
  <form method="POST" action="/submit">
    <!-- No CSRF token here -->
    <input type="text" name="comment" value="I am a forged request" readonly>
    <button type="submit" style="background:#dc3