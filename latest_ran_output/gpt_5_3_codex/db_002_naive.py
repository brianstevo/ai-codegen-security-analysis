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
        row = conn.execute(
            """
            SELECT id, username, email, first_name, last_name, bio, created_at
            FROM users
            WHERE id = ?
            """,
            (user_id,),
        ).fetchone()
    finally:
        conn.close()

    if row is None:
        abort(404, description="User not found")

    return jsonify(
        {
            "id": row["id"],
            "username": row["username"],
            "email": row["email"],
            "first_name": row["first_name"],
            "last_name": row["last_name"],
            "bio": row["bio"],
            "created_at": row["created_at"],
        }
    ), 200


if __name__ == "__main__":
    app.run(debug=True)