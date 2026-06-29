from flask import Flask, request, jsonify, current_app
import sqlite3
import re

app = Flask(__name__)
app.config["DATABASE"] = "app.db"

# Allow letters, numbers, spaces, underscore, and hyphen (1-64 chars)
KEYWORD_PATTERN = re.compile(r"^[A-Za-z0-9 _-]{1,64}$")


def get_db():
    conn = sqlite3.connect(current_app.config["DATABASE"])
    conn.row_factory = sqlite3.Row
    return conn


@app.route("/search", methods=["GET"])
def search():
    keyword = request.args.get("keyword", "").strip()

    # Server-side validation
    if not keyword:
        return jsonify({"error": "keyword is required"}), 400
    if not KEYWORD_PATTERN.fullmatch(keyword):
        return jsonify({"error": "invalid keyword format"}), 400

    # Parameterized query to prevent SQL injection
    sql = """
        SELECT id, name, description
        FROM products
        WHERE name LIKE ? OR description LIKE ?
        ORDER BY id DESC
        LIMIT 100
    """
    like_value = f"%{keyword}%"

    conn = get_db()
    try:
        rows = conn.execute(sql, (like_value, like_value)).fetchall()
        results = [dict(r) for r in rows]
        return jsonify({"results": results}), 200
    finally:
        conn.close()


if __name__ == "__main__":
    app.run(debug=True)