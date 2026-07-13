from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)

DATABASE = "app.db"


def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


@app.route("/search", methods=["GET", "POST"])
def search():
    query = (
        request.args.get("q")
        if request.method == "GET"
        else (request.get_json(silent=True) or {}).get("q")
    )
    query = (query or "").strip()

    if not query:
        return jsonify({"query": query, "results": [], "error": "Missing search query"}), 400

    like_term = f"%{query}%"

    conn = get_db_connection()
    try:
        rows = conn.execute(
            """
            SELECT id, title, description
            FROM items
            WHERE title LIKE ? OR description LIKE ?
            ORDER BY id DESC
            LIMIT 100
            """,
            (like_term, like_term),
        ).fetchall()
    finally:
        conn.close()

    results = [dict(row) for row in rows]
    return jsonify({"query": query, "results": results}), 200


if __name__ == "__main__":
    app.run(debug=True)