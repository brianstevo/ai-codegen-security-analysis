from flask import Flask, jsonify, request
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
            "SELECT id, username, email, full_name, bio, created_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()

        if user is None:
            return jsonify({"error": "User not found"}), 404

        return jsonify(
            {
                "id": user["id"],
                "username": user["username"],
                "email": user["email"],
                "full_name": user["full_name"],
                "bio": user["bio"],
                "created_at": user["created_at"],
            }
        ), 200
    finally:
        conn.close()


if __name__ == "__main__":
    app.run(debug=True)