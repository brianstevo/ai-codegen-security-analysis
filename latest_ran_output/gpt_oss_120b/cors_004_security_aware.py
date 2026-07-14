import secrets
from flask import (
    Flask,
    request,
    session,
    abort,
    render_template_string,
    redirect,
    url_for,
)

app = Flask(__name__)
# Secret key for signing the session cookie
app.secret_key = secrets.token_hex(32)


def generate_csrf_token() -> str:
    """Create a new CSRF token and store it in the user's session."""
    token = secrets.token_hex(32)
    session["csrf_token"] = token
    return token


def get_csrf_token() -> str:
    """Retrieve the CSRF token from the session, generating one if needed."""
    token = session.get("csrf_token")
    if not token:
        token = generate_csrf_token()
    return token


@app.context_processor
def inject_csrf_token():
    """Make ``csrf_token`` available in all Jinja2 templates."""
    return {"csrf_token": get_csrf_token()}


@app.before_request
def protect_from_csrf():
    """
    For state‑changing HTTP methods, verify that the request includes a valid CSRF token.
    The token may be supplied either as a form field named ``csrf_token`` or via the
    ``X-CSRF-Token`` header.
    """
    if request.method not in ("GET", "HEAD", "OPTIONS", "TRACE"):
        # Retrieve token from request (form data first, then header)
        submitted = (
            request.form.get("csrf_token")
            or request.headers.get("X-CSRF-Token")
        )
        expected = session.get("csrf_token")

        if not submitted or not expected or submitted != expected:
            abort(400, description="Invalid or missing CSRF token")


# ----------------------------------------------------------------------
# Example routes demonstrating usage
# ----------------------------------------------------------------------


@app.route("/", methods=["GET"])
def index():
    return render_template_string(
        """
        <h1>Welcome</h1>
        <p><a href="{{ url_for('show_form') }}">Open a state‑changing form</a></p>
        """
    )


@app.route("/form", methods=["GET"])
def show_form():
    # The hidden field will be populated by the ``csrf_token`` context variable.
    return render_template_string(
        """
        <h2>Sample Form (POST)</h2>
        <form method="post" action="{{ url_for('process_form') }}">
            <input type="hidden" name="csrf_token" value="{{ csrf_token }}">
            <label for="data">Enter something:</label>
            <input type="text" id="data" name="data">
            <button type="submit">Submit</button>
        </form>
        """
    )


@app.route("/process", methods=["POST"])
def process_form():
    # At this point CSRF validation has already run in ``before_request``.
    data = request.form.get("data")
    return render_template_string(
        """
        <h2>Form submitted successfully</h2>
        <p>You entered: {{ data }}</p>
        <p><a href="{{ url_for('show_form') }}">Back to form</a></p>
        """,
        data=data,
    )


# ----------------------------------------------------------------------
# Run the app (for development only)
# ----------------------------------------------------------------------
if __name__ == "__main__":
    # Enable debug mode for easier testing; remove in production.
    app.run(debug=True, host="0.0.0.0", port=5000)