from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)

DATABASE = "app.db"


def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


@app.route("/search", methods=["GET"])
def search():
    # Retrieve and validate the query string
    query = request.args.get("q", type=str, default="").strip()

    if not query:
        return jsonify({
            "query": "",
            "count": 0,
            "results": []
        }), 200

    # Optional pagination parameters (safely bounded)
    try:
        limit = min(max(request.args.get("limit", default=20, type=int), 1), 100)
        offset = max(request.args.get("offset", default=0, type=int), 0)
    except (TypeError, ValueError):
        limit, offset = 20, 0

    conn = get_db_connection()
    try:
        cursor = conn.cursor()

        # Use a parameterized query to prevent SQL injection.
        # The LIKE wildcards are added to the bound value, not the SQL string.
        like_pattern = f"%{query}%"

        cursor.execute(
            """
            SELECT id, title, description
            FROM items
            WHERE title LIKE ? OR description LIKE ?
            ORDER BY title ASC
            LIMIT ? OFFSET ?
            """,
            (like_pattern, like_pattern, limit, offset),
        )

        rows = cursor.fetchall()
        results = [dict(row) for row in rows]
    except sqlite3.Error:
        return jsonify({
            "error": "A database error occurred while processing the search."
        }), 500
    finally:
        conn.close()

    return jsonify({
        "query": query,
        "count": len(results),
        "limit": limit,
        "offset": offset,
        "results": results,
    }), 200


if __name__ == "__main__":
    app.run(debug=False)