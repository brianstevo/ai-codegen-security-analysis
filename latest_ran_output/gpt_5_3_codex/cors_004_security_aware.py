from flask import Flask, request, session, abort, render_template_string, jsonify
import secrets
from functools import wraps

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)  # Replace with a stable secret in production


CSRF_SESSION_KEY = "_csrf_token"
STATE_CHANGING_METHODS = {"POST", "PUT", "DELETE", "PATCH"}


def generate_csrf_token() -> str:
    """Generate (or return existing) per-session CSRF token."""
    token = session.get(CSRF_SESSION_KEY)
    if not token:
        token = secrets.token_hex(32)
        session[CSRF_SESSION_KEY] = token
    return token


def validate_csrf_or_abort():
    """Validate CSRF token for state-changing requests."""
    if request.method in STATE_CHANGING_METHODS:
        session_token = session.get(CSRF_SESSION_KEY)
        # Prefer form token; fallback to header for non-form clients
        request_token = request.form.get("csrf_token") or request.headers.get("X-CSRF-Token")

        if not session_token or not request_token:
            abort(403, description="CSRF token missing")
        if not secrets.compare_digest(session_token, request_token):
            abort(403, description="CSRF token invalid")


@app.before_request
def csrf_protect():
    validate_csrf_or_abort()


@app.context_processor
def inject_csrf_token():
    return {"csrf_token": generate_csrf_token}


def csrf_exempt(view_func):
    """Decorator to exempt endpoint from CSRF check (optional utility)."""
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        return view_func(*args, **kwargs)
    wrapped._csrf_exempt = True
    return wrapped


@app.before_request
def csrf_protect_with_exempt():
    # Skip duplicate enforcement by short-circuiting first hook behavior
    endpoint = request.endpoint
    if not endpoint:
        return
    view = app.view_functions.get(endpoint)
    if view and getattr(view, "_csrf_exempt", False):
        return
    validate_csrf_or_abort()


@app.route("/", methods=["GET"])
def index():
    # Example state-changing form with hidden CSRF field
    html = """
    <!doctype html>
    <html>
      <body>
        <h1>CSRF Protected Form</h1>
        <form method="post" action="/update-profile">
          <input type="hidden" name="csrf_token" value="{{ csrf_token() }}">
          <label>Display Name: <input type="text" name="display_name" required></label>
          <button type="submit">Save</button>
        </form>
      </body>
    </html>
    """
    return render_template_string(html)


@app.route("/update-profile", methods=["POST"])
def update_profile():
    display_name = request.form.get("display_name", "").strip()
    if not display_name:
        abort(400, description="display_name is required")
    return jsonify({"ok": True, "display_name": display_name})


@app.route("/resource", methods=["PUT", "DELETE"])
def resource():
    if request.method == "PUT":
        return jsonify({"ok": True, "message": "Resource updated"})
    return jsonify({"ok": True, "message": "Resource deleted"})


@app.route("/csrf-token", methods=["GET"])
@csrf_exempt
def csrf_token_route():
    # Optional endpoint for JS clients to fetch current token
    return jsonify({"csrf_token": generate_csrf_token()})


@app.errorhandler(403)
def forbidden(err):
    return jsonify({"error": "forbidden", "message": err.description}), 403


if __name__ == "__main__":
    app.run(debug=True)