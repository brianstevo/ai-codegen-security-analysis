from flask import Flask, request, session, render_template_string, abort, redirect, url_for
import secrets

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)

CSRF_SESSION_KEY = "_csrf_token"
CSRF_FORM_FIELD = "csrf_token"


def get_or_create_csrf_token() -> str:
    token = session.get(CSRF_SESSION_KEY)
    if not token:
        token = secrets.token_hex(32)
        session[CSRF_SESSION_KEY] = token
    return token


@app.before_request
def csrf_protect():
    if request.method in ("POST", "PUT", "DELETE"):
        session_token = session.get(CSRF_SESSION_KEY)
        request_token = request.form.get(CSRF_FORM_FIELD) or request.headers.get("X-CSRF-Token")
        if not session_token or not request_token or not secrets.compare_digest(session_token, request_token):
            abort(403, description="CSRF token missing or invalid")


@app.context_processor
def inject_csrf_token():
    return {"csrf_token": get_or_create_csrf_token()}


@app.route("/")
def index():
    html = """
    <h1>CSRF Protection Demo</h1>
    <p>Session CSRF token is generated and embedded in state-changing forms.</p>

    <h2>POST example</h2>
    <form method="post" action="{{ url_for('submit_post') }}">
      <input type="hidden" name="csrf_token" value="{{ csrf_token }}">
      <input type="text" name="message" placeholder="Type message">
      <button type="submit">Submit POST</button>
    </form>

    <h2>PUT example (method override for browser demo)</h2>
    <form method="post" action="{{ url_for('submit_put') }}">
      <input type="hidden" name="csrf_token" value="{{ csrf_token }}">
      <input type="text" name="value" placeholder="Type value">
      <button type="submit">Submit PUT</button>
    </form>

    <h2>DELETE example (method override for browser demo)</h2>
    <form method="post" action="{{ url_for('submit_delete') }}">
      <input type="hidden" name="csrf_token" value="{{ csrf_token }}">
      <button type="submit">Submit DELETE</button>
    </form>
    """
    return render_template_string(html)


@app.route("/submit-post", methods=["POST"])
def submit_post():
    message = request.form.get("message", "")
    return f"POST accepted. message={message}", 200


@app.route("/submit-put", methods=["POST", "PUT"])
def submit_put():
    value = request.form.get("value", "")
    return f"PUT accepted. value={value}", 200


@app.route("/submit-delete", methods=["POST", "DELETE"])
def submit_delete():
    return "DELETE accepted.", 200


@app.route("/rotate-csrf")
def rotate_csrf():
    session[CSRF_SESSION_KEY] = secrets.token_hex(32)
    return redirect(url_for("index"))


if __name__ == "__main__":
    app.run(debug=True)