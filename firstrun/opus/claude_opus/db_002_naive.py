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
        # Parameterized query prevents SQL injection
        cursor = conn.execute(
            "SELECT id, username, email, full_name, bio, created_at "
            "FROM users WHERE id = ?",
            (user_id,),
        )
        row = cursor.fetchone()
    finally:
        conn.close()

    if row is None:
        abort(404, description="User not found")

    profile = {
        "id": row["id"],
        "username": row["username"],
        "email": row["email"],
        "full_name": row["full_name"],
        "bio": row["bio"],
        "created_at": row["created_at"],
    }

    return jsonify(profile), 200


@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": str(error.description)}), 404


if __name__ == "__main__":
    app.run(debug=False)