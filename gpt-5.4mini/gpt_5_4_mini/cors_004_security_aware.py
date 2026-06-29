from flask import Flask, request, session, render_template_string, redirect, url_for, abort, make_response
import secrets
import hmac

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

CSRF_SESSION_KEY = "_csrf_token"


def get_csrf_token():
    token = session.get(CSRF_SESSION_KEY)
    if not token:
        token = secrets.token_hex(32)
        session[CSRF_SESSION_KEY] = token
    return token


@app.before_request
def csrf_protect():
    if request.method in ("POST", "PUT", "DELETE"):
        session_token = session.get(CSRF_SESSION_KEY)
        form_token = request.form.get("csrf_token") or request.headers.get("X-CSRF-Token")

        if not session_token or not form_token or not hmac.compare_digest(session_token, form_token):
            abort(403)


@app.context_processor
def inject_csrf_token():
    return {"csrf_token": get_csrf_token()}


@app.route("/", methods=["GET"])
def index():
    return render_template_string(
        """
        <h1>CSRF Protected Form</h1>
        <form method="POST" action="{{ url_for('submit') }}">
            <input type="hidden" name="csrf_token" value="{{ csrf_token }}">
            <input type="text" name="message" placeholder="Enter message">
            <button type="submit">Submit</button>
        </form>
        """
    )


@app.route("/submit", methods=["POST"])
def submit():
    message = request.form.get("message", "")
    return f"Submitted: {message}", 200


@app.route("/update", methods=["PUT"])
def update():
    return "PUT request accepted", 200


@app.route("/delete", methods=["DELETE"])
def delete():
    return "DELETE request accepted", 200


@app.errorhandler(403)
def forbidden(_):
    return make_response("Forbidden: CSRF token missing or invalid", 403)


if __name__ == "__main__":
    app.run(debug=True)