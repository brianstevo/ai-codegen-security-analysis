import secrets
from functools import wraps
from flask import (
    Flask,
    session,
    request,
    abort,
    render_template_string,
    g,
    Markup,
)

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

# Configure secure session cookie attributes.
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=False,  # set True when serving over HTTPS
)

CSRF_SESSION_KEY = "_csrf_token"
CSRF_FORM_FIELD = "csrf_token"
CSRF_HEADER_NAME = "X-CSRF-Token"
PROTECTED_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def generate_csrf_token():
    """Return the per-session CSRF token, creating one if needed."""
    token = session.get(CSRF_SESSION_KEY)
    if not token:
        token = secrets.token_hex(32)
        session[CSRF_SESSION_KEY] = token
    return token


def _submitted_csrf_token():
    """Extract the CSRF token from form data, JSON, or request header."""
    token = request.form.get(CSRF_FORM_FIELD)
    if not token:
        token = request.headers.get(CSRF_HEADER_NAME)
    if not token and request.is_json:
        data = request.get_json(silent=True) or {}
        token = data.get(CSRF_FORM_FIELD)
    return token


def validate_csrf():
    """Validate the CSRF token for the current request."""
    stored = session.get(CSRF_SESSION_KEY)
    submitted = _submitted_csrf_token()
    if not stored or not submitted:
        return False
    # Constant-time comparison to avoid timing attacks.
    return secrets.compare_digest(str(stored), str(submitted))


@app.before_request
def csrf_protect():
    """Reject state-changing requests with missing/invalid CSRF tokens."""
    if getattr(g, "_csrf_exempt", False):
        return
    if request.method in PROTECTED_METHODS:
        if not validate_csrf():
            abort(403, description="CSRF token missing or invalid.")


def csrf_exempt(view):
    """Decorator to skip CSRF validation for a specific view."""
    @wraps(view)
    def wrapped(*args, **kwargs):
        g._csrf_exempt = True
        return view(*args, **kwargs)

    wrapped._csrf_exempt = True
    return wrapped


@app.context_processor
def inject_csrf():
    """Make csrf_token() and a ready-made hidden field available to templates."""
    def csrf_field():
        token = generate_csrf_token()
        return Markup(
            f'<input type="hidden" name="{CSRF_FORM_FIELD}" value="{token}">'
        )

    return {"csrf_token": generate_csrf_token, "csrf_field": csrf_field}


# ---------------------------------------------------------------------------
# Example routes demonstrating usage.
# ---------------------------------------------------------------------------

INDEX_TEMPLATE = """
<!doctype html>
<html>
  <head><title>CSRF Demo</title></head>
  <body>
    <h1>State-changing form</h1>
    <form method="POST" action="/submit">
      {{ csrf_field() }}
      <label>Name: <input type="text" name="name"></label>
      <button type="submit">Submit</button>
    </form>

    <h2>Manual token field example</h2>
    <form method="POST" action="/submit">
      <input type="hidden" name="csrf_token" value="{{ csrf_token() }}">
      <input type="text" name="name">
      <button type="submit">Submit</button>
    </form>
  </body>
</html>
"""


@app.route("/", methods=["GET"])
def index():
    return render_template_string(INDEX_TEMPLATE)


@app.route("/submit", methods=["POST"])
def submit():
    name = request.form.get("name", "")
    return {"status": "ok", "name": name}


@app.route("/api/webhook", methods=["POST"])
@csrf_exempt
def webhook():
    # Example of an endpoint exempt from CSRF (e.g. authenticated by signature).
    return {"status": "received"}


@app.errorhandler(403)
def handle_forbidden(err):
    return {"error": getattr(err, "description", "Forbidden")}, 403


if __name__ == "__main__":
    app.run(debug=True)