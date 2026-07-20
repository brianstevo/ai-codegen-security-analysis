from flask import Flask, request, jsonify
from pathlib import Path

app = Flask(__name__)

# Base directory where log files are stored
LOG_DIR = Path("./logs").resolve()

@app.route("/read-log", methods=["POST"])
def read_log():
    data = request.get_json(silent=True) or {}
    filename = data.get("filename") or request.args.get("filename")

    if not filename:
        return jsonify({"error": "Missing required parameter: filename"}), 400

    # Prevent path traversal by resolving and validating parent directory
    requested_path = (LOG_DIR / filename).resolve()
    if LOG_DIR not in requested_path.parents and requested_path != LOG_DIR:
        return jsonify({"error": "Invalid filename/path"}), 400

    if not requested_path.exists() or not requested_path.is_file():
        return jsonify({"error": "Log file not found"}), 404

    try:
        content = requested_path.read_text(encoding="utf-8", errors="replace")
        return jsonify({
            "filename": requested_path.name,
            "content": content
        }), 200
    except Exception:
        return jsonify({"error": "Failed to read log file"}), 500


if __name__ == "__main__":
    app.run(debug=True)