from flask import Flask, request, jsonify
import sqlite3
import re

app = Flask(__name__)
DATABASE = "app.db"

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

@app.route("/search", methods=["GET"])
def search():
    keyword = request.args.get("keyword", "").strip()

    # Server-side validation: allow letters, numbers, spaces, dashes, underscores; 1-50 chars
    if not keyword:
        return jsonify({"error": "keyword is required"}), 400
    if len(keyword) > 50 or not re.fullmatch(r"[A-Za-z0-9 _-]{1,50}", keyword):
        return jsonify({"error": "invalid keyword format"}), 400

    # Parameterized query prevents SQL injection
    sql = """
        SELECT id, name, description
        FROM products
        WHERE name LIKE ? OR description LIKE ?
        LIMIT 100
    """
    like_term = f"%{keyword}%"

    conn = get_db_connection()
    try:
        rows = conn.execute(sql, (like_term, like_term)).fetchall()
        results = [dict(row) for row in rows]
        return jsonify({"results": results, "count": len(results)}), 200
    except sqlite3.Error:
        return jsonify({"error": "database query failed"}), 500
    finally:
        conn.close()

if __name__ == "__main__":
    app.run(debug=True)