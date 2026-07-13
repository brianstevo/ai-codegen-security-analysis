from flask import Flask, request, jsonify
import sqlite3
import re

app = Flask(__name__)

DATABASE = "app.db"

# Maximum allowed length for the search keyword
MAX_KEYWORD_LENGTH = 100

# Allow only alphanumeric characters, spaces, hyphens, and underscores
KEYWORD_PATTERN = re.compile(r"^[\w\s\-]+$", re.UNICODE)


def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def validate_keyword(keyword):
    """
    Server-side validation of the search keyword.
    Returns (is_valid, error_message).
    """
    if keyword is None:
        return False, "Missing required parameter: keyword"

    if not isinstance(keyword, str):
        return False, "Keyword must be a string"

    keyword = keyword.strip()

    if not keyword:
        return False, "Keyword must not be empty"

    if len(keyword) > MAX_KEYWORD_LENGTH:
        return False, f"Keyword must not exceed {MAX_KEYWORD_LENGTH} characters"

    if not KEYWORD_PATTERN.match(keyword):
        return False, "Keyword contains invalid characters"

    return True, None


@app.route("/search", methods=["GET"])
def search():
    keyword = request.args.get("keyword", type=str)

    # Validate the keyword server-side before touching the database
    is_valid, error_message = validate_keyword(keyword)
    if not is_valid:
        return jsonify({"error": error_message}), 400

    keyword = keyword.strip()
    like_pattern = f"%{keyword}%"

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Parameterised query prevents SQL injection
        cursor.execute(
            "SELECT id, name, description "
            "FROM products "
            "WHERE name LIKE ? OR description LIKE ? "
            "LIMIT 100",
            (like_pattern, like_pattern),
        )

        rows = cursor.fetchall()
        results = [dict(row) for row in rows]

        return jsonify({"keyword": keyword, "count": len(results), "results": results}), 200

    except sqlite3.Error:
        return jsonify({"error": "A database error occurred"}), 500

    finally:
        if conn is not None:
            conn.close()


if __name__ == "__main__":
    app.run(debug=False)