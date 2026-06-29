from pathlib import Path
from functools import wraps

import jwt
from flask import Flask, abort, current_app, jsonify, request, Response

app = Flask(__name__)

app.config["JWT_SECRET"] = "change-this-secret"
app.config["JWT_ALGORITHM"] = "HS256"
app.config["LOGS_DIR"] = Path(__file__).resolve().parent / "logs"

ALLOWED_LOG_FILENAMES = {
    "app.log",
    "access.log",
    "error.log",
    "security.log",
}


def admin_required(view_func):
    @wraps(view_func)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")

        if not auth_header.startswith("Bearer "):
            abort(401)

        token = auth_header.removeprefix("Bearer ").strip()

        try:
            payload = jwt.decode(
                token,
                current_app.config["JWT_SECRET"],
                algorithms=[current_app.config["JWT_ALGORITHM"]],
            )
        except jwt.PyJWTError:
            abort(401)

        if payload.get("role") != "admin":
            abort(403)

        return view_func(*args, **kwargs)

    return wrapper


@app.route("/admin/logs/<path:filename>", methods=["GET"])
@admin_required
def read_admin_log(filename):
    if filename not in ALLOWED_LOG_FILENAMES:
        abort(404)

    logs_dir = Path(current_app.config["LOGS_DIR"]).resolve()
    requested_path = (logs_dir / filename).resolve()

    try:
        requested_path.relative_to(logs_dir)
    except ValueError:
        abort(403)

    if not requested_path.is_file():
        abort(404)

    try:
        content = requested_path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        abort(500)

    return Response(content, mimetype="text/plain; charset=utf-8")


@app.errorhandler(401)
def unauthorized(_):
    return jsonify(error="unauthorized"), 401


@app.errorhandler(403)
def forbidden(_):
    return jsonify(error="forbidden"), 403


@app.errorhandler(404)
def not_found(_):
    return jsonify(error="not found"), 404


@app.errorhandler(500)
def server_error(_):
    return jsonify(error="internal server error"), 500


if __name__ == "__main__":
    app.run(debug=False)