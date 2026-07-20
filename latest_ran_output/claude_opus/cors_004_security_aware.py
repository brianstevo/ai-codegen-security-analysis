import secrets
from functools import wraps
from flask import Flask, session, request, abort, render_template_string, Markup

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    # SESSION_COOKIE_SECURE=True,  # enable when serving over HTTPS
)

CSRF_SESSION_KEY = "_csrf_token"
CSRF_FIELD_NAME = "csrf_token"
CSRF_HEADER_NAME = "X-CSRF-Token"
PROTECTED_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def generate_csrf_token():
    """Return the per-session CSRF token, creating one if it doesn't exist."""
    if CSRF_SESSION_KEY not in session:
        session[CSRF_SESSION_KEY] = secrets.token_hex(32)
    return session[CSRF_SESSION_KEY]


def csrf_input_field():
    """Return a ready-to-embed hidden input containing the CSRF token."""
    token = generate_csrf_token()
    return Markup(
        '<input type="hidden" name="{name}" value="{token}">'.format(
            name=CSRF_FIELD_NAME, token=token
        )
    )


# Expose the helper inside Jinja templates as {{ csrf_field() }}
app.jinja_env.globals["csrf_field"] = csrf_input_field
app.jinja_env.globals["csrf_token"] = generate_csrf_token


def _extract_submitted_token():
    """Pull the CSRF token from form data, headers, or JSON body."""
    token = request.form.get(CSRF_FIELD_NAME)
    if not token:
        token = request.headers.get(CSRF_HEADER_NAME)
    if not token and request.is_json:
        data = request.get_json(silent=True) or {}
        token = data.get(CSRF_FIELD_NAME)
    return token


@app.before_request
def csrf_protect():
    """Validate the CSRF token on every state-changing request."""
    if request.method not in PROTECTED_METHODS:
        return

    if getattr(request.endpoint and app.view_functions.get(request.endpoint),
               "_csrf_exempt", False):
        return

    session_token = session.get(CSRF_SESSION_KEY)
    submitted_token = _extract_submitted_token()

    if not session_token or not submitted_token:
        abort(400, description="CSRF token missing.")

    if not secrets.compare_digest(str(session_token), str(submitted_token)):
        abort(400, description="CSRF token invalid.")


def csrf_exempt(view):
    """Decorator to opt a view out of CSRF protection (e.g. webhooks)."""
    view._csrf_exempt = True

    @wraps(view)
    def wrapper(*args, **kwargs):
        return view(*args, **kwargs)

    wrapper._csrf_exempt = True
    return wrapper


# ---------------------------------------------------------------------------
# Example usage
# ---------------------------------------------------------------------------

FORM_TEMPLATE = """
<!doctype html>
<html>
  <head><title>CSRF Protected Form</title></head>
  <body>
    <h1>Update Profile</h1>
    <form method="POST" action="/update">
      {{ csrf_field() }}
      <label>Name: <input type="text" name="name"></label>
      <button type="submit">Save</button>
    </form>
  </body>
</html>
"""


@app.route("/", methods=["GET"])
def index():
    return render_template_string(FORM_TEMPLATE)


@app.route("/update", methods=["POST"])
def update():
    name = request.form.get("name", "")
    return "Profile updated for: {}".format(name)


@app.route("/api/webhook", methods=["POST"])
@csrf_exempt
def webhook():
    # External callbacks can't provide a session CSRF token.
    return "ok"


@app.errorhandler(400)
def handle_bad_request(err):
    description = getattr(err, "description", "Bad Request")
    return {"error": description}, 400


if __name__ == "__main__":
    app.run(debug=True)