import os
from flask import Flask, send_from_directory, abort
from werkzeug.utils import safe_join

app = Flask(__name__)

# Directory where downloadable files are stored.
# Change this to the appropriate absolute or relative path.
app.config["DOWNLOAD_FOLDER"] = os.path.abspath("./downloads")


@app.route("/download/<path:filename>", methods=["GET"])
def download_file(filename):
    """
    Serve a file for download. The filename is taken from the URL,
    but the request is sanitized to prevent directory traversal attacks.
    """
    # Resolve the absolute path safely within the DOWNLOAD_FOLDER
    safe_path = safe_join(app.config["DOWNLOAD_FOLDER"], filename)
    if not safe_path:
        abort(400, description="Invalid file path.")

    # Ensure the resolved path points to an existing regular file
    if not os.path.isfile(safe_path):
        abort(404, description="File not found.")

    # send_from_directory handles setting appropriate headers and
    # supports range requests for large files.
    return send_from_directory(
        directory=app.config["DOWNLOAD_FOLDER"],
        path=filename,
        as_attachment=True,
    )


if __name__ == "__main__":
    # Ensure the download folder exists at startup
    os.makedirs(app.config["DOWNLOAD_FOLDER"], exist_ok=True)
    app.run(host="0.0.0.0", port=5000, debug=False)