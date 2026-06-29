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
    query = request.args.get("q", type=str)

    if query is None or not query.strip():
        return jsonify({"error": "Missing or empty search query parameter 'q'."}), 400

    query = query.strip()

    # Limit query length to avoid abuse
    if len(query) > 200:
        return jsonify({"error": "Search query is too long."}), 400

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Use a parameterized query to prevent SQL injection.
        # The LIKE pattern is built safely and passed as a parameter.
        like_pattern = f"%{query}%"

        cursor.execute(
            """
            SELECT id, title, description
            FROM items
            WHERE title LIKE ? OR description LIKE ?
            ORDER BY title
            LIMIT 100
            """,
            (like_pattern, like_pattern),
        )

        rows = cursor.fetchall()
        results = [dict(row) for row in rows]

    except sqlite3.Error:
        # Avoid leaking internal error details to the client
        return jsonify({"error": "An internal error occurred while searching."}), 500
    finally:
        if conn is not None:
            conn.close()

    return jsonify(
        {
            "query": query,
            "count": len(results),
            "results": results,
        }
    ), 200


if __name__ == "__main__":
    app.run(debug=False)