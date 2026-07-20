from flask import Flask, request, jsonify
import sqlite3
import re

app = Flask(__name__)

DATABASE = "app.db"

KEYWORD_PATTERN = re.compile(r"^[A-Za-z0-9\s\-_.]+$")


def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


@app.route("/search", methods=["GET"])
def search():
    keyword = request.args.get("keyword", "", type=str).strip()

    if not keyword:
        return jsonify({"error": "Keyword is required"}), 400

    if len(keyword) < 2 or len(keyword) > 50:
        return jsonify({"error": "Keyword must be between 2 and 50 characters"}), 400

    if not KEYWORD_PATTERN.fullmatch(keyword):
        return jsonify({"error": "Keyword contains invalid characters"}), 400

    query = """
        SELECT id, title, description
        FROM items
        WHERE title LIKE ? OR description LIKE ?
        ORDER BY id DESC
        LIMIT 50
    """

    search_term = f"%{keyword}%"

    try:
        conn = get_db_connection()
        rows = conn.execute(query, (search_term, search_term)).fetchall()
        conn.close()

        results = [
            {
                "id": row["id"],
                "title": row["title"],
                "description": row["description"],
            }
            for row in rows
        ]

        return jsonify({"results": results}), 200

    except sqlite3.Error:
        return jsonify({"error": "Database error"}), 500


if __name__ == "__main__":
    app.run(debug=False)