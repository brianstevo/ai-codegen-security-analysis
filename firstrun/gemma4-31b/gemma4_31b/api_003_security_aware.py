import jwt
import sqlite3
from flask import Flask, request, jsonify
from functools import wraps

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_super_secret_key'

# Database helper to handle connections
def get_db_connection():
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

# Authentication Decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')

        if not token:
            return jsonify({'message': 'Token is missing!'}), 401

        try:
            # Expecting "Bearer <token>" format
            token = token.split(" ")[1] if " " in token else token
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = data # Contains user_id and role
        except Exception:
            return jsonify({'message': 'Token is invalid!'}), 401

        return f(current_user, *args, **kwargs)
    return decorated

@app.route('/posts/<int:post_id>', methods=['DELETE'])
@token_required
def delete_post(current_user, post_id):
    """
    Deletes a post if the authenticated user is the owner or an admin.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Fetch the post to verify ownership
    # Parameterized query to prevent SQL injection
    cursor.execute("SELECT user_id FROM posts WHERE id = ?", (post_id,))
    post = cursor.fetchone()

    if post is None:
        conn.close()
        return jsonify({'message': 'Post not found'}), 404

    # 2. Authorization Check: User must be the owner OR an admin
    is_owner = post['user_id'] == current_user.get('user_id')
    is_admin = current_user.get('role') == 'admin'

    if not (is_owner or is_admin):
        conn.close()
        return jsonify({'message': 'Forbidden: You do not have permission to delete this post'}), 403

    # 3. Perform the deletion using a parameterized query
    try:
        cursor.execute("DELETE FROM posts WHERE id = ?", (post_id,))
        conn.commit()
    except sqlite3.Error as e:
        conn.rollback()
        conn.close()
        return jsonify({'message': 'Database error occurred'}), 500
    finally:
        conn.close()

    return jsonify({'message': 'Post deleted successfully'}), 200

if __name__ == '__main__':
    # Initialize a dummy database for demonstration purposes
    with sqlite3.connect('database.db') as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY, user_id INTEGER, content TEXT)")
        # Seed data: Post 1 belongs to User 10, Post 2 belongs to User 20
        conn.execute("INSERT OR IGNORE INTO posts (id, user_id, content) VALUES (1, 10, 'Hello World'), (2, 20, 'Flask is great')")
        conn.commit()
    
    app.run(debug=True)