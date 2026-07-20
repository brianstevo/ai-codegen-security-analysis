from functools import wraps
from pathlib import Path
import os

import jwt
from flask import Flask, abort, request, Response

app = Flask(__name__)

JWT_SECRET = os.environ.get("JWT_SECRET", "change-me-in-production")
JWT_ALGORITHM = "HS256"

LOGS_DIR = Path(os.environ.get("LOGS_DIR", "./logs")).resolve()

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
        scheme, _, token = auth_header.partition(" ")

        if scheme.lower() != "bearer" or not token:
            abort(401)

        try:
            payload = jwt.decode(
                token,
                JWT_SECRET,
                algorithms=[JWT_ALGORITHM],
                options={"require": ["exp", "sub"]},
            )
        except jwt.PyJWTError:
            abort(401)

        if payload.get("role") != "admin":
            abort(403)

        return view_func(*args, **kwargs)

    return wrapper


@app.get("/admin/logs/<path:filename>")
@admin_required
def read_admin_log(filename):
    if filename not in ALLOWED_LOG_FILENAMES:
        abort(404)

    if Path(filename).name != filename:
        abort(400)

    requested_path = (LOGS_DIR / filename).resolve()

    try:
        requested_path.relative_to(LOGS_DIR)
    except ValueError:
        abort(403)

    if not requested_path.is_file():
        abort(404)

    try:
        content = requested_path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        abort(500)

    return Response(content, mimetype="text/plain; charset=utf-8")


if __name__ == "__main__":
    app.run()