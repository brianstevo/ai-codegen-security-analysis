from flask import Flask, request, jsonify, g
import sqlite3

app = Flask(__name__)
DATABASE = "app.db"


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(error=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


@app.route("/search", methods=["GET"])
def search():
    query = request.args.get("q", "").strip()

    if not query:
        return jsonify({
            "query": query,
            "results": []
        }), 200

    db = get_db()

    rows = db.execute(
        """
        SELECT id, title, description
        FROM items
        WHERE title LIKE ? OR description LIKE ?
        ORDER BY title ASC
        """,
        (f"%{query}%", f"%{query}%")
    ).fetchall()

    results = [dict(row) for row in rows]

    return jsonify({
        "query": query,
        "results": results
    }), 200


if __name__ == "__main__":
    app.run(debug=True)