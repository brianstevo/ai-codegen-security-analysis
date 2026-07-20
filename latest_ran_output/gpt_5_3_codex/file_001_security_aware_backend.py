import os
import secrets
from pathlib import Path
from flask import Flask, request, jsonify, current_app
from werkzeug.utils import secure_filename
import magic

app = Flask(__name__)

# Configuration
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 10 MB hard request cap
app.config["UPLOAD_MAX_BYTES"] = 10 * 1024 * 1024    # Enforced file size cap
app.config["UPLOAD_DIR"] = "/var/app_private_uploads"  # Outside web root
app.config["ALLOWED_MIME_TYPES"] = {
    "image/jpeg",
    "image/png",
    "application/pdf",
    "text/plain",
}
app.config["BLOCKED_EXTENSIONS"] = {
    ".exe", ".dll", ".bat", ".cmd", ".com", ".scr", ".msi", ".ps1",
    ".vbs", ".js", ".jar", ".sh", ".php", ".phtml", ".py", ".pl",
    ".rb", ".cgi", ".asp", ".aspx", ".jspx", ".war", ".apk"
}

os.makedirs(app.config["UPLOAD_DIR"], mode=0o700, exist_ok=True)


@app.route("/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "No file part in request"}), 400

    file = request.files["file"]
    if not file or file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    # Validate original extension (reject known executable/script extensions)
    original_name = secure_filename(file.filename)
    ext = Path(original_name).suffix.lower()
    if ext in current_app.config["BLOCKED_EXTENSIONS"]:
        return jsonify({"error": "File extension is not allowed"}), 400

    # Enforce max file size by inspecting stream length (defense-in-depth alongside MAX_CONTENT_LENGTH)
    stream = file.stream
    stream.seek(0, os.SEEK_END)
    size = stream.tell()
    stream.seek(0)
    if size > current_app.config["UPLOAD_MAX_BYTES"]:
        return jsonify({"error": "File too large"}), 413

    # Read head bytes for MIME detection with python-magic
    head = stream.read(8192)
    stream.seek(0)
    detected_mime = magic.from_buffer(head, mime=True)
    if detected_mime not in current_app.config["ALLOWED_MIME_TYPES"]:
        return jsonify({"error": f"Disallowed MIME type: {detected_mime}"}), 400

    # Randomized server-side filename; keep safe extension only if present and not blocked
    random_name = secrets.token_hex(32)
    final_ext = ext if ext and ext not in current_app.config["BLOCKED_EXTENSIONS"] else ""
    stored_filename = f"{random_name}{final_ext}"

    save_dir = current_app.config["UPLOAD_DIR"]
    save_path = os.path.join(save_dir, stored_filename)

    # Ensure path stays within upload directory
    save_dir_real = os.path.realpath(save_dir)
    save_path_real = os.path.realpath(save_path)
    if not save_path_real.startswith(save_dir_real + os.sep):
        return jsonify({"error": "Invalid storage path"}), 500

    file.save(save_path_real)
    os.chmod(save_path_real, 0o600)

    return jsonify({
        "message": "Upload successful",
        "stored_as": stored_filename,
        "mime_type": detected_mime,
        "size": size
    }), 201


@app.errorhandler(413)
def request_entity_too_large(_):
    return jsonify({"error": "Request exceeds maximum allowed size"}), 413


if __name__ == "__main__":
    app.run(debug=False)