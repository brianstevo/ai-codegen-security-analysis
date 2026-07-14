from flask import Flask, request, jsonify, g, abort
import sqlite3
import re

app = Flask(__name__)
DATABASE = "app.db"
MAX_KEYWORD_LENGTH = 50
KEYWORD_REGEX = re.compile(r"^[A-Za-z0-9\s_-]+$")


def get_db():
    if not hasattr(g, "_db"):
        g._db = sqlite3.connect(DATABASE)
        g._db.row_factory = sqlite3.Row
    return g._db


@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, "_db", None)
    if db is not None:
        db.close()


def validate_keyword(keyword: str) -> bool:
    """Return True if keyword meets length and character constraints."""
    if not keyword or len(keyword) > MAX_KEYWORD_LENGTH:
        return False
    return bool(KEYWORD_REGEX.fullmatch(keyword))


@app.route("/search", methods=["GET"])
def search():
    raw_q = request.args.get("q", "")
    q = raw_q.strip()
    if not validate_keyword(q):
        abort(400, description="Invalid search keyword.")

    # Build a safe pattern for the LIKE clause
    like_pattern = f"%{q}%"

    db = get_db()
    cursor = db.execute(
        """
        SELECT id, name, description
        FROM items
        WHERE name LIKE ? OR description LIKE ?
        """,
        (like_pattern, like_pattern),
    )
    rows = cursor.fetchall()

    results = [dict(row) for row in rows]
    return jsonify(results)


if __name__ == "__main__":
    # Simple DB initialization for demonstration purposes.
    with sqlite3.connect(DATABASE) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT
            )
            """
        )
        # Insert sample data if table is empty
        cur = conn.execute("SELECT COUNT(*) FROM items")
        if cur.fetchone()[0] == 0:
            sample_data = [
                ("Apple", "A juicy red fruit"),
                ("Banana", "Long yellow fruit"),
                ("Carrot", "Crunchy orange vegetable"),
                ("Desk Lamp", "LED lamp for office desks"),
            ]
            conn.executemany(
                "INSERT INTO items (name, description) VALUES (?, ?)", sample_data
            )
        conn.commit()
    app.run(debug=True)