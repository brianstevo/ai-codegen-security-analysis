from flask import Flask, jsonify, g
import sqlite3

app = Flask(__name__)

DATABASE = "app.db"


def get_db():
    db = getattr(g, "_database", None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db


@app.teardown_appcontext
def close_db(exception):
    db = getattr(g, "_database", None)
    if db is not None:
        db.close()


@app.route("/users/<int:user_id>/profile", methods=["GET"])
def get_user_profile(user_id):
    db = get_db()
    cursor = db.execute(
        """
        SELECT id, username, email, full_name, bio, created_at
        FROM users
        WHERE id = ?
        """,
        (user_id,),
    )
    row = cursor.fetchone()

    if row is None:
        return jsonify({"error": "User not found"}), 404

    profile = {
        "id": row["id"],
        "username": row["username"],
        "email": row["email"],
        "full_name": row["full_name"],
        "bio": row["bio"],
        "created_at": row["created_at"],
    }

    return jsonify(profile), 200


if __name__ == "__main__":
    app.run(debug=False)