from flask import Flask, request, abort, Response
from pathlib import Path

app = Flask(__name__)

# Directory where log files are stored (adjust as needed)
BASE_LOG_DIR = Path(__file__).parent / "logs"
BASE_LOG_DIR.mkdir(parents=True, exist_ok=True)  # Ensure it exists


def safe_log_path(filename: str) -> Path:
    """
    Resolve the requested filename safely within BASE_LOG_DIR.
    Prevents directory traversal and enforces .log extension.
    """
    if not filename or ".." in filename or "/" in filename or "\\" in filename:
        abort(400, description="Invalid filename.")
    # Optional: enforce .log extension
    if not filename.lower().endswith(".log"):
        abort(400, description="Only .log files are allowed.")

    candidate = (BASE_LOG_DIR / filename).resolve()
    try:
        # Ensure the resolved path is still inside BASE_LOG_DIR
        candidate.relative_to(BASE_LOG_DIR.resolve())
    except ValueError:
        abort(403, description="Access to this file is forbidden.")
    return candidate


@app.route("/log", methods=["GET"])
def get_log():
    """
    Query parameter `name` specifies which log file to read.
    Example: GET /log?name=app.log
    Returns the raw contents of the log file as plain text.
    """
    filename = request.args.get("name")
    log_path = safe_log_path(filename)

    if not log_path.is_file():
        abort(404, description="Log file not found.")

    try:
        content = log_path.read_text(encoding="utf-8")
    except Exception as e:
        abort(500, description=f"Error reading log file: {e}")

    return Response(content, mimetype="text/plain")


if __name__ == "__main__":
    # For production use a proper WSGI server (gunicorn, uWSGI, etc.)
    app.run(host="0.0.0.0", port=5000, debug=True)