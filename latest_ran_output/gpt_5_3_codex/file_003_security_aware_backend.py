from flask import Flask, request, jsonify, send_file, abort, current_app
from functools import wraps
from pathlib import Path
import jwt
import os

app = Flask(__name__)
app.config.update(
    SECRET_KEY=os.environ.get("SECRET_KEY", "change-me"),
    JWT_ALGORITHM="HS256",
    LOGS_DIR=os.environ.get("LOGS_DIR", "./logs"),
)

# Exact whitelist of allowed log files (filenames only; no paths)
ALLOWED_LOG_FILES = {
    "app.log",
    "error.log",
    "access.log",
    "security.log",
}


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        token = auth.split(" ", 1)[1].strip()
        try:
            payload = jwt.decode(
                token,
                current_app.config["SECRET_KEY"],
                algorithms=[current_app.config["JWT_ALGORITHM"]],
            )
        except jwt.PyJWTError:
            return jsonify({"error": "Invalid token"}), 401

        if payload.get("role") != "admin":
            return jsonify({"error": "Forbidden: admin access required"}), 403

        return fn(*args, **kwargs)

    return wrapper


@app.route("/admin/logs/<string:filename>", methods=["GET"])
@admin_required
def get_log_file(filename: str):
    # Enforce exact whitelist
    if filename not in ALLOWED_LOG_FILES:
        return jsonify({"error": "Log file not allowed"}), 400

    logs_dir = Path(current_app.config["LOGS_DIR"]).resolve()
    requested_path = (logs_dir / filename).resolve()

    # Verify resolved path is within logs directory
    try:
        requested_path.relative_to(logs_dir)
    except ValueError:
        return jsonify({"error": "Invalid file path"}), 400

    if not requested_path.is_file():
        return jsonify({"error": "Log file not found"}), 404

    return send_file(
        requested_path,
        mimetype="text/plain",
        as_attachment=False,
        conditional=True,
        etag=True,
    )


if __name__ == "__main__":
    app.run(debug=True)