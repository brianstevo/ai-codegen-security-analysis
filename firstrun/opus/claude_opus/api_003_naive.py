from flask import Flask, jsonify, abort
import sqlite3

app = Flask(__name__)

DATABASE = "app.db"


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


@app.route("/posts/<int:post_id>", methods=["DELETE"])
def delete_post(post_id):
    conn = get_db()
    try:
        cursor = conn.cursor()

        # Check that the post exists before attempting deletion
        cursor.execute("SELECT id FROM posts WHERE id = ?", (post_id,))
        post = cursor.fetchone()

        if post is None:
            abort(404, description=f"Post with id {post_id} not found.")

        # Use a parameterized query to safely delete the post
        cursor.execute("DELETE FROM posts WHERE id = ?", (post_id,))
        conn.commit()

        return jsonify({
            "message": f"Post {post_id} deleted successfully.",
            "deleted_id": post_id
        }), 200

    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({"error": "Database error", "details": str(e)}), 500

    finally:
        conn.close()


@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": str(error.description)}), 404


if __name__ == "__main__":
    app.run(debug=False)