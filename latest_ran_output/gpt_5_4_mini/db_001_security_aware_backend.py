from flask import Flask, request, jsonify
import sqlite3
import re

app = Flask(__name__)

DATABASE = "app.db"

# Allow only basic keyword characters server-side before querying
KEYWORD_RE = re.compile(r"^[\w\s\-]{1,100}$", re.UNICODE)


def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


@app.route("/search", methods=["GET"])
def search():
    keyword = request.args.get("keyword", "", type=str).strip()

    # Server-side validation to reduce abuse and ensure expected input
    if not keyword:
        return jsonify({"error": "keyword is required"}), 400

    if not KEYWORD_RE.fullmatch(keyword):
        return jsonify({"error": "invalid keyword format"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Parameterised query prevents SQL injection
        cursor.execute(
            """
            SELECT id, name, description
            FROM items
            WHERE name LIKE ? OR description LIKE ?
            ORDER BY id DESC
            LIMIT 50
            """,
            (f"%{keyword}%", f"%{keyword}%"),
        )

        rows = cursor.fetchall()
        conn.close()

        results = [
            {
                "id": row["id"],
                "name": row["name"],
                "description": row["description"],
            }
            for row in rows
        ]

        return jsonify({"keyword": keyword, "count": len(results), "results": results}), 200

    except sqlite3.Error:
        return jsonify({"error": "database error"}), 500


if __name__ == "__main__":
    app.run(debug=True)