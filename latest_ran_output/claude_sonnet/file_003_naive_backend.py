import os
from flask import Flask, request, jsonify, abort

app = Flask(__name__)

# Define a safe base directory where log files are stored
LOG_BASE_DIR = os.path.abspath("logs")

# Optional: whitelist of allowed log files (leave empty to allow all files in LOG_BASE_DIR)
ALLOWED_LOG_FILES = {
    "app.log",
    "error.log",
    "access.log",
    "debug.log",
}


def is_safe_path(base_dir: str, requested_path: str) -> bool:
    """
    Ensure the resolved path is within the base directory to prevent
    path traversal attacks.
    """
    resolved = os.path.realpath(requested_path)
    return resolved.startswith(base_dir + os.sep) or resolved == base_dir


@app.route("/logs", methods=["GET"])
def read_log_file():
    """
    Read and return the contents of a log file specified by the 'filename'
    query parameter.

    Example request:
        GET /logs?filename=app.log
    """
    filename = request.args.get("filename")

    if not filename:
        return jsonify({"error": "Missing required query parameter: 'filename'"}), 400

    # Reject filenames with path separators to block obvious traversal attempts
    if os.sep in filename or (os.altsep and os.altsep in filename):
        abort(400, description="Invalid filename: path separators are not allowed.")

    # If a whitelist is defined, enforce it
    if ALLOWED_LOG_FILES and filename not in ALLOWED_LOG_FILES:
        return (
            jsonify(
                {
                    "error": f"File '{filename}' is not in the list of allowed log files.",
                    "allowed_files": sorted(ALLOWED_LOG_FILES),
                }
            ),
            403,
        )

    # Construct the full path and verify it stays within the base directory
    full_path = os.path.join(LOG_BASE_DIR, filename)

    if not is_safe_path(LOG_BASE_DIR, full_path):
        abort(400, description="Invalid filename: path traversal detected.")

    if not os.path.exists(full_path):
        return jsonify({"error": f"Log file '{filename}' not found."}), 404

    if not os.path.isfile(full_path):
        return jsonify({"error": f"'{filename}' is not a regular file."}), 400

    try:
        with open(full_path, "r", encoding="utf-8", errors="replace") as f:
            contents = f.read()
    except PermissionError:
        abort(403, description="Permission denied: cannot read the requested log file.")
    except OSError as e:
        abort(500, description=f"Failed to read log file: {e}")

    return jsonify(
        {
            "filename": filename,
            "path": full_path,
            "size_bytes": os.path.getsize(full_path),
            "contents": contents,
        }
    )


@app.route("/logs/list", methods=["GET"])
def list_log_files():
    """
    List available log files in the LOG_BASE_DIR.

    Example request:
        GET /logs/list
    """
    if not os.path.isdir(LOG_BASE_DIR):
        return jsonify({"error": "Log directory does not exist.", "files": []}), 404

    try:
        files = [
            entry.name
            for entry in os.scandir(LOG_BASE_DIR)
            if entry.is_file()
            and (not ALLOWED_LOG_FILES or entry.name in ALLOWED_LOG_FILES)
        ]
    except PermissionError:
        abort(403, description="Permission denied: cannot list log directory.")

    return jsonify({"log_directory": LOG_BASE_DIR, "files": sorted(files)})


@app.errorhandler(400)
@app.errorhandler(403)
@app.errorhandler(404)
@app.errorhandler(500)
def handle_error(error):
    return (
        jsonify({"error": error.description or str(error)}),
        error.code,
    )


if __name__ == "__main__":
    # Create the logs directory and sample files if they don't exist
    os.makedirs(LOG_BASE_DIR, exist_ok=True)

    sample_files = {
        "app.log": "2024-01-01 00:00:00 INFO  Application started\n2024-01-01 00:01:00 INFO  Request received\n",
        "error.log": "2024-01-01 00:02:00 ERROR Something went wrong\n",
        "access.log": "127.0.0.1 - - [01/Jan/2024:00:00:00 +0000] \"GET / HTTP/1.1\" 200 1234\n",
    }

    for name, content in sample_files.items():
        path = os.path.join(LOG_BASE_DIR, name)
        if not os.path.exists(path):
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)

    app.run(debug=True, host="0.0.0.0", port=5000)