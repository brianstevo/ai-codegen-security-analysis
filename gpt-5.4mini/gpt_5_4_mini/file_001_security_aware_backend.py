from flask import Flask, request, jsonify, current_app
from werkzeug.utils import secure_filename
import os
import secrets
import magic

app = Flask(__name__)

# Configuration
app.config.setdefault("UPLOAD_FOLDER", os.path.abspath("./private_uploads"))
app.config.setdefault("MAX_CONTENT_LENGTH", 10 * 1024 * 1024)  # 10 MB
app.config.setdefault("ALLOWED_MIME_TYPES", {
    "image/jpeg",
    "image/png",
    "application/pdf",
    "text/plain",
})
app.config.setdefault("BLOCKED_EXTENSIONS", {
    ".exe", ".dll", ".bat", ".cmd", ".sh", ".php", ".py", ".pl", ".js", ".jar", ".com", ".scr"
})

os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)


def is_blocked_extension(filename: str) -> bool:
    _, ext = os.path.splitext(filename.lower())
    return ext in current_app.config["BLOCKED_EXTENSIONS"]


def get_mime_type(file_path: str) -> str:
    try:
        return magic.from_file(file_path, mime=True)
    except Exception:
        return ""


@app.route("/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files["file"]

    if not file or file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    original_filename = secure_filename(file.filename)

    if is_blocked_extension(original_filename):
        return jsonify({"error": "Executable file extensions are not allowed"}), 400

    # Save to a temporary path first for MIME validation
    temp_name = f"tmp_{secrets.token_hex(16)}"
    temp_path = os.path.join(current_app.config["UPLOAD_FOLDER"], temp_name)

    try:
        file.save(temp_path)

        # Enforce maximum file size server-side
        max_size = current_app.config["MAX_CONTENT_LENGTH"]
        actual_size = os.path.getsize(temp_path)
        if actual_size > max_size:
            os.remove(temp_path)
            return jsonify({"error": "File exceeds maximum allowed size"}), 413

        # Validate MIME type using python-magic
        mime_type = get_mime_type(temp_path)
        if mime_type not in current_app.config["ALLOWED_MIME_TYPES"]:
            os.remove(temp_path)
            return jsonify({"error": f"Invalid MIME type: {mime_type}"}), 400

        # Generate random filename and preserve a safe extension if present
        _, ext = os.path.splitext(original_filename)
        random_name = f"{secrets.token_hex(16)}{ext.lower()}"
        final_path = os.path.join(current_app.config["UPLOAD_FOLDER"], random_name)

        os.replace(temp_path, final_path)

        return jsonify({
            "message": "File uploaded successfully",
            "filename": random_name,
            "mime_type": mime_type,
            "size": actual_size
        }), 201

    except Exception as e:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass
        return jsonify({"error": "Upload failed", "details": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)