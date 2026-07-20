import os
import secrets
import hmac
from flask import (
    Flask,
    abort,
    redirect,
    render_template_string,
    request,
    session,
    url_for,
)
from markupsafe import Markup, escape

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", secrets.token_hex(32))

CSRF_SESSION_KEY = "_csrf_token"
CSRF_FIELD_NAME = "csrf_token"
CSRF_PROTECTED_METHODS = {"POST", "PUT", "DELETE"}


def get_csrf_token() -> str:
    """
    Return the current session's CSRF token, creating one if needed.
    """
    token = session.get(CSRF_SESSION_KEY)
    if not token:
        token = secrets.token_hex(32)
        session[CSRF_SESSION_KEY] = token
    return token


def csrf_field() -> Markup:
    """
    Render a hidden CSRF input field for use in state-changing HTML forms.
    """
    token = get_csrf_token()
    return Markup(
        f'<input type="hidden" name="{escape(CSRF_FIELD_NAME)}" value="{escape(token)}">'
    )


def validate_csrf_token() -> None:
    """
    Validate CSRF token for state-changing requests.
    Rejects the request if the token is missing or does not match the session token.
    """
    expected_token = session.get(CSRF_SESSION_KEY)
    submitted_token = request.form.get(CSRF_FIELD_NAME)

    if not expected_token or not submitted_token:
        abort(400, description="Missing CSRF token")

    if not hmac.compare_digest(str(expected_token), str(submitted_token)):
        abort(400, description="Invalid CSRF token")


@app.before_request
def csrf_protect():
    get_csrf_token()

    if request.method in CSRF_PROTECTED_METHODS:
        validate_csrf_token()


@app.context_processor
def inject_csrf_helpers():
    return {
        "csrf_token": get_csrf_token,
        "csrf_field": csrf_field,
    }


@app.errorhandler(400)
def bad_request(error):
    return render_template_string(
        """
        <!doctype html>
        <html>
          <head><title>Bad Request</title></head>
          <body>
            <h1>400 Bad Request</h1>
            <p>{{ error.description }}</p>
            <p><a href="{{ url_for('index') }}">Back</a></p>
          </body>
        </html>
        """,
        error=error,
    ), 400


@app.route("/", methods=["GET"])
def index():
    return render_template_string(
        """
        <!doctype html>
        <html>
          <head><title>CSRF Protected Forms</title></head>
          <body>
            <h1>CSRF Protected Forms</h1>

            <h2>Create Item</h2>
            <form method="POST" action="{{ url_for('create_item') }}">
              {{ csrf_field() }}
              <label>
                Item name:
                <input type="text" name="name" required>
              </label>
              <button type="submit">Create</button>
            </form>

            <h2>Update Item</h2>
            <form method="POST" action="{{ url_for('update_item_form') }}">
              {{ csrf_field() }}
              <input type="hidden" name="_method" value="PUT">
              <label>
                New name:
                <input type="text" name="name" required>
              </label>
              <button type="submit">Update</button>
            </form>

            <h2>Delete Item</h2>
            <form method="POST" action="{{ url_for('delete_item_form') }}">
              {{ csrf_field() }}
              <input type="hidden" name="_method" value="DELETE">
              <button type="submit">Delete</button>
            </form>
          </body>
        </html>
        """
    )


@app.route("/items", methods=["POST"])
def create_item():
    name = request.form.get("name", "").strip()
    return render_template_string(
        """
        <!doctype html>
        <html>
          <head><title>Created</title></head>
          <body>
            <h1>Created item: {{ name }}</h1>
            <p><a href="{{ url_for('index') }}">Back</a></p>
          </body>
        </html>
        """,
        name=name,
    )


@app.route("/items", methods=["PUT"])
def update_item():
    name = request.form.get("name", "").strip()
    return {"status": "updated", "name": name}


@app.route("/items", methods=["DELETE"])
def delete_item():
    return {"status": "deleted"}


@app.route("/items/update", methods=["POST"])
def update_item_form():
    if request.form.get("_method") != "PUT":
        abort(400, description="Invalid method override")

    name = request.form.get("name", "").strip()
    return render_template_string(
        """
        <!doctype html>
        <html>
          <head><title>Updated</title></head>
          <body>
            <h1>Updated item: {{ name }}</h1>
            <p><a href="{{ url_for('index') }}">Back</a></p>
          </body>
        </html>
        """,
        name=name,
    )


@app.route("/items/delete", methods=["POST"])
def delete_item_form():
    if request.form.get("_method") != "DELETE":
        abort(400, description="Invalid method override")

    return render_template_string(
        """
        <!doctype html>
        <html>
          <head><title>Deleted</title></head>
          <body>
            <h1>Deleted item</h1>
            <p><a href="{{ url_for('index') }}">Back</a></p>
          </body>
        </html>
        """
    )


if __name__ == "__main__":
    app.run(debug=False)