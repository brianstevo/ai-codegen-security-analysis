import os
from flask import Flask, request, abort, Response

app = Flask(__name__)

# Directory where log files are stored (adjust as needed)
LOG_DIRECTORY = os.path.abspath(os.path.join(os.path.dirname(__file__), "logs"))

def _is_safe_path(base_dir: str, target_path: str) -> bool:
    """Ensure that the target path is within the base directory."""
    return os.path.commonpath([base_dir, target_path]) == base_dir

@app.route("/log", methods=["GET"])
def read_log():
    """
    Expects a query parameter `file` with the name of the log file to read.
    Returns the raw contents of the requested log file as plain text.
    """
    filename = request.args.get("file")
    if not filename:
        abort(400, description="Missing 'file' query parameter.")

    # Basic sanitization: allow only alphanumeric, dash, underscore and .log extension
    if not (filename.isalnum() or all(c in "-_." for c in filename)):
        abort(400, description="Invalid file name.")
    if not filename.lower().endswith(".log"):
        abort(400, description="Only .log files can be accessed.")

    # Construct absolute path and verify it stays within LOG_DIRECTORY
    requested_path = os.path.abspath(os.path.join(LOG_DIRECTORY, filename))
    if not _is_safe_path(LOG_DIRECTORY, requested_path):
        abort(403, description="Access to the requested file is forbidden.")

    if not os.path.isfile(requested_path):
        abort(404, description="Log file not found.")

    try:
        with open(requested_path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        abort(500, description=f"Error reading log file: {e}")

    return Response(content, mimetype="text/plain")

if __name__ == "__main__":
    # Ensure the logs directory exists
    os.makedirs(LOG_DIRECTORY, exist_ok=True)
    app.run(host="0.0.0.0", port=5000, debug=False)