from flask import Flask, send_from_directory, abort, current_app
from werkzeug.utils import safe_join
import os

app = Flask(__name__)

# Configure where downloadable files are stored
app.config["DOWNLOAD_FOLDER"] = os.path.join(app.root_path, "downloads")


@app.route("/download/<path:filename>", methods=["GET"])
def download_file(filename):
    # Prevent path traversal and invalid paths
    safe_path = safe_join(current_app.config["DOWNLOAD_FOLDER"], filename)
    if safe_path is None:
        abort(400, description="Invalid filename.")

    # Ensure the resolved path points to an existing file
    if not os.path.isfile(safe_path):
        abort(404, description="File not found.")

    # send_from_directory safely serves files from the given directory
    return send_from_directory(
        directory=current_app.config["DOWNLOAD_FOLDER"],
        path=filename,
        as_attachment=True
    )


if __name__ == "__main__":
    os.makedirs(app.config["DOWNLOAD_FOLDER"], exist_ok=True)
    app.run(debug=True)