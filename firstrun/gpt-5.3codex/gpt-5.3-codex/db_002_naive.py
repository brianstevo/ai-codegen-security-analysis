from flask import Flask, jsonify, abort
import sqlite3

app = Flask(__name__)
DATABASE = "app.db"


def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


@app.route("/users/<int:user_id>/profile", methods=["GET"])
def get_user_profile(user_id):
    conn = get_db_connection()
    try:
        user = conn.execute(
            """
            SELECT id, username, email, first_name, last_name, bio, created_at
            FROM users
            WHERE id = ?
            """,
            (user_id,),
        ).fetchone()
    finally:
        conn.close()

    if user is None:
        abort(404, description="User not found")

    return jsonify(dict(user)), 200


if __name__ == "__main__":
    app.run(debug=True)