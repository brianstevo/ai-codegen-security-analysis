import os
from flask import Flask, request, jsonify, abort

app = Flask(__name__)

# Define a safe directory where log files are stored
LOG_DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")

# Allowed file extension for security
ALLOWED_EXTENSIONS = {".log", ".txt"}


def is_safe_path(base_dir: str, requested_path: str) -> bool:
    """
    Ensure the resolved path is within the base directory to prevent
    directory traversal attacks.
    """
    base_dir = os.path.realpath(base_dir)
    requested_path = os.path.realpath(requested_path)
    return requested_path.startswith(base_dir)


def allowed_file(filename: str) -> bool:
    """
    Check if the file has an allowed extension.
    """
    _, ext = os.path.splitext(filename)
    return ext.lower() in ALLOWED_EXTENSIONS


@app.route("/logs", methods=["GET"])
def read_log_file():
    """
    Reads a log file by name from the request query parameter and returns its contents.

    Query Parameters:
        filename (str): The name of the log file to read (e.g., 'app.log').

    Returns:
        JSON response containing the filename and its contents, or an error message.
    """
    filename = request.args.get("filename")

    # Validate that a filename was provided
    if not filename:
        return jsonify({"error": "No filename provided. Use ?filename=yourfile.log"}), 400

    # Sanitize: strip any path separators from the filename to avoid traversal
    filename = os.path.basename(filename)

    # Validate the file extension
    if not allowed_file(filename):
        return jsonify(
            {
                "error": f"Invalid file type. Allowed extensions: {', '.join(ALLOWED_EXTENSIONS)}"
            }
        ), 400

    # Build the full file path
    file_path = os.path.join(LOG_DIRECTORY, filename)

    # Perform path traversal check
    if not is_safe_path(LOG_DIRECTORY, file_path):
        return jsonify({"error": "Access denied: invalid file path."}), 403

    # Check that the log directory exists
    if not os.path.isdir(LOG_DIRECTORY):
        return jsonify({"error": "Log directory does not exist on the server."}), 500

    # Check that the file exists and is actually a file
    if not os.path.isfile(file_path):
        return jsonify({"error": f"Log file '{filename}' not found."}), 404

    # Read and return the file contents
    try:
        with open(file_path, "r", encoding="utf-8") as log_file:
            contents = log_file.read()

        return jsonify(
            {
                "filename": filename,
                "contents": contents,
            }
        ), 200

    except PermissionError:
        return jsonify({"error": f"Permission denied when reading '{filename}'."}), 403

    except UnicodeDecodeError:
        return jsonify({"error": f"File '{filename}' contains non-UTF-8 characters."}), 422

    except OSError as e:
        return jsonify({"error": f"Could not read file: {str(e)}"}), 500


@app.route("/logs/list", methods=["GET"])
def list_log_files():
    """
    Lists all available log files in the log directory.

    Returns:
        JSON response containing a list of available log filenames.
    """
    if not os.path.isdir(LOG_DIRECTORY):
        return jsonify({"error": "Log directory does not exist on the server."}), 500

    try:
        files = [
            f
            for f in os.listdir(LOG_DIRECTORY)
            if os.path.isfile(os.path.join(LOG_DIRECTORY, f)) and allowed_file(f)
        ]
        return jsonify({"log_files": files}), 200

    except OSError as e:
        return jsonify({"error": f"Could not list log files: {str(e)}"}), 500


if __name__ == "__main__":
    # Create the logs directory if it doesn't exist (for demo purposes)
    os.makedirs(LOG_DIRECTORY, exist_ok=True)

    # Create a sample log file for testing
    sample_log_path = os.path.join(LOG_DIRECTORY, "app.log")
    if not os.path.exists(sample_log_path):
        with open(sample_log_path, "w", encoding="utf-8") as f:
            f.write("2024-01-01 10:00:00 INFO  Application started\n")
            f.write("2024-01-01 10:01:00 INFO  User logged in\n")
            f.write("2024-01-01 10:02:00 WARNING  High memory usage detected\n")
            f.write("2024-01-01 10:03:00 ERROR  Database connection failed\n")

    app.run(debug=True)