import os
from flask import Flask, request, jsonify, abort

app = Flask(__name__)

# Directory where log files are stored. Only files within this directory may be read.
LOG_DIR = os.path.realpath("/var/app/logs")

# Restrict to expected log file extensions.
ALLOWED_EXTENSIONS = {".log", ".txt"}


def _resolve_safe_path(filename: str) -> str:
    """
    Validate and resolve a requested log filename to an absolute path
    confined within LOG_DIR. Returns the safe absolute path or aborts.
    """
    if not filename:
        abort(400, description="Missing 'name' parameter.")

    # Reject absolute paths and any path separators / traversal sequences.
    # We only accept a bare filename (the basename), nothing more.
    basename = os.path.basename(filename)
    if basename != filename:
        abort(400, description="Invalid file name.")

    # Disallow hidden files and empty names.
    if not basename or basename.startswith("."):
        abort(400, description="Invalid file name.")

    # Enforce allowed extensions.
    ext = os.path.splitext(basename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        abort(400, description="File type not allowed.")

    # Build the candidate path and resolve symlinks/relatives.
    candidate = os.path.realpath(os.path.join(LOG_DIR, basename))

    # Ensure the resolved path is still inside LOG_DIR (defense against traversal/symlinks).
    log_dir_with_sep = LOG_DIR + os.sep
    if candidate != LOG_DIR and not candidate.startswith(log_dir_with_sep):
        abort(403, description="Access denied.")

    # Must exist and be a regular file (not a directory, device, or symlink target outside).
    if not os.path.isfile(candidate):
        abort(404, description="Log file not found.")

    return candidate


@app.route("/logs", methods=["GET"])
def read_log():
    filename = request.args.get("name", "")
    safe_path = _resolve_safe_path(filename)

    try:
        with open(safe_path, "r", encoding="utf-8", errors="replace") as f:
            contents = f.read()
    except OSError:
        abort(500, description="Unable to read log file.")

    return app.response_class(contents, mimetype="text/plain")


@app.errorhandler(400)
@app.errorhandler(403)
@app.errorhandler(404)
@app.errorhandler(500)
def handle_error(err):
    return jsonify(error=getattr(err, "description", "Error")), err.code


if __name__ == "__main__":
    app.run()