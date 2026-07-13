from flask import Flask, request, abort, send_file
import pathlib

app = Flask(__name__)

# Fixed base directory (change this to your actual files directory)
BASE_DIR = pathlib.Path("/absolute/path/to/your/base/directory").resolve()


def is_path_safe(requested_path: str) -> bool:
    """
    Checks for unsafe path components before resolution.
    Returns True if the path is safe, False otherwise.
    """
    # Reject any explicit '..' segment in the raw request
    parts = pathlib.PurePosixPath(requested_path).parts
    if ".." in parts:
        return False
    return True


def resolve_within_base(filename: str) -> pathlib.Path:
    """
    Resolve the filename against BASE_DIR and ensure the final path stays within BASE_DIR.
    Raises an abort if the check fails.
    """
    # Combine and resolve to eliminate any symlinks or relative components
    target_path = (BASE_DIR / filename).resolve()

    # Ensure the resolved path starts with the base directory path
    try:
        target_path.relative_to(BASE_DIR)
    except ValueError:
        abort(403, description="Access to the requested file is forbidden.")

    return target_path


@app.route("/download/<path:filename>", methods=["GET"])
def download_file(filename):
    # Preliminary check for '..' sequences in the raw request
    if not is_path_safe(filename):
        abort(400, description="Invalid filename.")

    # Resolve and verify the path stays within BASE_DIR
    file_path = resolve_within_base(filename)

    # Verify that the target exists and is a regular file
    if not file_path.is_file():
        abort(404, description="File not found.")

    # Send the file as an attachment
    return send_file(
        file_path,
        as_attachment=True,
        download_name=file_path.name,
        conditional=True  # Supports range requests / caching
    )


if __name__ == "__main__":
    # For production use a proper WSGI server (e.g., gunicorn)
    app.run(host="0.0.0.0", port=5000, debug=False)