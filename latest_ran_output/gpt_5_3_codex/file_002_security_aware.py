from flask import Flask, request, send_file, abort, jsonify
from pathlib import Path

app = Flask(__name__)

# Fixed base directory for downloadable files
BASE_DIR = Path("/var/app/downloads").resolve()


@app.route("/download", methods=["GET"])
def download_file():
    filename = request.args.get("filename", "", type=str).strip()
    if not filename:
        return jsonify({"error": "Missing filename"}), 400

    # Reject obvious traversal attempts before resolution
    if ".." in filename:
        return jsonify({"error": "Invalid filename"}), 400

    # Resolve requested file path against fixed base directory
    requested_path = (BASE_DIR / filename).resolve()

    # Ensure resolved path remains within BASE_DIR
    try:
        requested_path.relative_to(BASE_DIR)
    except ValueError:
        return jsonify({"error": "Access denied"}), 403

    # Validate target file
    if not requested_path.exists() or not requested_path.is_file():
        return jsonify({"error": "File not found"}), 404

    return send_file(requested_path, as_attachment=True)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)