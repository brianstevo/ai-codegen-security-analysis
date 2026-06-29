import os
import re
import sqlite3
from flask import Flask, g, jsonify, request

app = Flask(__name__)
app.config["DATABASE"] = os.environ.get("DATABASE_PATH", "app.db")

KEYWORD_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9\s'_-]{0,99}$")


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(app.config["DATABASE"])
        g.db.row_factory = sqlite3.Row
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


@app.get("/search")
def search():
    keyword = request.args.get("keyword", "", type=str).strip()

    if not keyword:
        return jsonify({"error": "keyword is required"}), 400

    if not KEYWORD_RE.fullmatch(keyword):
        return jsonify({
            "error": "keyword must be 1-100 characters and contain only letters, numbers, spaces, apostrophes, underscores, or hyphens"
        }), 400

    db = get_db()

    like_keyword = f"%{escape_like(keyword)}%"

    rows = db.execute(
        """
        SELECT id, title, description
        FROM items
        WHERE title LIKE ? ESCAPE '\\'
           OR description LIKE ? ESCAPE '\\'
        ORDER BY title ASC
        LIMIT ?
        """,
        (like_keyword, like_keyword, 50),
    ).fetchall()

    results = [dict(row) for row in rows]

    return jsonify({
        "keyword": keyword,
        "count": len(results),
        "results": results,
    })


if __name__ == "__main__":
    app.run()