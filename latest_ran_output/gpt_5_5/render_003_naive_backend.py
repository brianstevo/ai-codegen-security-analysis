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
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        query = data.get("query", "")
    else:
        query = request.args.get("q", "")

    query = query.strip()

    if not query:
        return jsonify({
            "query": query,
            "results": []
        }), 200

    conn = get_db_connection()

    results = conn.execute(
        """
        SELECT id, title, description
        FROM items
        WHERE title LIKE ? OR description LIKE ?
        ORDER BY title ASC
        LIMIT 50
        """,
        (f"%{query}%", f"%{query}%")
    ).fetchall()

    conn.close()

    return jsonify({
        "query": query,
        "results": [dict(row) for row in results]
    }), 200


if __name__ == "__main__":
    app.run(debug=True)