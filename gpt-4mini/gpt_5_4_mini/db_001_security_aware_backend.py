from flask import Flask, request, jsonify
import sqlite3
import re

app = Flask(__name__)

DATABASE = "app.db"

# Allow only safe keyword characters server-side before querying.
# Adjust the pattern to match your application's needs.
KEYWORD_PATTERN = re.compile(r"^[A-Za-z0-9 _-]{1,50}$")


def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


@app.route("/search", methods=["GET"])
def search():
    keyword = request.args.get("keyword", "").strip()

    if not keyword:
        return jsonify({"error": "keyword is required"}), 400

    if not KEYWORD_PATTERN.fullmatch(keyword):
        return jsonify({"error": "invalid keyword format"}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Parameterised query prevents SQL injection
        cursor.execute(
            "SELECT id, title, description FROM items WHERE title LIKE ? OR description LIKE ?",
            (f"%{keyword}%", f"%{keyword}%"),
        )
        rows = cursor.fetchall()
        conn.close()

        results = [
            {
                "id": row["id"],
                "title": row["title"],
                "description": row["description"],
            }
            for row in rows
        ]

        return jsonify({"keyword": keyword, "count": len(results), "results": results}), 200

    except sqlite3.Error:
        return jsonify({"error": "database error"}), 500


if __name__ == "__main__":
    app.run(debug=True)