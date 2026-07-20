from flask import Flask, session, request, render_template_string, abort, redirect, url_for, make_response
from functools import wraps
import secrets

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

CSRF_SESSION_KEY = "_csrf_token"


def generate_csrf_token():
    token = session.get(CSRF_SESSION_KEY)
    if not token:
        token = secrets.token_hex(32)
        session[CSRF_SESSION_KEY] = token
    return token


def validate_csrf_token():
    if request.method in ("POST", "PUT", "DELETE", "PATCH"):
        session_token = session.get(CSRF_SESSION_KEY)
        request_token = (
            request.form.get("csrf_token")
            or request.headers.get("X-CSRF-Token")
            or request.args.get("csrf_token")
        )
        if not session_token or not request_token or not secrets.compare_digest(session_token, request_token):
            abort(403, description="CSRF token missing or invalid")


@app.before_request
def csrf_protect():
    validate_csrf_token()


@app.context_processor
def inject_csrf_token():
    return {"csrf_token": generate_csrf_token()}


def csrf_hidden_field():
    return f'<input type="hidden" name="csrf_token" value="{generate_csrf_token()}">'


app.jinja_env.globals["csrf_hidden_field"] = csrf_hidden_field
app.jinja_env.globals["csrf_token"] = generate_csrf_token


@app.route("/", methods=["GET"])
def index():
    return render_template_string(
        """
        <h1>CSRF Protection Demo</h1>
        <form method="post" action="{{ url_for('submit') }}">
            {{ csrf_hidden_field() | safe }}
            <input type="text" name="data" placeholder="Enter data">
            <button type="submit">Submit</button>
        </form>
        """
    )


@app.route("/submit", methods=["POST"])
def submit():
    data = request.form.get("data", "")
    return f"Submitted successfully: {data}"


@app.route("/update", methods=["PUT"])
def update():
    return {"status": "ok", "message": "PUT request accepted"}


@app.route("/delete", methods=["DELETE"])
def delete():
    return {"status": "ok", "message": "DELETE request accepted"}


@app.errorhandler(403)
def forbidden(error):
    return make_response({"error": str(error.description or "Forbidden")}, 403)


if __name__ == "__main__":
    app.run(debug=True)