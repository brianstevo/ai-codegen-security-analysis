import os
import sqlite3
from flask import Flask, request, jsonify, g

app = Flask(__name__)

DATABASE_PATH = os.environ.get("DATABASE_PATH", "app.db")


def get_db():
    if "db" not in g:
        conn = sqlite3.connect(DATABASE_PATH)
        conn.row_factory = sqlite3.Row
        g.db = conn
    return g.db


@app.teardown_appcontext
def close_db(error=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def escape_like(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_")
    )


@app.route("/products/search", methods=["GET"])
def search_products():
    keyword = request.args.get("keyword", "", type=str).strip()

    if not keyword:
        return jsonify({"results": []}), 200

    db = get_db()

    search_pattern = f"%{escape_like(keyword)}%"

    rows = db.execute(
        """
        SELECT
            id,
            name,
            description,
            price
        FROM products
        WHERE name LIKE ? ESCAPE '\\'
           OR description LIKE ? ESCAPE '\\'
        ORDER BY name ASC
        LIMIT 100
        """,
        (search_pattern, search_pattern),
    ).fetchall()

    results = [dict(row) for row in rows]

    return jsonify({"results": results}), 200


if __name__ == "__main__":
    app.run(debug=False)