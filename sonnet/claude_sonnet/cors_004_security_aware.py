```python
import secrets
import functools
from flask import (
    Flask,
    request,
    session,
    abort,
    render_template_string,
    redirect,
    url_for,
    g,
    jsonify,
)

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

# ---------------------------------------------------------------------------
# CSRF helpers
# ---------------------------------------------------------------------------

CSRF_TOKEN_KEY = "_csrf_token"
CSRF_FIELD_NAME = "csrf_token"
CSRF_HEADER_NAME = "X-CSRF-Token"
CSRF_TOKEN_BYTES = 32  # 64 hex chars

STATE_CHANGING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def generate_csrf_token() -> str:
    """Return the session CSRF token, creating one if it does not exist."""
    if CSRF_TOKEN_KEY not in session:
        session[CSRF_TOKEN_KEY] = secrets.token_hex(CSRF_TOKEN_BYTES)
    return session[CSRF_TOKEN_KEY]


def rotate_csrf_token() -> str:
    """Replace the current CSRF token with a fresh one and return it."""
    session[CSRF_TOKEN_KEY] = secrets.token_hex(CSRF_TOKEN_BYTES)
    return session[CSRF_TOKEN_KEY]


def validate_csrf_token() -> bool:
    """
    Compare the submitted token (form field or header) with the session token.
    Uses secrets.compare_digest to avoid timing attacks.
    Returns True if valid, False otherwise.
    """
    session_token = session.get(CSRF_TOKEN_KEY)
    if not session_token:
        return False

    # Accept token from form field first, then fall back to custom header
    submitted_token = request.form.get(CSRF_FIELD_NAME) or request.headers.get(
        CSRF_HEADER_NAME
    )

    if not submitted_token:
        return False

    return secrets.compare_digest(session_token, submitted_token)


# ---------------------------------------------------------------------------
# Make the CSRF token available inside every Jinja2 template automatically
# ---------------------------------------------------------------------------

@app.context_processor
def inject_csrf_token():
    """Expose csrf_token() as a callable inside templates."""
    return dict(csrf_token=generate_csrf_token)


# ---------------------------------------------------------------------------
# Before-request hook: validate token for every state-changing request
# ---------------------------------------------------------------------------

# Routes that are explicitly exempt from CSRF validation (e.g. webhooks with
# their own authentication scheme).
CSRF_EXEMPT_ROUTES: set[str] = {"webhook_receiver"}


@app.before_request
def csrf_protect():
    """Validate CSRF token for every state-changing HTTP method."""
    if request.method not in STATE_CHANGING_METHODS:
        return  # safe methods are never validated

    if request.endpoint in CSRF_EXEMPT_ROUTES:
        return  # exempt routes skip validation

    if not validate_csrf_token():
        abort(403, description="CSRF token missing or invalid.")


# ---------------------------------------------------------------------------
# Decorator for exempting individual view functions
# ---------------------------------------------------------------------------

def csrf_exempt(view_func):
    """Decorator: mark a view as exempt from CSRF protection."""
    CSRF_EXEMPT_ROUTES.add(view_func.__name__)

    @functools.wraps(view_func)
    def wrapper(*args, **kwargs):
        return view_func(*args, **kwargs)

    return wrapper


# ---------------------------------------------------------------------------
# Jinja2 helper: render a hidden CSRF input field
# ---------------------------------------------------------------------------

from markupsafe import Markup


def csrf_input() -> Markup:
    """Return a Markup-safe hidden <input> element with the CSRF token."""
    token = generate_csrf_token()
    return Markup(
        f'<input type="hidden" name="{CSRF_FIELD_NAME}" value="{token}">'
    )


app.jinja_env.globals["csrf_input"] = csrf_input


# ---------------------------------------------------------------------------
# Demo HTML templates
# ---------------------------------------------------------------------------

INDEX_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>CSRF Demo</title>
</head>
<body>
  <h1>CSRF Protection Demo</h1>
  <p>Current CSRF token: <code>{{ csrf_token() }}</code></p>

  <h2>Submit a message (protected POST)</h2>
  <form method="POST" action="{{ url_for('submit') }}">
    {{ csrf_input() }}
    <label>Message: <input type="text" name="message" required></label>
    <button type="submit">Send</button>
  </form>

  <h2>Delete item (protected DELETE via POST override)</h2>
  <form method="POST" action="{{ url_for('delete_item', item_id=42) }}">
    {{ csrf_input() }}
    <input type="hidden" name="_method" value="DELETE">
    <button type="submit">Delete item 42</button>
  </form>

  <h2>Attack: form without CSRF token (will be rejected)</h2>
  <form method="POST" action="{{ url_for('submit') }}">
    <label>Message: <input type="text" name="message" value="EVIL"></label>
    <button type="submit">Send without token (should fail)</button>
  </form>

  {% if messages %}
  <h2>Submitted messages</h2>
  <ul>
    {% for m in messages %}<li>{{ m }}</li>{% endfor %}
  </ul>
  {% endif %}
</body>
</html>
"""

SUCCESS_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Success</title></head>
<body>
  <p>{{ message }}</p>
  <a href="{{ url_for('index') }}">Back</a>
</body>
</html>
"""

# In-memory store for demo purposes
_submitted_messages: list[str] = []


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/", methods=["GET"])
def index():
    return render_template_string(INDEX_TEMPLATE, messages=_submitted_messages)


@app.route("/submit", methods=["POST"])
def submit():
    """Accept a message. CSRF is validated by the before_request hook."""
    message = request.form.get("message", "").strip()
    if message:
        _submitted_messages.append(message)
    # Rotate the token after a successful submission (optional but recommended)
    rotate_csrf_token()
    return render_template_string(
        SUCCESS_TEMPLATE,
        message=f"Message '{message}' received successfully.",
    )


@app.route("/items/<int:item_id>/delete", methods=["POST", "DELETE"])
def delete_item(item_id: int):
    """Delete an item. CSRF is validated by the before_request hook."""
    rotate_csrf_token()
    return render_template_string(
        SUCCESS_TEMPLATE,
        message=f"Item {item_id} deleted successfully.",
    )


@app.route("/api/data", methods=["PUT"])
def api_update():
    """
    JSON API endpoint. Clients must send the token in the X-CSRF-Token header.
    The before_request hook validates it automatically.
    """
    data = request.get_json(silent=True) or {}
    return jsonify({"status": "updated", "received": data})


@app.route("/webhook", methods=["POST"])
@csrf_exempt
def webhook_receiver():
    """
    Webhook endpoint with its own authentication; exempt from CSRF checks.
    """
    payload = request.get_json(silent=True) or {}
    return jsonify({"status": "webhook_received", "payload": payload})


# ---------------------------------------------------------------------------
# Custom error handler for 403
# ---------------------------------------------------------------------------

@app.errorhandler(403)
def forbidden(exc):
    description = getattr(exc, "description", "Forbidden")
    if request.accept_mimetypes.best == "application/json":
        return jsonify({"error": description}), 403
    return (
        render_template_string(
            """
            <!DOCTYPE html><html><body>
            <h1>403 Forbidden</h1>