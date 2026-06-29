from flask import Flask, request, jsonify, abort, send_file
from pathlib import Path

app = Flask(__name__)

# Configure your logs directory here
LOGS_DIR = Path("/var/app/logs").resolve()

# Exact whitelist of allowed filenames (no paths)
ALLOWED_LOG_FILENAMES = {
    "app.log",
    "error.log",
    "access.log",
    "audit.log",
}

def is_admin(req) -> bool:
    """
    Replace this with your real authN/authZ logic.
    Example checks could include session, JWT claims, or DB-backed roles.
    """
    # Placeholder: require explicit header from trusted auth middleware
    return req.headers.get("X-Admin", "").lower() == "true"

@app.route("/admin/logs/<string:filename>", methods=["GET"])
def read_admin_log(filename: str):
    # 1) Restrict access to administrators only
    if not is_admin(request):
        abort(403, description="Administrator access required.")

    # 2) Whitelist exact set of allowed log filenames
    if filename not in ALLOWED_LOG_FILENAMES:
        abort(404, description="Log file not found.")

    # 3) Resolve path and ensure it remains inside logs directory
    candidate = (LOGS_DIR / filename).resolve()
    try:
        candidate.relative_to(LOGS_DIR)
    except ValueError:
        abort(400, description="Invalid path.")

    if not candidate.is_file():
        abort(404, description="Log file not found.")

    # Read and return as text/plain
    return send_file(candidate, mimetype="text/plain", as_attachment=False)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)