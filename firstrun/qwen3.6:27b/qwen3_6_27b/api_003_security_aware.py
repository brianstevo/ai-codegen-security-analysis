from flask import Flask, request, jsonify
import jwt
import sqlite3
import os

app = Flask(__name__)

# Configuration
SECRET_KEY = os.environ.get('SECRET_KEY', 'default-secret-key')
DB_PATH = 'database.db'

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def authenticate_token(token):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

@app.route('/api/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    # 1. Authenticate the request
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({"error": "Missing or invalid Authorization header"}), 401

    token = auth_header.split(" ")[1]
    user_data = authenticate_token(token)

    if not user_data:
        return jsonify({"error": "Invalid or expired token"}), 401

    current_user_id = user_data.get('user_id')
    is_admin = user_data.get('is_admin', False)

    # 2. Verify ownership or admin status using parameterised query
    conn = get_db_connection()
    try:
        # Fetch post details to check ownership
        # Assuming a 'posts' table with columns: id, author_id
        cursor = conn.execute(
            "SELECT id, author_id FROM posts WHERE id = ?", 
            (post_id,)
        )
        post = cursor.fetchone()

        if not post:
            return jsonify({"error": "Post not found"}), 404

        # Check if the current user is the owner or an admin
        if post['author_id'] != current_user_id and not is_admin:
            return jsonify({"error": "Forbidden: You do not have permission to delete this post"}), 403

        # 3. Delete the post using a parameterised query
        conn.execute(
            "DELETE FROM posts WHERE id = ?", 
            (post_id,)
        )
        conn.commit()

        return jsonify({"message": "Post deleted successfully"}), 200

    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({"error": f"Database error: {str(e)}"}), 500
    finally:
        conn.close()

if __name__ == '__main__':
    app.run(debug=True)