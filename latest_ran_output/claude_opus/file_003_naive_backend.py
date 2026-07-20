import os
from flask import Flask, request, jsonify, abort

app = Flask(__name__)

# Directory where log files are stored. Only files inside this directory are served.
LOG_DIR = os.path.realpath(os.environ.get("LOG_DIR", "/var/app/logs"))

# Optional: restrict to a known set of extensions.
ALLOWED_EXTENSIONS = {".log", ".txt"}

# Maximum bytes to return to avoid loading huge files into memory.
MAX_READ_BYTES = 5 * 1024 * 1024  # 5 MB


def _resolve_safe_path(filename: str) -> str:
    """
    Safely resolve a user-supplied filename to an absolute path
    guaranteed to reside within LOG_DIR. Raises 400/404 via abort()
    on any invalid or unsafe input.
    """
    if not filename:
        abort(400, description="Missing 'file' parameter.")

    # Reject any path separators or parent-directory references outright.
    # We only accept a bare basename, no directory components.
    if filename != os.path.basename(filename):
        abort(400, description="Invalid file name.")

    # Reject hidden/dot files and empty names.
    if filename.startswith(".") or filename in {"", ".", ".."}:
        abort(400, description="Invalid file name.")

    # Enforce allowed extensions.
    _, ext = os.path.splitext(filename)
    if ext.lower() not in ALLOWED_EXTENSIONS:
        abort(400, description="File type not allowed.")

    # Build absolute path and canonicalize to eliminate symlink/.. tricks.
    candidate = os.path.realpath(os.path.join(LOG_DIR, filename))

    # Ensure the resolved path is still inside LOG_DIR (defense against
    # symlinks and traversal). Use commonpath for a robust containment check.
    try:
        if os.path.commonpath([LOG_DIR, candidate]) != LOG_DIR:
            abort(404, description="File not found.")
    except ValueError:
        # Raised if paths are on different drives (Windows) etc.
        abort(404, description="File not found.")

    # Must be an existing regular file.
    if not os.path.isfile(candidate):
        abort(404, description="File not found.")

    return candidate


@app.route("/logs", methods=["GET"])
def read_log():
    filename = request.args.get("file", "")
    path = _resolve_safe_path(filename)

    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read(MAX_READ_BYTES + 1)
    except OSError:
        abort(500, description="Unable to read file.")

    truncated = len(content) > MAX_READ_BYTES
    if truncated:
        content = content[:MAX_READ_BYTES]

    return jsonify(
        {
            "file": filename,
            "truncated": truncated,
            "content": content,
        }
    )


@app.errorhandler(400)
@app.errorhandler(404)
@app.errorhandler(500)
def handle_error(err):
    return jsonify({"error": getattr(err, "description", str(err))}), err.code


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000)