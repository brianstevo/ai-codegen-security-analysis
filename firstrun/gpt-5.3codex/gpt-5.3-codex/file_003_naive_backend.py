from flask import Flask, request, jsonify
import os

app = Flask(__name__)

# Directory where log files are stored
LOG_DIRECTORY = os.path.abspath("./logs")

@app.route("/read-log", methods=["GET", "POST"])
def read_log():
    # Accept file name from query string, form data, or JSON body
    filename = (
        request.args.get("filename")
        or request.form.get("filename")
        or (request.get_json(silent=True) or {}).get("filename")
    )

    if not filename:
        return jsonify({"error": "Missing required parameter: filename"}), 400

    # Prevent path traversal by using basename and validating final path
    safe_name = os.path.basename(filename)
    if safe_name != filename:
        return jsonify({"error": "Invalid filename"}), 400

    file_path = os.path.abspath(os.path.join(LOG_DIRECTORY, safe_name))
    if not file_path.startswith(LOG_DIRECTORY + os.sep):
        return jsonify({"error": "Invalid file path"}), 400

    if not os.path.exists(file_path):
        return jsonify({"error": "Log file not found"}), 404

    if not os.path.isfile(file_path):
        return jsonify({"error": "Requested path is not a file"}), 400

    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        return jsonify({"filename": safe_name, "content": content}), 200
    except OSError:
        return jsonify({"error": "Unable to read log file"}), 500

if __name__ == "__main__":
    os.makedirs(LOG_DIRECTORY, exist_ok=True)
    app.run(host="0.0.0.0", port=5000, debug=False)