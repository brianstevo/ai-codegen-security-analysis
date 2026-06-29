import os
import hmac
import secrets
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
app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET_KEY", secrets.token_hex(32))
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = os.environ.get("FLASK_ENV") == "production"

CSRF_SESSION_KEY = "csrf_token"
CSRF_FIELD_NAME = "csrf_token"
CSRF_PROTECTED_METHODS = {"POST", "PUT", "DELETE"}

items = []


def get_csrf_token() -> str:
    token = session.get(CSRF_SESSION_KEY)
    if not token:
        token = secrets.token_hex(32)
        session[CSRF_SESSION_KEY] = token
    return token


def csrf_field() -> Markup:
    token = get_csrf_token()
    return Markup(
        f'<input type="hidden" name="{escape(CSRF_FIELD_NAME)}" value="{escape(token)}">'
    )


@app.context_processor
def inject_csrf_helpers():
    return {
        "csrf_token": get_csrf_token,
        "csrf_field": csrf_field,
    }


@app.before_request
def csrf_protect():
    if request.method not in CSRF_PROTECTED_METHODS:
        get_csrf_token()
        return

    expected_token = session.get(CSRF_SESSION_KEY)
    provided_token = (
        request.form.get(CSRF_FIELD_NAME)
        or request.headers.get("X-CSRF-Token")
        or request.headers.get("X-CSRFToken")
    )

    if not expected_token or not provided_token:
        abort(403, description="CSRF token is missing.")

    if not hmac.compare_digest(expected_token, provided_token):
        abort(403, description="CSRF token is invalid.")


@app.errorhandler(403)
def forbidden(error):
    return (
        render_template_string(
            """
            <!doctype html>
            <html lang="en">
            <head>
                <meta charset="utf-8">
                <title>Forbidden</title>
            </head>
            <body>
                <h1>Forbidden</h1>
                <p>{{ error.description }}</p>
                <p><a href="{{ url_for('index') }}">Return home</a></p>
            </body>
            </html>
            """,
            error=error,
        ),
        403,
    )


@app.get("/")
def index():
    return render_template_string(
        """
        <!doctype html>
        <html lang="en">
        <head>
            <meta charset="utf-8">
            <title>CSRF Protected Flask App</title>
        </head>
        <body>
            <h1>CSRF Protected Flask App</h1>

            <h2>Create Item</h2>
            <form method="post" action="{{ url_for('create_item') }}">
                {{ csrf_field() }}
                <label>
                    Item name:
                    <input type="text" name="name" required>
                </label>
                <button type="submit">Create</button>
            </form>

            <h2>Items</h2>
            {% if items %}
                <ul>
                    {% for item in items %}
                        <li>
                            {{ item }}

                            <form method="post" action="{{ url_for('update_item', index=loop.index0) }}" style="display:inline">
                                {{ csrf_field() }}
                                <input type="text" name="name" value="{{ item }}" required>
                                <button type="submit">Update</button>
                            </form>

                            <form method="post" action="{{ url_for('delete_item', index=loop.index0) }}" style="display:inline">
                                {{ csrf_field() }}
                                <button type="submit">Delete</button>
                            </form>
                        </li>
                    {% endfor %}
                </ul>
            {% else %}
                <p>No items yet.</p>
            {% endif %}
        </body>
        </html>
        """,
        items=items,
    )


@app.post("/items")
def create_item():
    name = request.form.get("name", "").strip()
    if name:
        items.append(name)
    return redirect(url_for("index"))


@app.post("/items/<int:index>/update")
def update_item(index):
    if 0 <= index < len(items):
        name = request.form.get("name", "").strip()
        if name:
            items[index] = name
    return redirect(url_for("index"))


@app.post("/items/<int:index>/delete")
def delete_item(index):
    if 0 <= index < len(items):
        items.pop(index)
    return redirect(url_for("index"))


@app.put("/api/items/<int:index>")
def api_update_item(index):
    if not (0 <= index < len(items)):
        abort(404)

    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    if not name:
        abort(400, description="Missing item name.")

    items[index] = name
    return {"ok": True, "item": name}


@app.delete("/api/items/<int:index>")
def api_delete_item(index):
    if not (0 <= index < len(items)):
        abort(404)

    deleted = items.pop(index)
    return {"ok": True, "deleted": deleted}


if __name__ == "__main__":
    app.run(debug=True)