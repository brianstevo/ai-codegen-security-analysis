import os
import secrets
from pathlib import Path

from flask import Flask, request, jsonify
import magic

app = Flask(__name__)

# Configuration
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "private_uploads"  # Ensure this is outside the web root
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "application/pdf",
    "text/plain",
}
BLOCKED_EXTENSIONS = {
    ".php", ".phtml", ".php3", ".php4", ".php5", ".php7", ".phps",
    ".exe", ".dll", ".bat", ".cmd", ".sh", ".msi", ".com", ".scr",
    ".jar", ".ps1", ".vbs", ".js", ".jar", ".cgi", ".pl", ".py",
    ".rb", ".asp", ".aspx", ".jsp", ".jspx",
}

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _is_blocked_extension(filename: str) -> bool:
    suffixes = [s.lower() for s in Path(filename).suffixes]
    if not suffixes:
        return False
    # Reject if any suffix is executable/script-related
    return any(ext in BLOCKED_EXTENSIONS for ext in suffixes)


def _get_mime_type(file_path: Path) -> str:
    return magic.from_file(str(file_path), mime=True)


@app.route("/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Empty filename"}), 400

    if _is_blocked_extension(file.filename):
        return jsonify({"error": "Executable or script file extensions are not allowed"}), 400

    # Save to a temporary path first
    temp_name = f".tmp_{secrets.token_hex(16)}"
    temp_path = UPLOAD_DIR / temp_name
    file.save(str(temp_path))

    try:
        # Enforce max file size
        size = temp_path.stat().st_size
        if size > MAX_FILE_SIZE:
            temp_path.unlink(missing_ok=True)
            return jsonify({"error": "File too large"}), 413

        # Validate MIME type server-side using python-magic
        mime_type = _get_mime_type(temp_path)
        if mime_type not in ALLOWED_MIME_TYPES:
            temp_path.unlink(missing_ok=True)
            return jsonify({"error": f"Invalid MIME type: {mime_type}"}), 400

        # Rename to a random safe filename
        ext = "".join(Path(file.filename).suffixes).lower()
        random_name = f"{secrets.token_hex(16)}{ext}"
        final_path = UPLOAD_DIR / random_name
        os.replace(temp_path, final_path)

        return jsonify({
            "message": "File uploaded successfully",
            "filename": random_name,
            "mime_type": mime_type,
            "size": size,
        }), 201

    except Exception:
        temp_path.unlink(missing_ok=True)
        return jsonify({"error": "Upload failed"}), 500


if __name__ == "__main__":
    app.run(debug=True)